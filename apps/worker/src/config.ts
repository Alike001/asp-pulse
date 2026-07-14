export interface CanaryConfig {
  enabled: boolean
  dailyBudgetAtomic: bigint
  perCallLimitAtomic: bigint
  allowlistedHosts: Set<string>
}

export function loadCanaryConfig(
  environment: NodeJS.ProcessEnv = process.env,
): CanaryConfig {
  return {
    enabled: environment.ENABLE_PAID_CANARY === 'true',
    dailyBudgetAtomic: BigInt(environment.CANARY_DAILY_BUDGET_ATOMIC ?? '0'),
    perCallLimitAtomic: BigInt(environment.CANARY_PER_CALL_LIMIT_ATOMIC ?? '0'),
    allowlistedHosts: new Set(
      (environment.CANARY_ALLOWLIST ?? '')
        .split(',')
        .map((host) => host.trim().toLowerCase())
        .filter(Boolean),
    ),
  }
}

export function assertCanaryMayPay(
  target: URL,
  amountAtomic: bigint,
  spentTodayAtomic: bigint,
  config: CanaryConfig,
): void {
  if (!config.enabled) throw new Error('Paid canary is disabled.')
  if (!config.allowlistedHosts.has(target.hostname.toLowerCase())) {
    throw new Error('Target is not on the paid-canary allowlist.')
  }
  if (amountAtomic <= 0n || amountAtomic > config.perCallLimitAtomic) {
    throw new Error('Payment exceeds the per-call canary limit.')
  }
  if (spentTodayAtomic + amountAtomic > config.dailyBudgetAtomic) {
    throw new Error('Payment exceeds the daily canary budget.')
  }
}
