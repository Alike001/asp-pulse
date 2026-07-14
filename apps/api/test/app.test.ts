import { describe, expect, it } from 'vitest'
import { X_LAYER_ASSETS } from '@asp-pulse/core'
import { createApp } from '../src/app.js'
import type { HostResolver } from '../src/target-safety.js'

const publicResolver: HostResolver = async () => [{ address: '93.184.216.34', family: 4 }]

describe('scan API', () => {
  it('returns a replayable preflight report', async () => {
    const app = createApp({
      createId: () => 'scan-1',
      now: sequence(1000, 1084),
      resolveHost: publicResolver,
      fetchImpl: async () =>
        new Response(null, {
          status: 402,
          headers: {
            'payment-required': Buffer.from(
              JSON.stringify({
                x402Version: 2,
                resource: { url: 'https://provider.example/service' },
                accepts: [
                  {
                    scheme: 'exact',
                    network: 'eip155:196',
                    amount: '500',
                    payTo: '0x0000000000000000000000000000000000000001',
                    asset: X_LAYER_ASSETS.USDG,
                  },
                ],
              }),
            ).toString('base64'),
          },
        }),
    })

    const response = await app.request('/v1/scans', {
      method: 'POST',
      body: JSON.stringify({ target: 'https://provider.example/service' }),
      headers: { 'content-type': 'application/json' },
    })
    expect(response.status).toBe(201)
    const scan = await response.json()
    expect(scan.id).toBe('scan-1')
    expect(scan.report.verdict).toBe('preflight_verified')

    const replay = await app.request('/v1/scans/scan-1')
    expect(replay.status).toBe(200)
  })

  it('rejects local targets before fetching', async () => {
    const app = createApp({
      resolveHost: async () => [{ address: '127.0.0.1', family: 4 }],
      fetchImpl: async () => {
        throw new Error('must not run')
      },
    })
    const response = await app.request('/v1/scans', {
      method: 'POST',
      body: JSON.stringify({ target: 'http://localhost/private' }),
      headers: { 'content-type': 'application/json' },
    })
    expect(response.status).toBe(400)
  })
})

function sequence(...values: number[]): () => number {
  let index = 0
  return () => values[index++] ?? values.at(-1) ?? 0
}
