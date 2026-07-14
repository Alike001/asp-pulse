import { SiteHeader } from '@/components/site-header'

export default function ApiReferencePage() {
  return (
    <main>
      <SiteHeader />
      <section className="document shell">
        <span className="eyebrow">#PUBLIC API</span>
        <h1>Check from any agent.</h1>
        <p className="document-lead">
          The same deterministic scan used by the landing page is available as JSON. No
          wallet or payment is required for a preflight.
        </p>
        <div className="code-panel mono">
          <span>POST /v1/scans</span>
          <pre>{`{
  "target": "https://service.example/paid-route"
}`}</pre>
        </div>
        <div className="api-grid">
          <article>
            <span className="mono">GET</span>
            <h2>/v1/scans/:id</h2>
            <p>Replay a stored scan and its evidence receipt.</p>
          </article>
          <article>
            <span className="mono">GET</span>
            <h2>/v1/network</h2>
            <p>Read aggregates calculated only from captured scans.</p>
          </article>
          <article>
            <span className="mono">GET</span>
            <h2>/v1/config</h2>
            <p>Inspect rule-set, network, assets, and canary status.</p>
          </article>
        </div>
      </section>
    </main>
  )
}
