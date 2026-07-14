import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { SqliteScanStore } from './sqlite-store.js'

const port = Number(process.env.PORT ?? 8787)
const store = new SqliteScanStore(
  process.env.PULSE_DATABASE_PATH ?? '.data/asp-pulse.sqlite',
)

serve({ fetch: createApp({ store }).fetch, port }, ({ port: activePort }) => {
  console.log(`ASP Pulse API listening on http://localhost:${activePort}`)
})
