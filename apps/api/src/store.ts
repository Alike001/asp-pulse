import type { ScanReport } from '@asp-pulse/core'

export interface StoredScan {
  id: string
  report: ScanReport
}

export interface ScanStore {
  save(scan: StoredScan): Promise<void>
  find(id: string): Promise<StoredScan | undefined>
  recent(limit: number): Promise<StoredScan[]>
}

export class MemoryScanStore implements ScanStore {
  readonly #scans = new Map<string, StoredScan>()

  async save(scan: StoredScan): Promise<void> {
    this.#scans.set(scan.id, scan)
  }

  async find(id: string): Promise<StoredScan | undefined> {
    return this.#scans.get(id)
  }

  async recent(limit: number): Promise<StoredScan[]> {
    return [...this.#scans.values()].slice(-limit).reverse()
  }
}
