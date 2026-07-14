'use client'

import { useEffect, useState } from 'react'
import { getScan } from '@/lib/api'
import type { StoredScan } from '@/lib/types'
import { StatusGlyph } from './brand'

export function Report({ id }: { id: string }) {
  const [scan, setScan] = useState<StoredScan>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    getScan(id)
      .then(setScan)
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'Report could not be loaded.')
      })
  }, [id])

  if (error)
    return (
      <div className="report-state">
        <h1>Report unavailable</h1>
        <p>{error}</p>
      </div>
    )
  if (!scan)
    return (
      <div className="report-state">
        <span className="eyebrow">#LOADING EVIDENCE</span>
        <h1>Opening receipt…</h1>
      </div>
    )

  const { report } = scan
  return (
    <div className="report-page">
      <header className={`report-verdict verdict-${report.verdict}`}>
        <div>
          <span className="eyebrow">#DETERMINISTIC VERDICT</span>
          <h1>{report.verdictLabel}</h1>
          <p className="mono">{report.target}</p>
        </div>
        <div className="report-meta mono">
          <span>CHECKED</span>
          <strong>{new Date(report.checkedAt).toLocaleString()}</strong>
          <span>LATENCY</span>
          <strong>{report.latencyMs} ms</strong>
        </div>
      </header>
      <section className="report-checks">
        {report.checks.map((check, index) => (
          <article key={check.id} className={`status-${check.status}`}>
            <div className="report-check-head">
              <span className="mono">0{index + 1}</span>
              <StatusGlyph status={check.status} />
              <h2>{check.label}</h2>
              <strong>{check.status.replace('_', ' ')}</strong>
            </div>
            <p>{check.summary}</p>
            {(check.expected !== undefined || check.observed !== undefined) && (
              <div className="evidence-values mono">
                <div>
                  <span>EXPECTED</span>
                  <pre>{format(check.expected)}</pre>
                </div>
                <div>
                  <span>OBSERVED</span>
                  <pre>{format(check.observed)}</pre>
                </div>
              </div>
            )}
          </article>
        ))}
      </section>
      <section className="receipt-panel mono">
        <div>
          <span>RULE SET</span>
          <strong>{report.ruleSetVersion}</strong>
        </div>
        <div>
          <span>SHA-256 EVIDENCE RECEIPT</span>
          <strong>{report.evidenceHash}</strong>
        </div>
        <p>
          This receipt is generated from canonicalized input evidence. Replaying identical
          evidence through this rule set produces the same hash and verdict.
        </p>
      </section>
    </div>
  )
}

function format(value: unknown): string {
  if (value === undefined) return 'Not supplied'
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}
