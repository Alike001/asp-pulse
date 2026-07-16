export const CHECK_IDS = [
  'discovery',
  'reachability',
  'x402_challenge',
  'payment_terms',
  'price',
  'response_contract',
] as const

export type CheckId = (typeof CHECK_IDS)[number]
export type CheckStatus = 'pass' | 'warning' | 'fail' | 'not_tested'
export type Verdict = 'preflight_verified' | 'degraded' | 'invalid'

export interface PaymentRequirement {
  scheme: string
  network: string
  amount: string
  payTo: string
  asset: string
  maxTimeoutSeconds?: number
  extra?: Record<string, unknown>
}

export interface X402Challenge {
  x402Version: number
  resource?: {
    url?: string
    mimeType?: string
  }
  accepts: PaymentRequirement[]
}

export interface PreflightObservation {
  target: string
  checkedAt: string
  latencyMs: number
  httpStatus?: number
  challengeBody?: unknown
  error?: string
}

export interface CheckResult {
  id: CheckId
  label: string
  status: CheckStatus
  summary: string
  expected?: unknown
  observed?: unknown
}

export interface ScanReport {
  ruleSetVersion: string
  target: string
  checkedAt: string
  latencyMs: number
  verdict: Verdict
  verdictLabel: string
  checks: CheckResult[]
  evidenceHash: string
}
