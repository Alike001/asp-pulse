import { describe, expect, it, vi } from 'vitest'
import { X_LAYER_ASSETS } from '@asp-pulse/core'
import { createXLayerEvidenceCollector } from '../src/xlayer-rpc.js'

describe('X Layer RPC evidence', () => {
  it('captures chain, block, contract, and token metadata and caches briefly', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      const calls = JSON.parse(String(init?.body)) as Array<{ id: number }>
      return Response.json(
        calls.map(({ id }) => ({
          jsonrpc: '2.0',
          id,
          result:
            id === 1
              ? '0xc4'
              : id === 2
                ? '0x3e7b577'
                : id === 10
                  ? '0x6001'
                  : id === 11
                    ? abiString('USDG')
                    : '0x6',
        })),
      )
    })
    const collect = createXLayerEvidenceCollector({
      xLayerFetchImpl: fetchImpl,
      xLayerRpcUrls: ['https://rpc.xlayer.tech'],
      xLayerNow: () => 1_000,
    })

    const first = await collect([X_LAYER_ASSETS.USDG])
    const second = await collect([X_LAYER_ASSETS.USDG])

    expect(first).toMatchObject({
      chainId: 196,
      blockNumber: 65_516_919,
      assets: [{ address: X_LAYER_ASSETS.USDG, symbol: 'USDG', decimals: 6 }],
    })
    expect(first.assets[0]?.contractCodeHash).toHaveLength(64)
    expect(second).toEqual(first)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('falls back to the second official endpoint', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      if (String(input).includes('primary')) return new Response(null, { status: 503 })
      const calls = JSON.parse(String(init?.body)) as Array<{ id: number }>
      return Response.json(
        calls.map(({ id }) => ({
          jsonrpc: '2.0',
          id,
          result:
            id === 1
              ? '0xc4'
              : id === 2
                ? '0x1'
                : id === 10
                  ? '0x6001'
                  : id === 11
                    ? abiString('USDG')
                    : '0x6',
        })),
      )
    })
    const collect = createXLayerEvidenceCollector({
      xLayerFetchImpl: fetchImpl,
      xLayerRpcUrls: ['https://primary.example', 'https://secondary.example'],
    })

    expect((await collect([X_LAYER_ASSETS.USDG])).rpcUrl).toBe(
      'https://secondary.example',
    )
  })
})

function abiString(value: string): string {
  const encoded = Buffer.from(value).toString('hex').padEnd(64, '0')
  return `0x${'20'.padStart(64, '0')}${value.length.toString(16).padStart(64, '0')}${encoded}`
}
