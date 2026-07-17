import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { createConfiguredScanStore } from './store-factory.js'
import { X_LAYER_ASSETS } from '@asp-pulse/core'

const port = Number(process.env.API_PORT ?? 8787)
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error('API_PORT must be an integer between 1 and 65535.')
}
const store = await createConfiguredScanStore()
const e2eDependencies =
  process.env.PULSE_E2E_FIXTURE === '1'
    ? {
        collectXLayerEvidence: async () => ({
          rpcUrl: 'fixture://xlayer-mainnet',
          chainId: 196,
          blockNumber: 65_000_000,
          assets: [
            {
              address: X_LAYER_ASSETS.USDG,
              contractCodeHash: 'a'.repeat(64),
              symbol: 'USDG',
              decimals: 6,
            },
          ],
        }),
      }
    : {}

serve(
  { fetch: createApp({ store, ...e2eDependencies }).fetch, port },
  ({ port: activePort }) => {
    console.log(`ASP Pulse API listening on http://localhost:${activePort}`)
  },
)
