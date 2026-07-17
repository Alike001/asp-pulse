import { randomUUID } from 'node:crypto'
import {
  evaluatePreflight,
  parseX402Challenge,
  SUPPORTED_ASSETS,
  X_LAYER_NETWORK,
} from '@asp-pulse/core'
import { probeEndpoint, type ProbeDependencies } from './probe.js'
import type { ScanStore, StoredScan } from './store.js'
import {
  createXLayerEvidenceCollector,
  type CollectXLayerEvidence,
  type XLayerRpcDependencies,
} from './xlayer-rpc.js'

export interface ScanServiceDependencies
  extends ProbeDependencies, XLayerRpcDependencies {
  store: ScanStore
  createId?: () => string
  collectXLayerEvidence?: CollectXLayerEvidence
}

export interface ScanService {
  scan(target: string): Promise<StoredScan>
}

export function createScanService({
  store,
  createId = randomUUID,
  collectXLayerEvidence,
  xLayerFetchImpl,
  xLayerRpcUrls,
  xLayerNow,
  ...probeDependencies
}: ScanServiceDependencies): ScanService {
  const rpcDependencies: XLayerRpcDependencies = {}
  if (xLayerFetchImpl !== undefined) rpcDependencies.xLayerFetchImpl = xLayerFetchImpl
  if (xLayerRpcUrls !== undefined) rpcDependencies.xLayerRpcUrls = xLayerRpcUrls
  if (xLayerNow !== undefined) rpcDependencies.xLayerNow = xLayerNow
  const collectEvidence =
    collectXLayerEvidence ?? createXLayerEvidenceCollector(rpcDependencies)
  return {
    async scan(target: string): Promise<StoredScan> {
      const observation = await probeEndpoint(target, probeDependencies)
      const challenge = parseX402Challenge(observation.challengeBody)
      const assets =
        challenge?.accepts
          .filter(
            ({ network, asset }) =>
              network === X_LAYER_NETWORK && SUPPORTED_ASSETS.has(asset.toLowerCase()),
          )
          .map(({ asset }) => asset) ?? []
      const evidence =
        assets.length > 0
          ? { ...observation, xLayerEvidence: await collectEvidence(assets) }
          : observation
      const scan = {
        id: createId(),
        evidence,
        report: evaluatePreflight(evidence),
      }
      await store.save(scan)
      return scan
    },
  }
}
