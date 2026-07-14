export const RULE_SET_VERSION = 'PULSE-RULESET/1.0.0'
export const X402_VERSION = 2
export const X_LAYER_NETWORK = 'eip155:196'
export const X_LAYER_PAYMENT_SCHEMES = new Set(['exact', 'aggr_deferred'])

export const X_LAYER_ASSETS = {
  USDG: '0x4ae46a509f6b1d9056937ba4500cb143933d2dc8',
  USDT0: '0x779ded0c9e1022225f8e0630b35a9b54be713736',
} as const

export const SUPPORTED_ASSETS = new Set(
  Object.values(X_LAYER_ASSETS).map((address) => address.toLowerCase()),
)
