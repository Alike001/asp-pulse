import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { createConfiguredScanStore } from './store-factory.js'

const port = Number(process.env.API_PORT ?? 8787)
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error('API_PORT must be an integer between 1 and 65535.')
}
const store = await createConfiguredScanStore()

serve({ fetch: createApp({ store }).fetch, port }, ({ port: activePort }) => {
  console.log(`ASP Pulse API listening on http://localhost:${activePort}`)
})
