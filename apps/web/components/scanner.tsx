'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'
import { createScan } from '@/lib/api'
import type { StoredScan } from '@/lib/types'
import { StatusGlyph } from './brand'

interface ScannerProps {
  onComplete?: (scan: StoredScan) => void
  compact?: boolean
}

export function Scanner({ onComplete, compact = false }: ScannerProps) {
  const [target, setTarget] = useState('')
  const [scan, setScan] = useState<StoredScan>()
  const [error, setError] = useState<string>()
  const [running, setRunning] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(undefined)
    setRunning(true)
    try {
      const result = await createScan(`https://${target.trim()}`)
      setScan(result)
      onComplete?.(result)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The check failed.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className={`scanner ${compact ? 'scanner-compact' : ''}`} id="scanner">
      {!compact && (
        <div className="console-bar">
          <span>
            <i className="live-dot" />
            Pre-payment check
          </span>
          <span className="mono">X LAYER · 196</span>
        </div>
      )}
      <form onSubmit={submit} className="scan-form">
        <label htmlFor={compact ? 'closing-target' : 'scan-target'}>
          x402 service endpoint
        </label>
        <div className="input-row">
          <span className="protocol">https://</span>
          <input
            id={compact ? 'closing-target' : 'scan-target'}
            value={target}
            onChange={(event) =>
              setTarget(event.target.value.replace(/^https?:\/\//, ''))
            }
            placeholder="service.example.com/paid-route"
            autoComplete="url"
            required
          />
          <button type="submit" disabled={running || !target.trim()}>
            {running ? 'Checking…' : 'Check service'}
          </button>
        </div>
      </form>

      {!compact && (
        <div className="confidence-line">
          <span>✓ No wallet required</span>
          <span>✓ No payment sent</span>
          <span>✓ Replayable result</span>
        </div>
      )}

      {running && (
        <div className="scan-progress" role="status">
          <div className="progress-sweep" />
          <span>Resolving the public target and requesting its payment challenge…</span>
        </div>
      )}
      {error && (
        <p className="scan-error" role="alert">
          {error}
        </p>
      )}
      {!compact && !running && !error && !scan && <ScannerEmpty />}
      {!compact && scan && <ScanSummary scan={scan} />}
    </div>
  )
}

function ScannerEmpty() {
  return (
    <div className="scanner-empty">
      <span className="empty-icon">⌁</span>
      <div>
        <strong>Ready for the first check</strong>
        <p>
          No sample result is shown here. Paste a real public endpoint to create evidence.
        </p>
      </div>
    </div>
  )
}

function ScanSummary({ scan }: { scan: StoredScan }) {
  return (
    <div className={`scan-summary verdict-${scan.report.verdict}`}>
      <div className="summary-head">
        <div>
          <span className="eyebrow">LIVE RESULT</span>
          <h3>{scan.report.verdictLabel}</h3>
        </div>
        <span className="latency mono">{scan.report.latencyMs} ms</span>
      </div>
      <div className="checks-mini">
        {scan.report.checks.map((check) => (
          <div className={`status-${check.status}`} key={check.id}>
            <StatusGlyph status={check.status} />
            <span>{check.label}</span>
          </div>
        ))}
      </div>
      <div className="receipt-row mono">
        <span>#{scan.report.evidenceHash.slice(0, 18)}</span>
        <span>{scan.report.ruleSetVersion}</span>
      </div>
      <Link className="report-link" href={`/scan/${scan.id}`}>
        Open full evidence report →
      </Link>
    </div>
  )
}
