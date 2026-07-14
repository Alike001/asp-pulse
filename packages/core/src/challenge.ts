import type { PaymentRequirement, X402Challenge } from './types.js'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function parseRequirement(value: unknown): PaymentRequirement | undefined {
  if (!isRecord(value)) return undefined

  const scheme = readString(value.scheme)
  const network = readString(value.network)
  const amount = readString(value.amount)
  const payTo = readString(value.payTo)
  const asset = readString(value.asset)

  if (!scheme || !network || !amount || !payTo || !asset) return undefined

  const requirement: PaymentRequirement = { scheme, network, amount, payTo, asset }
  if (typeof value.maxTimeoutSeconds === 'number') {
    requirement.maxTimeoutSeconds = value.maxTimeoutSeconds
  }
  if (isRecord(value.extra)) requirement.extra = value.extra
  return requirement
}

export function parseX402Challenge(value: unknown): X402Challenge | undefined {
  if (!isRecord(value) || typeof value.x402Version !== 'number') return undefined
  if (!Array.isArray(value.accepts)) return undefined

  const accepts = value.accepts
    .map(parseRequirement)
    .filter((item): item is PaymentRequirement => item !== undefined)

  if (accepts.length === 0) return undefined

  const result: X402Challenge = { x402Version: value.x402Version, accepts }
  if (isRecord(value.resource)) {
    const resource: { url?: string; mimeType?: string } = {}
    const url = readString(value.resource.url)
    const mimeType = readString(value.resource.mimeType)
    if (url) resource.url = url
    if (mimeType) resource.mimeType = mimeType
    result.resource = resource
  }
  return result
}
