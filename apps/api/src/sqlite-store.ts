import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { PreflightObservation, ScanReport } from '@asp-pulse/core'
import type { ScanAllowance, ScanAllowanceInput, ScanStore, StoredScan } from './store.js'

interface ScanRow {
  id: string
  report_json: string
  evidence_json: string | null
}

export class SqliteScanStore implements ScanStore {
  readonly #database: DatabaseSync

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
    this.#database = new DatabaseSync(path, { timeout: 5_000, defensive: true })
    this.#database.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS scans (
        id TEXT PRIMARY KEY,
        checked_at TEXT NOT NULL,
        report_json TEXT NOT NULL,
        evidence_json TEXT
      ) STRICT;
      CREATE INDEX IF NOT EXISTS scans_checked_at ON scans (checked_at DESC);
      CREATE TABLE IF NOT EXISTS scan_rate_limits (
        bucket TEXT NOT NULL,
        window_started_at INTEGER NOT NULL,
        request_count INTEGER NOT NULL,
        PRIMARY KEY (bucket, window_started_at)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS scan_rate_limits_window ON scan_rate_limits (window_started_at);
    `)
    const columns = this.#database.prepare('PRAGMA table_info(scans)').all() as Array<{
      name: string
    }>
    if (!columns.some(({ name }) => name === 'evidence_json')) {
      this.#database.exec('ALTER TABLE scans ADD COLUMN evidence_json TEXT;')
    }
  }

  async save(scan: StoredScan): Promise<void> {
    this.#database
      .prepare(
        `INSERT INTO scans (id, checked_at, report_json, evidence_json) VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           checked_at = excluded.checked_at,
           report_json = excluded.report_json,
           evidence_json = excluded.evidence_json`,
      )
      .run(
        scan.id,
        scan.report.checkedAt,
        JSON.stringify(scan.report),
        JSON.stringify(scan.evidence ?? null),
      )
  }

  async find(id: string): Promise<StoredScan | undefined> {
    const row = this.#database
      .prepare('SELECT id, report_json, evidence_json FROM scans WHERE id = ?')
      .get(id) as unknown as ScanRow | undefined
    return row ? readRow(row) : undefined
  }

  async recent(limit: number): Promise<StoredScan[]> {
    const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)))
    const rows = this.#database
      .prepare(
        'SELECT id, report_json, evidence_json FROM scans ORDER BY checked_at DESC LIMIT ?',
      )
      .all(safeLimit) as unknown as ScanRow[]
    return rows.map(readRow)
  }

  async consumeScanAllowance({
    bucket,
    windowStartedAt,
    limit,
  }: ScanAllowanceInput): Promise<ScanAllowance> {
    const row = this.#database
      .prepare(
        `INSERT INTO scan_rate_limits (bucket, window_started_at, request_count)
         VALUES (?, ?, 1)
         ON CONFLICT(bucket, window_started_at) DO UPDATE SET
           request_count = scan_rate_limits.request_count + 1
         WHERE scan_rate_limits.request_count < ?
         RETURNING request_count`,
      )
      .get(bucket, windowStartedAt, limit) as { request_count?: number } | undefined
    const consumed = row?.request_count
    return consumed == null
      ? { allowed: false, remaining: 0 }
      : { allowed: true, remaining: Math.max(0, limit - consumed) }
  }

  async prune(before: string): Promise<void> {
    this.#database.prepare('DELETE FROM scans WHERE checked_at < ?').run(before)
    this.#database
      .prepare('DELETE FROM scan_rate_limits WHERE window_started_at < ?')
      .run(Date.parse(before))
  }

  close(): void {
    this.#database.close()
  }
}

function readRow(row: ScanRow): StoredScan {
  const evidence = row.evidence_json
    ? (JSON.parse(row.evidence_json) as PreflightObservation | null)
    : null
  return {
    id: row.id,
    report: JSON.parse(row.report_json) as ScanReport,
    ...(evidence ? { evidence } : {}),
  }
}
