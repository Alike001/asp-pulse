import { randomUUID } from 'node:crypto'
import { evaluatePreflight } from '@asp-pulse/core'
import { probeEndpoint, type ProbeDependencies } from './probe.js'
import type { ScanStore, StoredScan } from './store.js'

export interface ScanServiceDependencies extends ProbeDependencies {
  store: ScanStore
  createId?: () => string
}

export interface ScanService {
  scan(target: string): Promise<StoredScan>
}

export function createScanService({
  store,
  createId = randomUUID,
  ...probeDependencies
}: ScanServiceDependencies): ScanService {
  return {
    async scan(target: string): Promise<StoredScan> {
      const evidence = await probeEndpoint(target, probeDependencies)
      const scan = {
        id: createId(),
        evidence,
        report: evaluatePreflight(evidence),
      }
      await store.save(scan)
      return scan
    },
  }
}
