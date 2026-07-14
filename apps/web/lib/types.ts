export type CheckStatus = 'pass' | 'warning' | 'fail' | 'not_tested'

export interface CheckResult {
  id: string
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
  verdict: 'verified' | 'preflight_verified' | 'degraded' | 'invalid'
  verdictLabel: string
  checks: CheckResult[]
  evidenceHash: string
}

export interface StoredScan {
  id: string
  report: ScanReport
}

export interface ScanVerification {
  id: string
  valid: boolean
  report: ScanReport
}

export interface NetworkPulse {
  servicesChecked: number
  callable: number
  x402Failures: number
  priceMismatches: number
  medianLatencyMs: number | null
  lastUpdated: string | null
}
