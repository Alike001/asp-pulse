import {
  RULE_SET_VERSION,
  SUPPORTED_ASSETS,
  X402_VERSION,
  X_LAYER_NETWORK,
  X_LAYER_PAYMENT_SCHEMES,
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
    'payment_terms',
  ])
  if (checks.some((item) => item.status === 'fail' && hardGateIds.has(item.id))) {
    return 'invalid'
  }
  if (checks.some((item) => item.status === 'fail' || item.status === 'warning')) {
    return 'degraded'
  }
  return 'preflight_verified'
}

const verdictLabels: Record<Verdict, string> = {
  preflight_verified: 'Preflight verified',
  degraded: 'Degraded',
  invalid: 'Invalid',
}

export function evaluatePreflight(observation: PreflightObservation): ScanReport {
  const challenge = parseX402Challenge(observation.challengeBody)
  const compatible = challenge?.accepts.filter(isXLayerCompatible)
  const checks: CheckResult[] = [
    check(
      'discovery',
      'Discovery metadata',
      'not_tested',
      'Trusted OKX.AI registry metadata is not connected in version one.',
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
    evaluateChallenge(challenge, observation.target),
    compatible && compatible.length > 0
      ? check(
          'payment_terms',
          'X Layer payment terms',
          'pass',
          'Supported X Layer payment terms found.',
          {
            expected: {
              network: X_LAYER_NETWORK,
              assets: [...SUPPORTED_ASSETS],
              schemes: [...X_LAYER_PAYMENT_SCHEMES],
            },
            observed: compatible.map(({ network, asset, scheme }) => ({
              network,
              asset,
              scheme,
            })),
          },
        )
      : check(
          'payment_terms',
          'X Layer payment terms',
          'fail',
          'No supported X Layer asset found.',
          {
            expected: {
              network: X_LAYER_NETWORK,
              assets: [...SUPPORTED_ASSETS],
              schemes: [...X_LAYER_PAYMENT_SCHEMES],
            },
            observed: challenge?.accepts.map(({ network, asset }) => ({
              network,
              asset,
            })),
          },
        ),
    check(
      'price',
      'Advertised price',
      'not_tested',
      'Price verification is unavailable in version one.',
    ),
    check(
      'response_contract',
      'Protected response',
      'not_tested',
      'Paid delivery verification is unavailable in version one.',
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

function evaluateChallenge(
  challenge: ReturnType<typeof parseX402Challenge>,
  target: string,
): CheckResult {
  if (challenge?.x402Version !== X402_VERSION) {
    return check(
      'x402_challenge',
      'x402 challenge',
      'fail',
      'No valid x402 v2 challenge.',
      {
        expected: X402_VERSION,
        observed: challenge?.x402Version,
      },
    )
  }
  if (!resourceMatchesTarget(challenge.resource?.url, target)) {
    return check(
      'x402_challenge',
      'x402 challenge',
      'fail',
      'Challenge resource does not match the scanned endpoint.',
      {
        expected: { x402Version: X402_VERSION, resourceUrl: target },
        observed: {
          x402Version: challenge.x402Version,
          resourceUrl: challenge.resource?.url,
        },
      },
    )
  }
  return check(
    'x402_challenge',
    'x402 challenge',
    'pass',
    'Challenge is valid x402 v2 and bound to this endpoint.',
    {
      expected: { x402Version: X402_VERSION, resourceUrl: target },
      observed: {
        x402Version: challenge.x402Version,
        resourceUrl: challenge.resource?.url,
      },
    },
  )
}

function resourceMatchesTarget(resourceUrl: string | undefined, target: string): boolean {
  if (!resourceUrl) return false
  try {
    const resource = new URL(resourceUrl)
    const scanned = new URL(target)
    return (
      resource.protocol === scanned.protocol &&
      resource.host === scanned.host &&
      resource.pathname === scanned.pathname &&
      resource.search === scanned.search
    )
  } catch {
    return false
  }
}

function isXLayerCompatible(requirement: {
  scheme: string
  network: string
  asset: string
  amount: string
  payTo: string
}): boolean {
  return (
    X_LAYER_PAYMENT_SCHEMES.has(requirement.scheme) &&
    requirement.network === X_LAYER_NETWORK &&
    SUPPORTED_ASSETS.has(requirement.asset.toLowerCase()) &&
    /^\d+$/.test(requirement.amount) &&
    BigInt(requirement.amount) > 0n &&
    /^0x[a-f\d]{40}$/i.test(requirement.payTo)
  )
}
