import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { ScanReport } from '@asp-pulse/core'
import type { ScanStore, StoredScan } from './store.js'

interface ScanRow {
  id: string
  report_json: string
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
        report_json TEXT NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS scans_checked_at ON scans (checked_at DESC);
    `)
  }

  async save(scan: StoredScan): Promise<void> {
    this.#database
      .prepare(
        `INSERT INTO scans (id, checked_at, report_json) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET checked_at = excluded.checked_at, report_json = excluded.report_json`,
      )
      .run(scan.id, scan.report.checkedAt, JSON.stringify(scan.report))
  }

  async find(id: string): Promise<StoredScan | undefined> {
    const row = this.#database
      .prepare('SELECT id, report_json FROM scans WHERE id = ?')
      .get(id) as unknown as ScanRow | undefined
    return row ? readRow(row) : undefined
  }

  async recent(limit: number): Promise<StoredScan[]> {
    const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)))
    const rows = this.#database
      .prepare('SELECT id, report_json FROM scans ORDER BY checked_at DESC LIMIT ?')
      .all(safeLimit) as unknown as ScanRow[]
    return rows.map(readRow)
  }

  close(): void {
    this.#database.close()
  }
}

function readRow(row: ScanRow): StoredScan {
  return { id: row.id, report: JSON.parse(row.report_json) as ScanReport }
}
