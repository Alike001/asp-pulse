import {
  RULE_SET_VERSION,
  SUPPORTED_ASSETS,
  X402_VERSION,
  X_LAYER_NETWORK,
} from './constants.js'
import { parseX402Challenge } from './challenge.js'
import { evidenceHash } from './canonical.js'
import type {
  CheckResult,
  CheckStatus,
  PreflightObservation,
  ScanReport,
  Verdict,
} from './types.js'

function check(
  id: CheckResult['id'],
  label: string,
  status: CheckStatus,
  summary: string,
  detail: Pick<CheckResult, 'expected' | 'observed'> = {},
): CheckResult {
  return { id, label, status, summary, ...detail }
}

function verdictFor(checks: CheckResult[]): Verdict {
  const hardGateIds = new Set<CheckResult['id']>([
    'reachability',
    'x402_challenge',
    'settlement',
  ])
  if (checks.some((item) => item.status === 'fail' && hardGateIds.has(item.id))) {
    return 'invalid'
  }
  if (checks.some((item) => item.status === 'fail' || item.status === 'warning')) {
    return 'degraded'
  }
  const response = checks.find((item) => item.id === 'response_contract')
  return response?.status === 'pass' ? 'verified' : 'preflight_verified'
}

const verdictLabels: Record<Verdict, string> = {
  verified: 'Fully verified',
  preflight_verified: 'Preflight verified',
  degraded: 'Degraded',
  invalid: 'Invalid',
}

export function evaluatePreflight(observation: PreflightObservation): ScanReport {
  const challenge = parseX402Challenge(observation.challengeBody)
  const compatible = challenge?.accepts.filter(isXLayerCompatible)
  const advertised = observation.advertisedService
  const canary = observation.canary

  const checks: CheckResult[] = [
    advertised
      ? check(
          'discovery',
          'Discovery metadata',
          'pass',
          'Service metadata was resolved.',
          {
            observed: {
              agentId: advertised.agentId,
              serviceName: advertised.serviceName,
            },
          },
        )
      : check(
          'discovery',
          'Discovery metadata',
          'not_tested',
          'Direct endpoint scan; registry metadata was not supplied.',
        ),
    observation.error
      ? check('reachability', 'Endpoint reachability', 'fail', observation.error)
      : check(
          'reachability',
          'Endpoint reachability',
          observation.httpStatus === 402 ? 'pass' : 'warning',
          observation.httpStatus === 402
            ? 'Endpoint returned the expected payment challenge.'
            : 'Endpoint responded, but not with HTTP 402.',
          { expected: 402, observed: observation.httpStatus },
        ),
    challenge?.x402Version === X402_VERSION
      ? check('x402_challenge', 'x402 challenge', 'pass', 'Challenge is valid x402 v2.', {
          expected: X402_VERSION,
          observed: challenge.x402Version,
        })
      : check('x402_challenge', 'x402 challenge', 'fail', 'No valid x402 v2 challenge.', {
          expected: X402_VERSION,
          observed: challenge?.x402Version,
        }),
    compatible && compatible.length > 0
      ? check(
          'settlement',
          'X Layer settlement',
          'pass',
          'Supported X Layer settlement found.',
          {
            expected: { network: X_LAYER_NETWORK, assets: [...SUPPORTED_ASSETS] },
            observed: compatible.map(({ network, asset, scheme }) => ({
              network,
              asset,
              scheme,
            })),
          },
        )
      : check(
          'settlement',
          'X Layer settlement',
          'fail',
          'No supported X Layer asset found.',
          {
            expected: { network: X_LAYER_NETWORK, assets: [...SUPPORTED_ASSETS] },
            observed: challenge?.accepts.map(({ network, asset }) => ({
              network,
              asset,
            })),
          },
        ),
    advertised?.amountAtomic && advertised.asset
      ? evaluatePrice(advertised.amountAtomic, advertised.asset, compatible ?? [])
      : check(
          'price',
          'Advertised price',
          'not_tested',
          'An atomic advertised amount and asset are required for comparison.',
        ),
    canary?.paid && canary.schemaMatched === true
      ? check(
          'response_contract',
          'Protected response',
          'pass',
          'Paid canary matched schema.',
          {
            observed: {
              completedAt: canary.completedAt,
              schemaName: canary.schemaName,
              transactionHash: canary.transactionHash,
            },
          },
        )
      : check(
          'response_contract',
          'Protected response',
          'not_tested',
          'No successful paid canary evidence is attached.',
        ),
  ]

  const verdict = verdictFor(checks)
  const evidence = {
    ...observation,
    challengeBody: challenge,
    ruleSetVersion: RULE_SET_VERSION,
  }
  return {
    ruleSetVersion: RULE_SET_VERSION,
    target: observation.target,
    checkedAt: observation.checkedAt,
    latencyMs: observation.latencyMs,
    verdict,
    verdictLabel: verdictLabels[verdict],
    checks,
    evidenceHash: evidenceHash(evidence),
  }
}

function isXLayerCompatible(requirement: {
  network: string
  asset: string
  amount: string
  payTo: string
}): boolean {
  return (
    requirement.network === X_LAYER_NETWORK &&
    SUPPORTED_ASSETS.has(requirement.asset.toLowerCase()) &&
    /^\d+$/.test(requirement.amount) &&
    BigInt(requirement.amount) > 0n &&
    /^0x[a-f\d]{40}$/i.test(requirement.payTo)
  )
}

function evaluatePrice(
  amountAtomic: string,
  asset: string,
  requirements: Array<{ amount: string; asset: string }>,
): CheckResult {
  const match = requirements.some(
    (item) =>
      item.asset.toLowerCase() === asset.toLowerCase() && item.amount === amountAtomic,
  )
  return check(
    'price',
    'Advertised price',
    match ? 'pass' : 'fail',
    match
      ? 'Challenge matches the advertised price.'
      : 'Challenge price differs from metadata.',
    {
      expected: { amountAtomic, asset },
      observed: requirements.map(({ amount, asset: observedAsset }) => ({
        amountAtomic: amount,
        asset: observedAsset,
      })),
    },
  )
}
