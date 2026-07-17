import {
  LEGACY_RULE_SET_VERSION,
  RULE_SET_VERSION,
  SUPPORTED_ASSETS,
  X402_VERSION,
  X_LAYER_ASSET_METADATA,
  X_LAYER_CHAIN_ID,
  X_LAYER_NETWORK,
  X_LAYER_PAYMENT_SCHEMES,
} from './constants.js'
import { parseX402Challenge } from './challenge.js'
import { evidenceHash } from './canonical.js'
import type {
  CheckResult,
  CheckStatus,
  PaymentRequirement,
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
  return evaluate(observation, RULE_SET_VERSION, true)
}

export function evaluatePreflightForRuleSet(
  observation: PreflightObservation,
  ruleSetVersion: string,
): ScanReport {
  if (ruleSetVersion === LEGACY_RULE_SET_VERSION) {
    return evaluate(observation, LEGACY_RULE_SET_VERSION, false)
  }
  if (ruleSetVersion === RULE_SET_VERSION) return evaluatePreflight(observation)
  throw new Error(`Unsupported rule set: ${ruleSetVersion}`)
}

export function evaluatePreflightV1(observation: PreflightObservation): ScanReport {
  return evaluate(observation, LEGACY_RULE_SET_VERSION, false)
}

function evaluate(
  observation: PreflightObservation,
  ruleSetVersion: string,
  requireLiveXLayerEvidence: boolean,
): ScanReport {
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
    evaluatePaymentTerms(
      challenge,
      compatible,
      observation.xLayerEvidence,
      requireLiveXLayerEvidence,
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
    ruleSetVersion,
  }
  return {
    ruleSetVersion,
    target: observation.target,
    checkedAt: observation.checkedAt,
    latencyMs: observation.latencyMs,
    verdict,
    verdictLabel: verdictLabels[verdict],
    checks,
    evidenceHash: evidenceHash(evidence),
  }
}

function evaluatePaymentTerms(
  challenge: ReturnType<typeof parseX402Challenge>,
  compatible: PaymentRequirement[] | undefined,
  xLayerEvidence: PreflightObservation['xLayerEvidence'],
  requireLiveXLayerEvidence: boolean,
): CheckResult {
  const expected = {
    network: X_LAYER_NETWORK,
    chainId: X_LAYER_CHAIN_ID,
    assets: [...SUPPORTED_ASSETS],
    schemes: [...X_LAYER_PAYMENT_SCHEMES],
  }
  if (!compatible || compatible.length === 0) {
    return check(
      'payment_terms',
      'X Layer payment terms',
      'fail',
      'No supported X Layer asset found.',
      {
        expected,
        observed: challenge?.accepts.map(({ network, asset }) => ({ network, asset })),
      },
    )
  }

  const advertised = compatible.map(({ network, asset, scheme }) => ({
    network,
    asset,
    scheme,
  }))
  if (!requireLiveXLayerEvidence) {
    return check(
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
        observed: advertised,
      },
    )
  }
  if (!xLayerEvidence || xLayerEvidence.error) {
    return check(
      'payment_terms',
      'X Layer payment terms',
      'warning',
      'Supported terms found, but live X Layer state could not be verified.',
      { expected, observed: { advertised, rpc: xLayerEvidence ?? 'Unavailable' } },
    )
  }

  const evidenceByAddress = new Map(
    xLayerEvidence.assets.map((asset) => [asset.address.toLowerCase(), asset]),
  )
  const assetsVerified = compatible.every(({ asset }) => {
    const evidence = evidenceByAddress.get(asset.toLowerCase())
    const metadata = assetMetadata(asset)
    return (
      evidence !== undefined &&
      metadata !== undefined &&
      evidence.contractCodeHash.length === 64 &&
      normalizeSymbol(evidence.symbol) === normalizeSymbol(metadata.symbol) &&
      evidence.decimals === metadata.decimals
    )
  })
  const chainVerified = xLayerEvidence.chainId === X_LAYER_CHAIN_ID
  return check(
    'payment_terms',
    'X Layer payment terms',
    chainVerified && assetsVerified ? 'pass' : 'fail',
    chainVerified && assetsVerified
      ? 'Payment terms match live X Layer chain and token-contract evidence.'
      : 'Advertised payment terms do not match live X Layer evidence.',
    {
      expected,
      observed: {
        advertised,
        rpc: xLayerEvidence,
      },
    },
  )
}

function assetMetadata(
  address: string,
): { symbol: string; decimals: number } | undefined {
  const normalized = address.toLowerCase()
  return Object.entries(X_LAYER_ASSET_METADATA).find(
    ([asset]) => asset.toLowerCase() === normalized,
  )?.[1]
}

function normalizeSymbol(symbol: string): string {
  return symbol.normalize('NFKC').replaceAll('₮', 'T').replaceAll('₀', '0').toUpperCase()
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
