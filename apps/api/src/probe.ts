import type { PreflightObservation } from '@asp-pulse/core'
import { Agent, fetch as undiciFetch, interceptors } from 'undici'
import { validatePublicTarget, type HostResolver } from './target-safety.js'

const MAX_BODY_BYTES = 256_000
const REQUEST_TIMEOUT_MS = 8_000

export interface ProbeDependencies {
  fetchImpl?: typeof fetch
  now?: () => number
  resolveHost?: HostResolver
}

async function readChallenge(response: Response): Promise<unknown> {
  const declaredLength = Number(response.headers.get('content-length') ?? 0)
  if (declaredLength > MAX_BODY_BYTES) {
    throw new Error('Payment challenge exceeded the 256 KB evidence limit.')
  }
  if (!response.body) return undefined

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let bytesRead = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    bytesRead += value.byteLength
    if (bytesRead > MAX_BODY_BYTES) {
      await reader.cancel()
      throw new Error('Payment challenge exceeded the 256 KB evidence limit.')
    }
    chunks.push(value)
  }
  const combined = new Uint8Array(bytesRead)
  let offset = 0
  for (const chunk of chunks) {
    combined.set(chunk, offset)
    offset += chunk.byteLength
  }
  const text = new TextDecoder().decode(combined)
  if (!text) return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

export function decodePaymentRequiredHeader(value: string | null): unknown {
  if (!value || value.length > 32_768) return undefined
  try {
    return JSON.parse(Buffer.from(value, 'base64').toString('utf8')) as unknown
  } catch {
    return undefined
  }
}

export async function probeEndpoint(
  input: string,
  dependencies: ProbeDependencies = {},
): Promise<PreflightObservation> {
  const now = dependencies.now ?? Date.now
  const startedAt = now()
  const checkedAt = new Date(startedAt).toISOString()
  const { url: target, addresses } = await validatePublicTarget(
    input,
    dependencies.resolveHost,
  )
  const request = {
    method: 'GET' as const,
    headers: {
      accept: 'application/json',
      'user-agent': 'ASP-Pulse/0.1 (+https://asppulse.app)',
    },
    redirect: 'manual' as const,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  }
  const dispatcher = dependencies.fetchImpl
    ? undefined
    : new Agent().compose(
        interceptors.dns({
          lookup: (_origin, _options, callback) =>
            callback(
              null,
              addresses.map(({ address, family }) => ({ address, family, ttl: 60 })),
            ),
        }),
      )

  try {
    const response = dependencies.fetchImpl
      ? await dependencies.fetchImpl(target, request)
      : await undiciFetch(target, { ...request, dispatcher: dispatcher! })
    const challenge =
      decodePaymentRequiredHeader(response.headers.get('payment-required')) ??
      (await readChallenge(response as Response))
    return {
      target: target.toString(),
      checkedAt,
      latencyMs: Math.max(0, now() - startedAt),
      httpStatus: response.status,
      challengeBody: challenge,
    }
  } catch (error) {
    return {
      target: target.toString(),
      checkedAt,
      latencyMs: Math.max(0, now() - startedAt),
      error: error instanceof Error ? error.message : 'Endpoint request failed.',
    }
  } finally {
    await dispatcher?.close()
  }
}
