'use client'

import { useEffect, useState } from 'react'
import { getNetworkPulse, getRecentScans } from '@/lib/api'
import type { NetworkPulse, StoredScan } from '@/lib/types'
import { Scanner } from './scanner'
import { SiteHeader } from './site-header'
import { StatusGlyph } from './brand'

const checkCopy = [
  ['01', 'Discovery metadata', 'Can the service describe what it offers?'],
  ['02', 'Endpoint reachability', 'Does the route answer with a payment challenge now?'],
  ['03', 'x402 challenge', 'Is it valid version 2 and bound to this endpoint?'],
  [
    '04',
    'X Layer payment terms',
    'Does it name chain 196, a supported scheme and asset?',
  ],
  ['05', 'Advertised price', 'Does the live price match the listing?'],
  ['06', 'Protected response', 'Did a paid canary deliver the promised schema?'],
]

export function Landing() {
  const [pulse, setPulse] = useState<NetworkPulse>()
  const [recent, setRecent] = useState<StoredScan[]>([])

  useEffect(() => {
    Promise.all([getNetworkPulse(), getRecentScans()])
      .then(([network, scans]) => {
        setPulse(network)
        setRecent(scans)
      })
      .catch(() => undefined)
  }, [])

  function addScan(scan: StoredScan) {
    setRecent((current) =>
      [scan, ...current.filter(({ id }) => id !== scan.id)].slice(0, 25),
    )
    getNetworkPulse()
      .then(setPulse)
      .catch(() => undefined)
  }

  const latestVerifiedTarget = recent.find(
    ({ report }) => report.verdict === 'preflight_verified',
  )?.report.target

  return (
    <main>
      <SiteHeader />
      <section className="hero shell">
        <div className="hero-copy">
          <span className="eyebrow">#X LAYER x402 PREFLIGHT</span>
          <h1>
            Know before
            <br />
            you pay.
          </h1>
          <p>
            Verify that an x402 service is live, challenge-bound, and offering supported X
            Layer terms before your agent spends.
          </p>
          <a className="text-link" href="#network">
            See recent scan evidence <span>→</span>
          </a>
        </div>
        <div className="hero-product">
          <Scanner
            onComplete={addScan}
            {...(latestVerifiedTarget ? { quickTarget: latestVerifiedTarget } : {})}
          />
        </div>
      </section>

      <NetworkRibbon pulse={pulse} />
      <section className="verification shell section-pad" id="methodology">
        <div className="section-heading">
          <span className="eyebrow">#VERIFICATION</span>
          <h2>
            Three live checks.
            <br />
            Three evidence gates.
          </h2>
          <p>
            Reachability, a bound x402 challenge, and X Layer payment terms run now.
            Registry data and paid delivery remain evidence gates until their sources are
            connected.
          </p>
        </div>
        <div className="check-stack">
          {checkCopy.map(([number, title, description]) => (
            <article key={number}>
              <span className="check-number mono">{number}</span>
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
              <span className="rule-state">Deterministic</span>
            </article>
          ))}
        </div>
      </section>

      <section className="readiness shell section-pad">
        <span className="eyebrow">#RIGHT NOW</span>
        <h2>
          Marketplace ratings show history.
          <br />
          <em>Pulse checks one endpoint.</em>
        </h2>
        <div className="comparison">
          <div>
            <span className="comparison-label">Marketplace reputation</span>
            <strong>Past orders</strong>
            <strong>User reviews</strong>
            <strong>Historical rating</strong>
          </div>
          <div className="comparison-arrow" aria-hidden="true">
            →
          </div>
          <div className="current">
            <span className="comparison-label">Endpoint preflight</span>
            <strong>Current HTTP response</strong>
            <strong>Supported payment terms</strong>
            <strong>Recomputable receipt</strong>
          </div>
        </div>
      </section>

      <RecentScans scans={recent} />
      <section className="method-band">
        <div className="shell method-inner">
          <div>
            <span className="eyebrow">#RECOMPUTABLE RECEIPTS</span>
            <h2>
              No mystery score.
              <br />
              Just observable facts.
            </h2>
          </div>
          <div className="method-card mono">
            <span>RULE SET</span>
            <strong>PULSE-RULESET/1.0.0</strong>
            <p>
              HTTP response · x402 v2 · eip155:196 · supported assets · SHA-256 evidence
            </p>
            <a href="/methodology">Read the methodology →</a>
          </div>
        </div>
      </section>
      <section className="closing shell section-pad">
        <span className="eyebrow">#BEFORE THE NEXT CALL</span>
        <h2>
          Check before your
          <br />
          agent spends.
        </h2>
        <Scanner compact />
      </section>
      <Footer />
    </main>
  )
}

function NetworkRibbon({ pulse }: { pulse: NetworkPulse | undefined }) {
  const values = [
    ['Endpoints sampled', pulse?.servicesChecked],
    ['Passing preflights', pulse?.callable],
    ['x402 failures', pulse?.x402Failures],
    ['Price mismatches', pulse?.priceMismatches],
    [
      'Median latency',
      pulse?.medianLatencyMs == null ? undefined : `${pulse.medianLatencyMs} ms`,
    ],
  ]
  return (
    <section className="network-ribbon" id="network">
      <div className="shell ribbon-inner">
        <div className="ribbon-title">
          <i className="live-dot" />
          <span>RECENT SCAN EVIDENCE</span>
        </div>
        {values.map(([label, value]) => (
          <div className="metric" key={label}>
            <strong>{value ?? '—'}</strong>
            <span>{label}</span>
          </div>
        ))}
        <div className="updated mono">
          UPDATED
          <br />
          {pulse?.lastUpdated
            ? new Intl.DateTimeFormat(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(pulse.lastUpdated))
            : 'WAITING'}
        </div>
      </div>
    </section>
  )
}

function RecentScans({ scans }: { scans: StoredScan[] }) {
  return (
    <section className="recent shell section-pad">
      <div className="recent-head">
        <div>
          <span className="eyebrow">#PUBLIC EVIDENCE</span>
          <h2>Recent verifications</h2>
        </div>
        <span className="mono">LIVE · {scans.length} RECORDS</span>
      </div>
      {scans.length === 0 ? (
        <div className="table-empty">
          <span>⌁</span>
          <h3>No verifications yet</h3>
          <p>The first real scan will appear here. We never seed activity.</p>
          <a href="#scanner">Check the first service →</a>
        </div>
      ) : (
        <div className="scan-table">
          {scans.map(({ id, report }) => (
            <div className="scan-row" key={id}>
              <div className="service-cell">
                <span className={`status-dot status-${report.checks[1]?.status}`}>
                  <StatusGlyph status={report.checks[1]?.status ?? 'not_tested'} />
                </span>
                <span>
                  <strong>{new URL(report.target).hostname}</strong>
                  <small className="mono">{report.target}</small>
                </span>
              </div>
              <span className={`verdict-pill verdict-${report.verdict}`}>
                {report.verdictLabel}
              </span>
              <span className="mono">{report.latencyMs} ms</span>
              <span className="mono">
                {new Date(report.checkedAt).toLocaleTimeString()}
              </span>
              <span className="mono receipt">{report.evidenceHash.slice(0, 10)}…</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function Footer() {
  return (
    <footer className="shell">
      <div className="brand-line">
        <span>ASP Pulse</span>
        <span className="mono">PULSE-RULESET/1.0.0</span>
      </div>
      <div className="footer-links">
        <a href="/methodology">Methodology</a>
        <a href="/api-reference">API</a>
        <a href="https://www.okx.ai/">OKX.AI</a>
        <span>Paid canary disabled</span>
      </div>
    </footer>
  )
}
