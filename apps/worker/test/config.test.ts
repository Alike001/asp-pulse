import { describe, expect, it } from 'vitest'
import { assertCanaryMayPay, loadCanaryConfig } from '../src/config.js'

describe('paid canary guardrails', () => {
  it('is disabled by default', () => {
    const config = loadCanaryConfig({})
    expect(config.enabled).toBe(false)
    expect(() =>
      assertCanaryMayPay(new URL('https://service.example'), 1n, 0n, config),
    ).toThrow('disabled')
  })

  it('requires allowlist and both budgets', () => {
    const config = loadCanaryConfig({
      ENABLE_PAID_CANARY: 'true',
      CANARY_ALLOWLIST: 'service.example',
      CANARY_DAILY_BUDGET_ATOMIC: '100',
      CANARY_PER_CALL_LIMIT_ATOMIC: '20',
    })
    expect(() =>
      assertCanaryMayPay(new URL('https://service.example'), 20n, 80n, config),
    ).not.toThrow()
    expect(() =>
      assertCanaryMayPay(new URL('https://other.example'), 1n, 0n, config),
    ).toThrow('allowlist')
    expect(() =>
      assertCanaryMayPay(new URL('https://service.example'), 21n, 0n, config),
    ).toThrow('per-call')
    expect(() =>
      assertCanaryMayPay(new URL('https://service.example'), 20n, 81n, config),
    ).toThrow('daily')
  })
})
