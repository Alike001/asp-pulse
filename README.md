# ASP Pulse

**Know before you pay.** ASP Pulse checks whether an OKX.AI/x402 service is callable now, returns a valid x402 v2 challenge, and offers supported X Layer settlement terms before an agent sends payment.

The verdict is deterministic. The same captured evidence and `PULSE-RULESET/1.0.0` produce the same SHA-256 receipt. A free preflight never claims to verify the protected response; that check remains **not tested** unless a real paid canary has succeeded.

## Run locally

Requires Node.js 24+.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The web app and scanner API start together with no wallet, API key, or database setup. Scans persist in `.data/asp-pulse.sqlite`.

## Verify and run production output

```bash
npm run verify
npm start
```

The site runs on port `3000` and the API on `8787`. Override `NEXT_PUBLIC_API_URL`, `PORT`, or `PULSE_DATABASE_PATH` as needed before building/deploying.

## What the six checks mean

1. Discovery metadata — verified listing data, when supplied.
2. Endpoint reachability — live HTTP 402 response.
3. x402 challenge — canonical base64 `PAYMENT-REQUIRED` header or compatible JSON body, parsed as x402 v2.
4. X Layer settlement — `eip155:196`, a supported asset, a positive atomic amount, and valid recipient address.
5. Advertised price — exact amount/asset comparison when trusted listing metadata is available.
6. Protected response — real paid-canary schema evidence only; otherwise visibly not tested.

Public probes reject credentials, nonstandard ports, redirects, oversized bodies, and local/private/reserved IP ranges. DNS answers are pinned into the outbound connection to prevent rebinding after validation.

## Payment boundary

The canary worker is deliberately fail-closed. Setting `ENABLE_PAID_CANARY=true` does not enable spending; the worker refuses to start until an approved payment adapter exists. A future adapter must also pass a target allowlist, per-call cap, and daily budget cap.
