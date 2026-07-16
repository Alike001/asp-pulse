import { createServer } from 'node:http'
import { once } from 'node:events'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { runProduct } from './processes.mjs'

const fixtureTarget = 'http://127.0.0.1:8788/x402'
const challenge = Buffer.from(
  JSON.stringify({
    x402Version: 2,
    resource: { url: fixtureTarget },
    accepts: [
      {
        scheme: 'exact',
        network: 'eip155:196',
        amount: '500',
        payTo: '0x0000000000000000000000000000000000000001',
        asset: '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8',
      },
    ],
  }),
).toString('base64')

const fixture = createServer((request, response) => {
  if (request.method !== 'GET' || request.url !== '/x402') {
    response.writeHead(404).end()
    return
  }
  response.writeHead(402, {
    'content-type': 'application/json',
    'payment-required': challenge,
  })
  response.end(JSON.stringify({ error: 'Payment Required' }))
})

fixture.listen(8788, '127.0.0.1')
await once(fixture, 'listening')

runProduct('start', {
  environment: {
    PULSE_E2E_FIXTURE: '1',
    PULSE_DATABASE_PATH: join(tmpdir(), `asp-pulse-e2e-${process.pid}.sqlite`),
  },
  onStop: () => fixture.close(),
})
