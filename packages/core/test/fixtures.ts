import { X_LAYER_ASSETS, X_LAYER_NETWORK } from '../src/constants.js'

export function validChallenge(overrides: Record<string, unknown> = {}) {
  return {
    x402Version: 2,
    resource: {
      url: 'https://provider.example/check',
      mimeType: 'application/json',
    },
    accepts: [
      {
        scheme: 'exact',
        network: X_LAYER_NETWORK,
        amount: '500',
        payTo: '0x0dedc3c5e15bee45166924ea5b02f54a35b1f9c6',
        asset: X_LAYER_ASSETS.USDG,
        maxTimeoutSeconds: 300,
      },
    ],
    ...overrides,
  }
}
