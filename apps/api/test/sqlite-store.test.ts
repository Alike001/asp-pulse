import { describe, expect, it } from 'vitest'
import { evaluatePreflight, X_LAYER_ASSETS } from '@asp-pulse/core'
import { SqliteScanStore } from '../src/sqlite-store.js'

describe('SQLite scan store', () => {
  it('persists and orders reports with recomputable receipts', async () => {
    const store = new SqliteScanStore(':memory:')
    const evidence = {
      target: 'https://provider.example/service',
      checkedAt: '2026-07-14T12:00:00.000Z',
      latencyMs: 42,
      httpStatus: 402,
      challengeBody: {
        x402Version: 2,
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:196',
            amount: '500',
            payTo: '0x0000000000000000000000000000000000000001',
            asset: X_LAYER_ASSETS.USDG,
          },
        ],
      },
    }
    const report = evaluatePreflight(evidence)

    await store.save({ id: 'stored-1', report, evidence })
    const stored = await store.find('stored-1')
    expect(stored?.report.evidenceHash).toBe(report.evidenceHash)
    expect(stored?.evidence).toEqual(evidence)
    expect((await store.recent(25))[0]?.id).toBe('stored-1')
    store.close()
  })

  it('enforces a shared-window allowance and removes expired reports', async () => {
    const store = new SqliteScanStore(':memory:')
    expect(
      await store.consumeScanAllowance({
        bucket: 'anonymous',
        windowStartedAt: 0,
        limit: 1,
      }),
    ).toEqual({ allowed: true, remaining: 0 })
    expect(
      await store.consumeScanAllowance({
        bucket: 'anonymous',
        windowStartedAt: 0,
        limit: 1,
      }),
    ).toEqual({ allowed: false, remaining: 0 })
    store.close()
  })
})
