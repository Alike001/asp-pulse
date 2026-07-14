import { createPostgresScanStore } from './postgres-store.js'
import { SqliteScanStore } from './sqlite-store.js'
import type { ScanStore } from './store.js'

export async function createConfiguredScanStore(
  environment: NodeJS.ProcessEnv = process.env,
): Promise<ScanStore> {
  if (environment.DATABASE_URL) {
    return createPostgresScanStore(environment.DATABASE_URL)
  }
  if (environment.VERCEL === '1') {
    throw new Error('DATABASE_URL is required when ASP Pulse runs on Vercel.')
  }
  return new SqliteScanStore(environment.PULSE_DATABASE_PATH ?? '.data/asp-pulse.sqlite')
}
