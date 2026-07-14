import { describe, expect, it } from 'vitest'
import { X_LAYER_ASSETS } from '../src/constants.js'
import { evaluatePreflight } from '../src/evaluate.js'
import { validChallenge } from './fixtures.js'

const baseObservation = {
  target: 'https://provider.example/check',
  checkedAt: '2026-07-14T12:00:00.000Z',
  latencyMs: 84,
  httpStatus: 402,
} as const

describe('evaluatePreflight', () => {
  it('returns preflight verified when all observable hard gates pass', () => {
    const report = evaluatePreflight({
      ...baseObservation,
      challengeBody: validChallenge(),
    })

    expect(report.verdict).toBe('preflight_verified')
    expect(report.checks.find((item) => item.id === 'response_contract')?.status).toBe(
      'not_tested',
    )
  })

  it('returns invalid for the wrong X Layer payment network', () => {
    const report = evaluatePreflight({
      ...baseObservation,
      challengeBody: validChallenge({
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:1',
            amount: '500',
            payTo: '0x0dedc3c5e15bee45166924ea5b02f54a35b1f9c6',
            asset: X_LAYER_ASSETS.USDG,
          },
        ],
      }),
    })

    expect(report.verdict).toBe('invalid')
    expect(report.checks.find((item) => item.id === 'payment_terms')?.status).toBe('fail')
  })

  it('rejects malformed X Layer payment terms', () => {
    const challenge = validChallenge()
    challenge.accepts[0]!.amount = '-1'
    const report = evaluatePreflight({
      ...baseObservation,
      challengeBody: challenge,
    })
    expect(report.verdict).toBe('invalid')
    expect(report.checks.find((item) => item.id === 'payment_terms')?.status).toBe('fail')
  })

  it('rejects an unsupported payment scheme', () => {
    const report = evaluatePreflight({
      ...baseObservation,
      challengeBody: validChallenge({
        accepts: [
          {
            scheme: 'unsupported-scheme',
            network: 'eip155:196',
            amount: '500',
            payTo: '0x0dedc3c5e15bee45166924ea5b02f54a35b1f9c6',
            asset: X_LAYER_ASSETS.USDG,
          },
        ],
      }),
    })

    expect(report.verdict).toBe('invalid')
    expect(report.checks.find((item) => item.id === 'payment_terms')?.status).toBe('fail')
  })

  it('rejects a challenge bound to another resource', () => {
    const report = evaluatePreflight({
      ...baseObservation,
      challengeBody: validChallenge({
        resource: { url: 'https://other.example/paid-route' },
      }),
    })

    expect(report.verdict).toBe('invalid')
    expect(report.checks.find((item) => item.id === 'x402_challenge')?.status).toBe(
      'fail',
    )
  })

  it('returns verified only when a paid canary matched the protected schema', () => {
    const report = evaluatePreflight({
      ...baseObservation,
      challengeBody: validChallenge(),
      advertisedService: {
        agentId: '1960',
        serviceName: 'Price oracle',
        endpoint: baseObservation.target,
        amountAtomic: '500',
        asset: X_LAYER_ASSETS.USDG,
      },
      canary: {
        paid: true,
        completedAt: baseObservation.checkedAt,
        schemaMatched: true,
        schemaName: 'price-oracle/v1',
        transactionHash: '0xabc',
      },
    })

    expect(report.verdict).toBe('verified')
    expect(report.checks.every((item) => item.status === 'pass')).toBe(true)
  })

  it('produces the same evidence hash for equivalent object key ordering', () => {
    const left = evaluatePreflight({
      ...baseObservation,
      challengeBody: validChallenge(),
    })
    const challenge = validChallenge()
    const right = evaluatePreflight({
      challengeBody: {
        accepts: challenge.accepts,
        resource: challenge.resource,
        x402Version: challenge.x402Version,
      },
      httpStatus: 402,
      latencyMs: 84,
      checkedAt: baseObservation.checkedAt,
      target: baseObservation.target,
    })

    expect(left.evidenceHash).toBe(right.evidenceHash)
  })
})
