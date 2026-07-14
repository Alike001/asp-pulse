import {
  evaluatePreflight,
  RULE_SET_VERSION,
  X_LAYER_ASSETS,
  X_LAYER_NETWORK,
} from '@asp-pulse/core'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createMcpHandler } from './mcp.js'
import { type ProbeDependencies } from './probe.js'
import { createScanService } from './scan-service.js'
import { MemoryScanStore, type ScanStore } from './store.js'

export interface AppDependencies extends ProbeDependencies {
  store?: ScanStore
  createId?: () => string
}

export function createApp(dependencies: AppDependencies = {}): Hono {
  const app = new Hono()
  const store = dependencies.store ?? new MemoryScanStore()
  const scanService = createScanService({
    ...dependencies,
    store,
  })
  const mcpHandler = createMcpHandler(scanService)

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
    const callable = reports.filter((report) =>
      ['verified', 'preflight_verified'].includes(report.verdict),
    ).length
    return context.json({
      servicesChecked: reports.length,
      callable,
      x402Failures: reports.filter((report) => report.verdict === 'invalid').length,
      priceMismatches: reports.filter(
        (report) => report.checks.find(({ id }) => id === 'price')?.status === 'fail',
      ).length,
      medianLatencyMs: median(reports.map(({ latencyMs }) => latencyMs)),
      lastUpdated: reports[0]?.checkedAt ?? null,
    })
  })

  app.get('/v1/config', (context) =>
    context.json({
      ruleSetVersion: RULE_SET_VERSION,
      xLayerNetwork: X_LAYER_NETWORK,
      supportedAssets: X_LAYER_ASSETS,
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
      return context.json(await scanService.scan(body.target), 201)
    } catch (error) {
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
    const report = evaluatePreflight(scan.evidence)
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
