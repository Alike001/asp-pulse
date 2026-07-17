import { SiteHeader } from '@/components/site-header'

const rules = [
  [
    'Discovery metadata',
    'Not available in version one. Trusted OKX.AI registry metadata is not connected to public direct scans.',
  ],
  [
    'Endpoint reachability',
    'Passes when the public HTTPS GET endpoint returns HTTP 402. A different response is a warning; a network error fails.',
  ],
  [
    'x402 challenge',
    'Passes only when the response contains a parseable x402 version 2 challenge whose resource URL matches the exact endpoint scanned.',
  ],
  [
    'X Layer payment terms',
    'Passes only when advertised terms use eip155:196, a supported scheme and asset, a positive amount, and a valid recipient—and read-only X Layer RPC evidence confirms chain 196 plus the asset contract, symbol, and decimals. It does not prove settlement.',
  ],
  [
    'Advertised price',
    'Not available in version one. ASP Pulse does not claim price verification without trusted listing metadata.',
  ],
  [
    'Protected response',
    'Not available in version one. A free preflight never pays, settles, or inspects protected delivery.',
  ],
]

export default function MethodologyPage() {
  return (
    <main>
      <SiteHeader />
      <section className="document shell">
        <span className="eyebrow">#PULSE-RULESET/1.1.0</span>
        <h1>Evidence before confidence.</h1>
        <p className="document-lead">
          ASP Pulse does not ask an AI model to invent a trust score. It applies three
          live checks and preserves three unavailable evidence gates. Identical captured
          evidence—including the captured X Layer block and token-contract facts—produces
          an identical verdict and receipt hash.
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
            A payment-free request can verify the service’s HTTP 402 challenge and capture
            read-only X Layer chain and token-contract evidence. It cannot see a protected
            response, submit a payment, or prove settlement. Those checks remain visibly
            marked “not tested.”
          </p>
        </section>
      </section>
    </main>
  )
}
