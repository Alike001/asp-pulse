import { describe, expect, it } from 'vitest'
import { evaluatePreflightV1, X_LAYER_ASSETS } from '@asp-pulse/core'
import { createApp } from '../src/app.js'
import { MemoryScanStore } from '../src/store.js'
import type { HostResolver } from '../src/target-safety.js'

const publicResolver: HostResolver = async () => [{ address: '93.184.216.34', family: 4 }]

describe('scan API', () => {
  it('returns a preflight report with a recomputable receipt', async () => {
    const app = createApp({
      createId: () => 'scan-1',
      now: sequence(1000, 1084),
      resolveHost: publicResolver,
      collectXLayerEvidence: async () => liveXLayerEvidence(),
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
    expect(scan.report.ruleSetVersion).toBe('PULSE-RULESET/1.1.0')
    expect(scan.evidence.xLayerEvidence).toMatchObject({
      chainId: 196,
      blockNumber: 65_000_000,
    })

    const replay = await app.request('/v1/scans/scan-1')
    expect(replay.status).toBe(200)

    const verification = await app.request('/v1/scans/scan-1/verify')
    expect(verification.status).toBe(200)
    expect((await verification.json()).valid).toBe(true)
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

  it('recomputes a stored version-one receipt with its original evaluator', async () => {
    const store = new MemoryScanStore()
    const evidence = {
      target: 'https://provider.example/service',
      checkedAt: '2026-07-14T12:00:00.000Z',
      latencyMs: 84,
      httpStatus: 402,
      challengeBody: JSON.parse(
        Buffer.from(
          compliantChallenge().headers.get('payment-required')!,
          'base64',
        ).toString('utf8'),
      ) as unknown,
    }
    await store.save({
      id: 'legacy-scan',
      evidence,
      report: evaluatePreflightV1(evidence),
    })
    const app = createApp({ store })

    const verification = await app.request('/v1/scans/legacy-scan/verify')
    expect(verification.status).toBe(200)
    expect(await verification.json()).toMatchObject({
      valid: true,
      report: { ruleSetVersion: 'PULSE-RULESET/1.0.0' },
    })
  })

  it('limits scan execution per anonymous source without limiting another source', async () => {
    const app = createApp({
      now: () => 1_000,
      scanLimit: 1,
      resolveHost: publicResolver,
      collectXLayerEvidence: async () => liveXLayerEvidence(),
      fetchImpl: async () => compliantChallenge(),
    })
    const request = (source: string) =>
      app.request('/v1/scans', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': source,
        },
        body: JSON.stringify({ target: 'https://provider.example/service' }),
      })

    expect((await request('203.0.113.4')).status).toBe(201)
    const limited = await request('203.0.113.4')
    expect(limited.status).toBe(429)
    expect(limited.headers.get('retry-after')).toBe('3599')
    expect((await request('203.0.113.5')).status).toBe(201)
  })

  it('exposes the real GET-only preflight as an MCP tool', async () => {
    const app = createApp({
      createId: () => 'mcp-scan-1',
      now: sequence(1000, 1084),
      resolveHost: publicResolver,
      collectXLayerEvidence: async () => liveXLayerEvidence(),
      fetchImpl: async () => compliantChallenge(),
    })

    const initialized = await mcpRequest(app, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        clientInfo: { name: 'asp-pulse-test', version: '1.0.0' },
      },
    })
    expect(initialized.status).toBe(200)

    const tools = await mcpRequest(app, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    })
    expect(await tools.json()).toMatchObject({
      result: { tools: [expect.objectContaining({ name: 'preflight_x402_endpoint' })] },
    })

    const result = await mcpRequest(app, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'preflight_x402_endpoint',
        arguments: { target: 'https://provider.example/service' },
      },
    })
    const body = await result.json()
    expect(body.result.content[0].text).toContain('mcp-scan-1')
    expect(body.result.content[0].text).toContain('preflight_verified')
  })
})

function compliantChallenge(): Response {
  return new Response(null, {
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
  })
}

function liveXLayerEvidence() {
  return {
    rpcUrl: 'https://rpc.xlayer.tech',
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
  }
}

function mcpRequest(app: ReturnType<typeof createApp>, body: unknown): Promise<Response> {
  return app.request('/mcp', {
    method: 'POST',
    headers: {
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      'mcp-protocol-version': '2025-11-25',
    },
    body: JSON.stringify(body),
  })
}

function sequence(...values: number[]): () => number {
  let index = 0
  return () => values[index++] ?? values.at(-1) ?? 0
}
