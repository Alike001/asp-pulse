import type { NetworkPulse, StoredScan } from './types'

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787'

async function decode<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { error?: string }
  if (!response.ok)
    throw new Error(body.error ?? 'ASP Pulse could not complete the request.')
  return body
}

export async function createScan(target: string): Promise<StoredScan> {
  const response = await fetch(`${API_URL}/v1/scans`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ target }),
  })
  return decode<StoredScan>(response)
}

export async function getNetworkPulse(): Promise<NetworkPulse> {
  return decode<NetworkPulse>(await fetch(`${API_URL}/v1/network`))
}

export async function getRecentScans(): Promise<StoredScan[]> {
  const result = await decode<{ scans: StoredScan[] }>(await fetch(`${API_URL}/v1/scans`))
  return result.scans
}

export async function getScan(id: string): Promise<StoredScan> {
  return decode<StoredScan>(await fetch(`${API_URL}/v1/scans/${encodeURIComponent(id)}`))
}
