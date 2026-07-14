import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { SqliteScanStore } from './sqlite-store.js'

const port = Number(process.env.API_PORT ?? 8787)
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error('API_PORT must be an integer between 1 and 65535.')
}
const store = new SqliteScanStore(
  process.env.PULSE_DATABASE_PATH ?? '.data/asp-pulse.sqlite',
)

serve({ fetch: createApp({ store }).fetch, port }, ({ port: activePort }) => {
  console.log(`ASP Pulse API listening on http://localhost:${activePort}`)
})
