import { describe, expect, it } from 'vitest'
import { evaluatePreflight, X_LAYER_ASSETS } from '@asp-pulse/core'
import { PostgresScanStore, type PostgresClient } from '../src/postgres-store.js'
import { createConfiguredScanStore } from '../src/store-factory.js'

class InMemoryPostgres implements PostgresClient {
  readonly statements: Array<{ statement: string; parameters: unknown[] }> = []
  readonly rows = new Map<string, Record<string, unknown>>()

  async query(
    statement: string,
    parameters: unknown[] = [],
  ): Promise<Record<string, unknown>[]> {
    this.statements.push({ statement, parameters })
    if (statement.startsWith('INSERT INTO scans')) {
      const [id, checkedAt, report, evidence] = parameters as [
        string,
        string,
        string,
        string,
      ]
      this.rows.set(id, {
        id,
        checked_at: checkedAt,
        report_json: report,
        evidence_json: evidence,
      })
      return []
    }
    if (statement.includes('WHERE id = $1')) {
      const row = this.rows.get(parameters[0] as string)
      return row ? [row] : []
    }
    if (statement.includes('ORDER BY checked_at DESC')) {
      const limit = parameters[0] as number
      return [...this.rows.values()]
        .sort((left, right) =>
          String(right.checked_at).localeCompare(String(left.checked_at)),
        )
        .slice(0, limit)
    }
    return []
  }
}

describe('Postgres scan store', () => {
  it('refuses temporary storage on Vercel', async () => {
    await expect(createConfiguredScanStore({ VERCEL: '1' })).rejects.toThrow(
      'DATABASE_URL is required when ASP Pulse runs on Vercel.',
    )
  })

  it('persists evidence and uses bound query parameters', async () => {
    const client = new InMemoryPostgres()
    const store = new PostgresScanStore(client)
    await store.initialize()
    const evidence = {
      target: 'https://provider.example/service',
      checkedAt: '2026-07-14T12:00:00.000Z',
      latencyMs: 42,
      httpStatus: 402,
      challengeBody: {
        x402Version: 2,
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:196',
            amount: '500',
            payTo: '0x0000000000000000000000000000000000000001',
            asset: X_LAYER_ASSETS.USDG,
          },
        ],
      },
    }
    const report = evaluatePreflight(evidence)

    await store.save({ id: 'stored-1', report, evidence })

    expect(await store.find('stored-1')).toMatchObject({
      id: 'stored-1',
      report: { evidenceHash: report.evidenceHash },
      evidence,
    })
    expect((await store.recent(25))[0]?.id).toBe('stored-1')
    const insert = client.statements.find(({ statement }) =>
      statement.startsWith('INSERT'),
    )
    expect(insert?.parameters).toHaveLength(4)
    expect(insert?.statement).toContain('$1')
  })
})
