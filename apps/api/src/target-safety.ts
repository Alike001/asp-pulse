import { isIP } from 'node:net'
import { lookup } from 'node:dns/promises'

export interface ResolvedAddress {
  address: string
  family: 4 | 6
}

export type HostResolver = (hostname: string) => Promise<ResolvedAddress[]>

export interface ValidatedTarget {
  url: URL
  addresses: ResolvedAddress[]
}

const E2E_FIXTURE_TARGET = 'http://127.0.0.1:8788/x402'

function isE2eFixtureTarget(input: string): boolean {
  return (
    process.env.PULSE_E2E_FIXTURE === '1' &&
    process.env.VERCEL !== '1' &&
    input === E2E_FIXTURE_TARGET
  )
}

function blockedIpv4(address: string): boolean {
  const octets = address.split('.').map(Number)
  const [a, b = 0, c = 0] = octets
  if (octets.length !== 4 || a === undefined) return true

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  )
}

function blockedIpv6(address: string): boolean {
  const normalized = address.toLowerCase().split('%')[0] ?? ''
  if (normalized === '::' || normalized === '::1') return true
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true
  if (/^fe[89ab]/.test(normalized)) return true
  if (normalized.startsWith('2001:db8:')) return true

  const mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1]
  return mapped ? blockedIpv4(mapped) : false
}

export function isBlockedAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) return blockedIpv4(address)
  if (family === 6) return blockedIpv6(address)
  return true
}

export const systemResolver: HostResolver = async (hostname) =>
  (await lookup(hostname, { all: true, verbatim: true })).flatMap(
    ({ address, family }) => (family === 4 || family === 6 ? [{ address, family }] : []),
  )

export async function validatePublicTarget(
  input: string,
  resolveHost: HostResolver = systemResolver,
): Promise<ValidatedTarget> {
  let target: URL
  try {
    target = new URL(input)
  } catch {
    throw new Error('Enter a complete HTTPS endpoint.')
  }

  if (isE2eFixtureTarget(input)) {
    return { url: target, addresses: [{ address: '127.0.0.1', family: 4 }] }
  }

  if (target.protocol !== 'https:') {
    throw new Error('Only public HTTPS endpoints can be checked.')
  }
  if (target.username || target.password) {
    throw new Error('Endpoints with embedded credentials are not allowed.')
  }
  if (target.port && target.port !== '443') {
    throw new Error('Only the standard HTTPS port is allowed.')
  }

  const literalFamily = isIP(target.hostname)
  const addresses = literalFamily
    ? [{ address: target.hostname, family: literalFamily as 4 | 6 }]
    : await resolveHost(target.hostname)

  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => isBlockedAddress(address))
  ) {
    throw new Error('Private, local, and reserved network targets are not allowed.')
  }
  return { url: target, addresses }
}
