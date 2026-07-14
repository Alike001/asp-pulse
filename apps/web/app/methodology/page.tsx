import { SiteHeader } from '@/components/site-header'

const rules = [
  [
    'Discovery metadata',
    'Not tested for a direct URL scan. Passes only when verified OKX.AI listing metadata is supplied.',
  ],
  [
    'Endpoint reachability',
    'Passes when the public endpoint returns HTTP 402. A different response is a warning; a network error fails.',
  ],
  [
    'x402 challenge',
    'Passes only when the response contains a parseable x402 version 2 challenge whose resource URL matches the exact endpoint scanned.',
  ],
  [
    'X Layer settlement',
    'Passes only when a payment option uses eip155:196, an officially supported scheme, an explicitly supported X Layer asset address, a positive amount, and a valid recipient address.',
  ],
  [
    'Advertised price',
    'Compares atomic amount and asset exactly when trusted listing metadata is available; otherwise it is not tested.',
  ],
  [
    'Protected response',
    'Passes only with recorded evidence from a successful paid canary whose response matches the declared schema. It is never inferred from the free preflight.',
  ],
]

export default function MethodologyPage() {
  return (
    <main>
      <SiteHeader />
      <section className="document shell">
        <span className="eyebrow">#PULSE-RULESET/1.0.0</span>
        <h1>Evidence before confidence.</h1>
        <p className="document-lead">
          ASP Pulse does not ask an AI model to invent a trust score. It applies six
          visible rules to observations captured from a service endpoint. Identical
          evidence produces an identical verdict and receipt hash.
        </p>
        <div className="rule-list">
          {rules.map(([title, body], index) => (
            <article key={title}>
              <span className="mono">0{index + 1}</span>
              <div>
                <h2>{title}</h2>
                <p>{body}</p>
              </div>
            </article>
          ))}
        </div>
        <section className="boundary">
          <span className="eyebrow">#IMPORTANT BOUNDARY</span>
          <h2>Free preflight is not paid delivery proof.</h2>
          <p>
            A payment-free request can verify the service’s HTTP 402 challenge, network,
            asset, and protocol shape. It cannot see a protected response. Until the
            separately controlled paid canary is enabled and succeeds, that final check
            remains visibly marked “not tested.”
          </p>
        </section>
      </section>
    </main>
  )
}
