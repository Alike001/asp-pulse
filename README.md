# ASP Pulse

**Know before you pay.** ASP Pulse checks whether an x402 service is callable now, returns a challenge bound to the exact endpoint, and offers supported X Layer payment terms before an agent sends payment.

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

`npm start` is the local production check: the site runs at `:3000` and the API at `:8787`. Override those local ports with `WEB_PORT` and `API_PORT`.

### Deploy as an A2MCP service

Deploy the web and API as **two separate HTTPS services**. Do not use the combined `npm start` command on a one-port host.

1. Deploy the API with `npm run start:api`, a persistent writable volume, and `API_PORT` set to the host's assigned port.
2. Set `NEXT_PUBLIC_API_URL` to the API's public HTTPS origin, then build and deploy the web with `npm run start:web` and `PORT` set to its host-assigned port.
3. Confirm `GET /health`, `GET /discover`, and `POST /v1/scans` on the API's public origin before registering it. The browser must make a successful scan against that same public API origin.

`NEXT_PUBLIC_API_URL` is embedded during the web build. Rebuild the web whenever the API origin changes. The default SQLite store is suitable only when the API host guarantees a persistent writable volume; use a production database before deploying to an ephemeral/serverless filesystem.

## Quality gate

```bash
npx playwright install chromium
npm run verify
```

`verify` checks formatting, lint, strict types, deterministic/API tests, a real Chromium browser path through the scanner's SSRF boundary, WCAG 2.0 A/AA accessibility violations, production builds, and production dependency vulnerabilities at high severity or above. GitHub Actions runs the same gate on every pull request and push to `main`.

## What the six checks mean

1. Discovery metadata — verified listing data, when supplied.
2. Endpoint reachability — live HTTP 402 response.
3. x402 challenge — canonical base64 `PAYMENT-REQUIRED` header or compatible JSON body, parsed as x402 v2 and bound to the scanned resource URL.
4. X Layer payment terms — `eip155:196`, an officially supported scheme, a supported asset, a positive atomic amount, and valid recipient address.
5. Advertised price — exact amount/asset comparison when trusted listing metadata is available.
6. Protected response — real paid-canary schema evidence only; otherwise visibly not tested.

Public probes reject credentials, nonstandard ports, redirects, oversized bodies, and local/private/reserved IP ranges. DNS answers are pinned into the outbound connection to prevent rebinding after validation.

## Payment boundary

The canary worker is deliberately fail-closed. Setting `ENABLE_PAID_CANARY=true` does not enable spending; the worker refuses to start until an approved payment adapter exists. A future adapter must also pass a target allowlist, per-call cap, and daily budget cap.
