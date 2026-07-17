import {
  evaluatePreflightForRuleSet,
  RULE_SET_VERSION,
  X_LAYER_ASSETS,
  X_LAYER_NETWORK,
} from '@asp-pulse/core'
import { createHash } from 'node:crypto'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createMcpHandler } from './mcp.js'
import { type ProbeDependencies } from './probe.js'
import { createScanService } from './scan-service.js'
import { MemoryScanStore, type ScanStore } from './store.js'
import {
  X_LAYER_RPC_URLS,
  type CollectXLayerEvidence,
  type XLayerRpcDependencies,
} from './xlayer-rpc.js'

export interface AppDependencies extends ProbeDependencies, XLayerRpcDependencies {
  store?: ScanStore
  createId?: () => string
  scanLimit?: number
  scanLimitWindowMs?: number
  retentionDays?: number
  collectXLayerEvidence?: CollectXLayerEvidence
}

export function createApp(dependencies: AppDependencies = {}): Hono {
  const app = new Hono()
  const store = dependencies.store ?? new MemoryScanStore()
  const now = dependencies.now ?? Date.now
  const scanLimit = dependencies.scanLimit ?? 30
  const scanLimitWindowMs = dependencies.scanLimitWindowMs ?? 60 * 60 * 1_000
  const retentionDays = dependencies.retentionDays ?? 30
  let lastPrunedAt = Number.NEGATIVE_INFINITY
  const scanService = createScanService({
    ...dependencies,
    store,
  })
  const guardedScanService = (request: Request) => ({
    scan: async (target: string) => {
      const timestamp = now()
      const windowStartedAt = timestamp - (timestamp % scanLimitWindowMs)
      const allowance = await store.consumeScanAllowance({
        bucket: requestBucket(request),
        windowStartedAt,
        limit: scanLimit,
      })
      if (!allowance.allowed) {
        throw new ScanRateLimitError(
          'Scan limit reached. Try again after the current hour window resets.',
          Math.ceil((windowStartedAt + scanLimitWindowMs - timestamp) / 1_000),
        )
      }
      if (timestamp - lastPrunedAt >= scanLimitWindowMs) {
        await store.prune(
          new Date(timestamp - retentionDays * 24 * 60 * 60 * 1_000).toISOString(),
        )
        lastPrunedAt = timestamp
      }
      return scanService.scan(target)
    },
  })
  const mcpHandler = createMcpHandler(guardedScanService)

  app.use('/v1/*', cors({ origin: '*', allowMethods: ['GET', 'POST', 'OPTIONS'] }))
  app.use(
    '/mcp',
    cors({
      origin: '*',
      allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowHeaders: [
        'Content-Type',
        'Mcp-Protocol-Version',
        'Mcp-Session-Id',
        'Last-Event-ID',
      ],
      exposeHeaders: ['Mcp-Protocol-Version', 'Mcp-Session-Id'],
    }),
  )

  app.get('/health', (context) =>
    context.json({ status: 'ok', ruleSetVersion: RULE_SET_VERSION }),
  )

  app.get('/llms.txt', (context) =>
    context.text(
      [
        '# ASP Pulse',
        '',
        'Deterministic pre-payment health checks for OKX.AI and x402 services.',
        '',
        'POST /v1/scans — submit {"target":"https://..."} for a free GET-only preflight.',
        'GET /v1/scans/:id — retrieve a stored report and evidence hash.',
        'GET /v1/scans/:id/verify — recompute the stored evidence and compare its receipt.',
        'GET /v1/network — aggregates derived only from captured scans.',
        '',
        'Supported payment terms are checked against read-only X Layer RPC evidence.',
        'The free preflight never sends payment. Protected delivery remains not tested.',
      ].join('\n'),
    ),
  )

  app.get('/discover', (context) =>
    context.json({
      name: 'ASP Pulse',
      description: 'Deterministic pre-payment health checks for x402 service endpoints.',
      services: [
        {
          id: 'preflight',
          method: 'POST',
          path: '/v1/scans',
          payment: 'free',
          input: { target: 'Complete HTTPS URL of a public x402 GET endpoint' },
        },
      ],
    }),
  )

  app.get('/v1/network', async (context) => {
    const scans = await store.recent(100)
    const latestByTarget = new Map<string, (typeof scans)[number]['report']>()
    for (const { report } of scans) {
      if (!latestByTarget.has(report.target)) latestByTarget.set(report.target, report)
    }
    const reports = [...latestByTarget.values()]
    const passingPreflights = reports.filter(
      (report) => report.verdict === 'preflight_verified',
    ).length
    const priceChecksRun = reports.filter(
      (report) => report.checks.find(({ id }) => id === 'price')?.status !== 'not_tested',
    ).length
    return context.json({
      servicesChecked: reports.length,
      callable: passingPreflights,
      x402Failures: reports.filter((report) => report.verdict === 'invalid').length,
      priceChecksRun,
      medianLatencyMs: median(reports.map(({ latencyMs }) => latencyMs)),
      lastUpdated: reports[0]?.checkedAt ?? null,
    })
  })

  app.get('/v1/config', (context) =>
    context.json({
      ruleSetVersion: RULE_SET_VERSION,
      xLayerNetwork: X_LAYER_NETWORK,
      supportedAssets: X_LAYER_ASSETS,
      xLayerEvidence: {
        mode: 'read-only',
        rpcUrls: X_LAYER_RPC_URLS,
      },
      paidCanaryEnabled: false,
    }),
  )

  app.post('/v1/scans', async (context) => {
    const body: { target?: unknown } = await context.req
      .json<{ target?: unknown }>()
      .catch(() => ({}))
    if (typeof body.target !== 'string' || body.target.length > 2_048) {
      return context.json({ error: 'A valid endpoint is required.' }, 400)
    }
    try {
      return context.json(
        await guardedScanService(context.req.raw).scan(body.target),
        201,
      )
    } catch (error) {
      if (error instanceof ScanRateLimitError) {
        context.header('Retry-After', String(error.retryAfterSeconds))
        return context.json({ error: error.message }, 429)
      }
      return context.json(
        {
          error:
            error instanceof Error ? error.message : 'The endpoint could not be checked.',
        },
        400,
      )
    }
  })

  app.get('/v1/scans', async (context) => context.json({ scans: await store.recent(25) }))

  app.get('/v1/scans/:id/evidence', async (context) => {
    const scan = await store.find(context.req.param('id'))
    if (!scan) return context.json({ error: 'Scan not found.' }, 404)
    if (!scan.evidence)
      return context.json({ error: 'Evidence unavailable for this legacy scan.' }, 409)
    return context.json({ id: scan.id, evidence: scan.evidence })
  })

  app.get('/v1/scans/:id/verify', async (context) => {
    const scan = await store.find(context.req.param('id'))
    if (!scan) return context.json({ error: 'Scan not found.' }, 404)
    if (!scan.evidence)
      return context.json({ error: 'Evidence unavailable for this legacy scan.' }, 409)
    const report = evaluatePreflightForRuleSet(scan.evidence, scan.report.ruleSetVersion)
    return context.json({
      id: scan.id,
      valid: report.evidenceHash === scan.report.evidenceHash,
      report,
    })
  })

  app.get('/v1/scans/:id', async (context) => {
    const scan = await store.find(context.req.param('id'))
    return scan ? context.json(scan) : context.json({ error: 'Scan not found.' }, 404)
  })

  app.all('/mcp', (context) => mcpHandler(context.req.raw))

  return app
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  const current = sorted[middle]
  if (current === undefined) return null
  if (sorted.length % 2 === 1) return current
  return Math.round(((sorted[middle - 1] ?? current) + current) / 2)
}

class ScanRateLimitError extends Error {
  constructor(
    message: string,
    readonly retryAfterSeconds: number,
  ) {
    super(message)
  }
}

function requestBucket(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const source =
    forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
  return createHash('sha256').update(`scan-limit-v2:${source}`).digest('hex')
}
