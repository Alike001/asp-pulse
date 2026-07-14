import type { PreflightObservation, ScanReport } from '@asp-pulse/core'

export interface StoredScan {
  id: string
  report: ScanReport
  evidence?: PreflightObservation
}

export interface ScanStore {
  save(scan: StoredScan): Promise<void>
  find(id: string): Promise<StoredScan | undefined>
  recent(limit: number): Promise<StoredScan[]>
  consumeScanAllowance(input: ScanAllowanceInput): Promise<ScanAllowance>
  prune(before: string): Promise<void>
}

export interface ScanAllowanceInput {
  bucket: string
  windowStartedAt: number
  limit: number
}

export interface ScanAllowance {
  allowed: boolean
  remaining: number
}

export class MemoryScanStore implements ScanStore {
  readonly #scans = new Map<string, StoredScan>()
  readonly #allowances = new Map<string, number>()

  async save(scan: StoredScan): Promise<void> {
    this.#scans.set(scan.id, scan)
  }

  async find(id: string): Promise<StoredScan | undefined> {
    return this.#scans.get(id)
  }

  async recent(limit: number): Promise<StoredScan[]> {
    return [...this.#scans.values()].slice(-limit).reverse()
  }

  async consumeScanAllowance({
    bucket,
    windowStartedAt,
    limit,
  }: ScanAllowanceInput): Promise<ScanAllowance> {
    const key = `${bucket}:${windowStartedAt}`
    const consumed = this.#allowances.get(key) ?? 0
    if (consumed >= limit) return { allowed: false, remaining: 0 }
    const next = consumed + 1
    this.#allowances.set(key, next)
    return { allowed: true, remaining: Math.max(0, limit - next) }
  }

  async prune(before: string): Promise<void> {
    const cutoff = Date.parse(before)
    for (const [id, scan] of this.#scans) {
      if (Date.parse(scan.report.checkedAt) < cutoff) this.#scans.delete(id)
    }
  }
}
