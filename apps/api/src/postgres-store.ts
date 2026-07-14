import { neon } from '@neondatabase/serverless'
import type { PreflightObservation, ScanReport } from '@asp-pulse/core'
import type { ScanStore, StoredScan } from './store.js'

interface ScanRow {
  id: string
  report_json: string
  evidence_json: string | null
}

export interface PostgresClient {
  query(statement: string, parameters?: unknown[]): Promise<Record<string, unknown>[]>
}

export class PostgresScanStore implements ScanStore {
  constructor(private readonly client: PostgresClient) {}

  async initialize(): Promise<void> {
    await this.client.query(`
      CREATE TABLE IF NOT EXISTS scans (
        id TEXT PRIMARY KEY,
        checked_at TIMESTAMPTZ NOT NULL,
        report_json JSONB NOT NULL,
        evidence_json JSONB
      )
    `)
    await this.client.query(
      'ALTER TABLE scans ADD COLUMN IF NOT EXISTS evidence_json JSONB',
    )
    await this.client.query(
      'CREATE INDEX IF NOT EXISTS scans_checked_at ON scans (checked_at DESC)',
    )
  }

  async save(scan: StoredScan): Promise<void> {
    await this.client.query(
      `INSERT INTO scans (id, checked_at, report_json, evidence_json)
       VALUES ($1, $2, $3::jsonb, $4::jsonb)
       ON CONFLICT (id) DO UPDATE SET
         checked_at = EXCLUDED.checked_at,
         report_json = EXCLUDED.report_json,
         evidence_json = EXCLUDED.evidence_json`,
      [
        scan.id,
        scan.report.checkedAt,
        JSON.stringify(scan.report),
        JSON.stringify(scan.evidence ?? null),
      ],
    )
  }

  async find(id: string): Promise<StoredScan | undefined> {
    const rows = await this.client.query(
      'SELECT id, report_json::text, evidence_json::text FROM scans WHERE id = $1',
      [id],
    )
    const row = rows[0]
    return row ? readRow(row) : undefined
  }

  async recent(limit: number): Promise<StoredScan[]> {
    const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)))
    const rows = await this.client.query(
      'SELECT id, report_json::text, evidence_json::text FROM scans ORDER BY checked_at DESC LIMIT $1',
      [safeLimit],
    )
    return rows.map(readRow)
  }
}

export async function createPostgresScanStore(
  databaseUrl: string,
): Promise<PostgresScanStore> {
  const sql = neon(databaseUrl)
  const store = new PostgresScanStore({
    query: (statement, parameters) =>
      sql.query(statement, parameters) as Promise<Record<string, unknown>[]>,
  })
  await store.initialize()
  return store
}

function readRow(row: Record<string, unknown>): StoredScan {
  const parsed = row as unknown as ScanRow
  const evidence = parsed.evidence_json
    ? (JSON.parse(parsed.evidence_json) as PreflightObservation | null)
    : null
  return {
    id: parsed.id,
    report: JSON.parse(parsed.report_json) as ScanReport,
    ...(evidence ? { evidence } : {}),
  }
}
