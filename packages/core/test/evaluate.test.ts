import { describe, expect, it } from 'vitest'
import { LEGACY_RULE_SET_VERSION, X_LAYER_ASSETS } from '../src/constants.js'
import { evaluatePreflight, evaluatePreflightV1 } from '../src/evaluate.js'
import { validChallenge } from './fixtures.js'

const baseObservation = {
  target: 'https://provider.example/check',
  checkedAt: '2026-07-14T12:00:00.000Z',
  latencyMs: 84,
  httpStatus: 402,
  xLayerEvidence: {
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
  },
} as const

describe('evaluatePreflight', () => {
  it('returns preflight verified when all observable hard gates pass', () => {
    const report = evaluatePreflight({
      ...baseObservation,
      challengeBody: validChallenge(),
    })

    expect(report.verdict).toBe('preflight_verified')
    expect(report.ruleSetVersion).toBe('PULSE-RULESET/1.1.0')
    expect(report.checks.find((item) => item.id === 'payment_terms')?.summary).toContain(
      'live X Layer',
    )
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

  it('degrades when live X Layer state is unavailable', () => {
    const report = evaluatePreflight({
      ...baseObservation,
      xLayerEvidence: {
        rpcUrl: 'https://rpc.xlayer.tech',
        chainId: 0,
        blockNumber: 0,
        assets: [],
        error: 'Live X Layer evidence unavailable.',
      },
      challengeBody: validChallenge(),
    })

    expect(report.verdict).toBe('degraded')
    expect(report.checks.find((item) => item.id === 'payment_terms')?.status).toBe(
      'warning',
    )
  })

  it('rejects live token metadata that does not match the supported asset', () => {
    const report = evaluatePreflight({
      ...baseObservation,
      xLayerEvidence: {
        ...baseObservation.xLayerEvidence,
        assets: [
          {
            ...baseObservation.xLayerEvidence.assets[0],
            decimals: 18,
          },
        ],
      },
      challengeBody: validChallenge(),
    })

    expect(report.verdict).toBe('invalid')
    expect(report.checks.find((item) => item.id === 'payment_terms')?.status).toBe('fail')
  })

  it('accepts the on-chain USD₮0 symbol for the supported USDT0 contract', () => {
    const report = evaluatePreflight({
      ...baseObservation,
      xLayerEvidence: {
        ...baseObservation.xLayerEvidence,
        assets: [
          {
            address: X_LAYER_ASSETS.USDT0,
            contractCodeHash: 'b'.repeat(64),
            symbol: 'USD₮0',
            decimals: 6,
          },
        ],
      },
      challengeBody: validChallenge({
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:196',
            amount: '500',
            payTo: '0x0dedc3c5e15bee45166924ea5b02f54a35b1f9c6',
            asset: X_LAYER_ASSETS.USDT0,
          },
        ],
      }),
    })

    expect(report.verdict).toBe('preflight_verified')
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

  it('never promotes a public report beyond preflight verification', () => {
    const report = evaluatePreflight({
      ...baseObservation,
      challengeBody: validChallenge(),
    })

    expect(report.verdict).toBe('preflight_verified')
    expect(report.checks.find((item) => item.id === 'price')?.status).toBe('not_tested')
    expect(report.checks.find((item) => item.id === 'response_contract')?.status).toBe(
      'not_tested',
    )
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
      xLayerEvidence: baseObservation.xLayerEvidence,
    })

    expect(left.evidenceHash).toBe(right.evidenceHash)
  })

  it('preserves the exact legacy rule-set path for stored receipts', () => {
    const report = evaluatePreflightV1({
      target: baseObservation.target,
      checkedAt: baseObservation.checkedAt,
      latencyMs: baseObservation.latencyMs,
      httpStatus: 402,
      challengeBody: validChallenge(),
    })

    expect(report.ruleSetVersion).toBe(LEGACY_RULE_SET_VERSION)
    expect(report.verdict).toBe('preflight_verified')
    expect(report.checks.find((item) => item.id === 'payment_terms')?.summary).toBe(
      'Supported X Layer payment terms found.',
    )
  })
})
