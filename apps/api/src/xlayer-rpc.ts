import { createHash } from 'node:crypto'
import type { XLayerAssetEvidence, XLayerRpcEvidence } from '@asp-pulse/core'

export const X_LAYER_RPC_URLS = [
  'https://rpc.xlayer.tech',
  'https://xlayerrpc.okx.com',
] as const
const RPC_TIMEOUT_MS = 7_000
const CACHE_TTL_MS = 30_000
const ERROR_CACHE_TTL_MS = 10_000
const DECIMALS_SELECTOR = '0x313ce567'
const SYMBOL_SELECTOR = '0x95d89b41'

interface RpcResponse {
  id?: number
  result?: unknown
  error?: { message?: string }
}

export interface XLayerRpcDependencies {
  xLayerFetchImpl?: typeof fetch
  xLayerRpcUrls?: readonly string[]
  xLayerNow?: () => number
}

export type CollectXLayerEvidence = (
  assetAddresses: readonly string[],
) => Promise<XLayerRpcEvidence>

export function createXLayerEvidenceCollector(
  dependencies: XLayerRpcDependencies = {},
): CollectXLayerEvidence {
  const fetchImpl = dependencies.xLayerFetchImpl ?? fetch
  const rpcUrls = dependencies.xLayerRpcUrls ?? X_LAYER_RPC_URLS
  const now = dependencies.xLayerNow ?? Date.now
  const cache = new Map<string, { expiresAt: number; evidence: XLayerRpcEvidence }>()

  return async (assetAddresses) => {
    const addresses = [...new Set(assetAddresses.map((address) => address.toLowerCase()))]
      .sort()
      .slice(0, 2)
    const key = addresses.join(',')
    const cached = cache.get(key)
    if (cached && cached.expiresAt > now()) return cached.evidence

    const errors: string[] = []
    for (const rpcUrl of rpcUrls) {
      try {
        const evidence = await queryRpc(fetchImpl, rpcUrl, addresses)
        cache.set(key, { expiresAt: now() + CACHE_TTL_MS, evidence })
        return evidence
      } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Unknown RPC failure')
      }
    }
    const evidence = {
      rpcUrl: rpcUrls.join(', '),
      chainId: 0,
      blockNumber: 0,
      assets: [],
      error: `Live X Layer evidence unavailable: ${errors.join('; ')}`,
    }
    cache.set(key, { expiresAt: now() + ERROR_CACHE_TTL_MS, evidence })
    return evidence
  }
}

async function queryRpc(
  fetchImpl: typeof fetch,
  rpcUrl: string,
  addresses: readonly string[],
): Promise<XLayerRpcEvidence> {
  const signal = AbortSignal.timeout(RPC_TIMEOUT_MS)
  const head = await postBatch(
    fetchImpl,
    rpcUrl,
    [rpcCall(1, 'eth_chainId', []), rpcCall(2, 'eth_blockNumber', [])],
    signal,
  )
  const chainId = readHexNumber(result(head, 1), 'chain ID')
  const blockHex = readHex(result(head, 2), 'block number')
  const blockNumber = readHexNumber(blockHex, 'block number')
  const calls: Array<Record<string, unknown>> = []
  addresses.forEach((address, index) => {
    const base = 10 + index * 3
    calls.push(
      rpcCall(base, 'eth_getCode', [address, blockHex]),
      rpcCall(base + 1, 'eth_call', [{ to: address, data: SYMBOL_SELECTOR }, blockHex]),
      rpcCall(base + 2, 'eth_call', [{ to: address, data: DECIMALS_SELECTOR }, blockHex]),
    )
  })
  const byId = await postBatch(fetchImpl, rpcUrl, calls, signal)
  const assets: XLayerAssetEvidence[] = addresses.map((address, index) => {
    const base = 10 + index * 3
    const code = readHex(result(byId, base), 'contract bytecode')
    if (code === '0x') throw new Error(`${rpcUrl} found no contract at ${address}`)
    return {
      address,
      contractCodeHash: createHash('sha256')
        .update(Buffer.from(code.slice(2), 'hex'))
        .digest('hex'),
      symbol: decodeAbiString(readHex(result(byId, base + 1), 'token symbol')),
      decimals: readHexNumber(result(byId, base + 2), 'token decimals'),
    }
  })
  return { rpcUrl, chainId, blockNumber, assets }
}

async function postBatch(
  fetchImpl: typeof fetch,
  rpcUrl: string,
  calls: Array<Record<string, unknown>>,
  signal: AbortSignal,
): Promise<Map<number, RpcResponse>> {
  const response = await fetchImpl(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(calls),
    signal,
  })
  if (!response.ok) throw new Error(`${rpcUrl} returned HTTP ${response.status}`)
  const payload = (await response.json()) as unknown
  if (!Array.isArray(payload)) throw new Error(`${rpcUrl} returned a malformed response`)
  const byId = new Map<number, RpcResponse>()
  for (const item of payload as RpcResponse[]) {
    if (typeof item.id === 'number') byId.set(item.id, item)
  }
  return byId
}

function rpcCall(id: number, method: string, params: unknown[]): Record<string, unknown> {
  return { jsonrpc: '2.0', id, method, params }
}

function result(responses: Map<number, RpcResponse>, id: number): unknown {
  const response = responses.get(id)
  if (!response) throw new Error(`X Layer RPC response ${id} is missing`)
  if (response.error) throw new Error(response.error.message ?? `X Layer RPC error ${id}`)
  return response.result
}

function readHex(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^0x[\da-f]*$/i.test(value)) {
    throw new Error(`X Layer RPC returned an invalid ${label}`)
  }
  return value
}

function readHexNumber(value: unknown, label: string): number {
  const hex = readHex(value, label)
  const parsed = Number.parseInt(hex.slice(2) || '0', 16)
  if (!Number.isSafeInteger(parsed)) throw new Error(`X Layer RPC ${label} is unsafe`)
  return parsed
}

function decodeAbiString(value: string): string {
  const bytes = Buffer.from(value.slice(2), 'hex')
  if (bytes.length === 32) return bytes.toString('utf8').replace(/\0+$/u, '')
  if (bytes.length < 64) throw new Error('X Layer RPC returned an invalid token symbol')
  const offset = Number(BigInt(`0x${bytes.subarray(0, 32).toString('hex')}`))
  if (!Number.isSafeInteger(offset) || offset + 32 > bytes.length) {
    throw new Error('X Layer RPC returned an invalid token symbol offset')
  }
  const length = Number(
    BigInt(`0x${bytes.subarray(offset, offset + 32).toString('hex')}`),
  )
  if (
    !Number.isSafeInteger(length) ||
    offset + 32 + length > bytes.length ||
    length > 64
  ) {
    throw new Error('X Layer RPC returned an invalid token symbol length')
  }
  return bytes.subarray(offset + 32, offset + 32 + length).toString('utf8')
}
