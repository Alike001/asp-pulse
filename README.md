# ASP Pulse

**Use the product:** [asp-pulse.vercel.app](https://asp-pulse.vercel.app/) · **OKX.AI listing:** [Agent #5786](https://www.okx.ai/agents/5786?source=search) · **MCP endpoint:** `https://asp-pulse.vercel.app/api/mcp`

**Know before you pay.** ASP Pulse checks whether a public HTTPS GET x402 endpoint is callable now, returns a challenge bound to the exact endpoint, and advertises supported X Layer payment terms before an agent sends payment.

The verdict is deterministic. New scans use `PULSE-RULESET/1.1.0` and capture read-only X Layer chain and token-contract evidence alongside the HTTP challenge. The same stored evidence produces the same SHA-256 receipt; legacy `1.0.0` receipts remain recomputable with their original evaluator. Rechecking a receipt does not repeat the live network request. A free preflight never claims to verify payment settlement or the protected response; those checks remain **not tested** unless separate evidence exists.

The hosted product is the zero-setup judge path. It accepts only public HTTPS GET endpoints, never sends payment, and offers a one-click rerun of the latest stored preflight-passing public endpoint when evidence is available. Reports are retained for 30 days; scan operations are limited to 30 per anonymous source per hour to protect public targets and the shared service.

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

For a conventional host, deploy the web and API as **two separate HTTPS services**. Do not use the combined `npm start` command on a one-port host.

1. Deploy the API with `npm run start:api`, a persistent writable volume, and `API_PORT` set to the host's assigned port.
2. Set `NEXT_PUBLIC_API_URL` to the API's public HTTPS origin, then build and deploy the web with `npm run start:web` and `PORT` set to its host-assigned port.
3. Confirm `GET /health`, `GET /discover`, `POST /v1/scans`, and the Streamable HTTP MCP endpoint at `POST /mcp` on the API's public origin before registering it. The browser and an MCP client must each complete a successful preflight against that same public API origin.

`NEXT_PUBLIC_API_URL` is embedded during the web build. Rebuild the web whenever the API origin changes. The default SQLite store is suitable only when the API host guarantees a persistent writable volume; use a production database before deploying to an ephemeral/serverless filesystem.

### Deploy on Vercel with durable Postgres

ASP Pulse supports a single Vercel project: its Next route handler exposes the API under `/api/*` and preserves the public API and MCP contracts beneath that prefix (for example `/api/v1/scans`, `/api/discover`, and `/api/mcp`).

1. In Vercel, add a Postgres provider from the Marketplace (Neon is supported) and connect it to this project. Vercel injects provider credentials into the project; map the connection string to a **server-only** `DATABASE_URL` environment variable.
2. Set `NEXT_PUBLIC_API_URL` to `/api` for Production and Preview. This is safe to expose because it is only the same-origin API path—not a credential.
3. Deploy with the project root set to `apps/web`, enable **Include source files outside of the Root Directory in the Build Step**, and set the Vercel Build Command to `npm run vercel-build`. That command compiles the sibling API workspace before Next bundles the route handler.
4. After deployment, call `GET /api/health`, `GET /api/discover`, `POST /api/v1/scans`, and use an MCP client against `POST /api/mcp`. If `DATABASE_URL` is absent on Vercel, the API intentionally fails rather than falling back to temporary storage.

For this Vercel configuration, do not use `start:api` or a separate public API origin. Keep `DATABASE_URL` out of `.env` files committed to Git and out of every `NEXT_PUBLIC_*` variable.

## Quality gate

```bash
npx playwright install chromium
npm run verify
```

`verify` checks formatting, lint, strict types, deterministic/API tests, a real Chromium browser path through the scanner's SSRF boundary, WCAG 2.0 A/AA accessibility violations, production builds, and production dependency vulnerabilities at high severity or above. GitHub Actions runs the same gate on every pull request and push to `main`.

## Three live checks and three evidence gates

1. Endpoint reachability — live HTTP 402 response.
2. x402 challenge — canonical base64 `PAYMENT-REQUIRED` header or compatible JSON body, parsed as x402 v2 and bound to the scanned resource URL.
3. X Layer payment terms — `eip155:196`, a supported scheme and asset, a positive atomic amount, a valid recipient address, and live read-only evidence that the RPC chain ID is 196 and the advertised asset contract has the expected symbol and decimals. The evidence records the X Layer block number and a SHA-256 hash of the contract bytecode.
4. Discovery metadata — unavailable in version one because trusted OKX.AI registry metadata is not connected.
5. Advertised price — unavailable in version one; ASP Pulse never claims price verification without trusted listing metadata.
6. Protected response — unavailable in version one; the free preflight never pays, settles, or inspects protected delivery.

## MCP tool

The Streamable HTTP MCP endpoint is `/mcp` (or `/api/mcp` on Vercel). It exposes `preflight_x402_endpoint` with one argument: `target`, a complete public HTTPS URL. The tool performs the same unauthenticated GET-only preflight as the web scanner and returns the report ID, deterministic verdict, check states, and evidence receipt. It never sends payment.

Public probes reject credentials, nonstandard ports, redirects, oversized bodies, and local/private/reserved IP ranges. DNS answers are pinned into the outbound connection to prevent rebinding after validation.

X Layer evidence uses only the fixed official public RPC endpoints `https://rpc.xlayer.tech` and `https://xlayerrpc.okx.com`, with strict timeouts, fallback, and a short in-memory cache. Users cannot supply an RPC URL. An RPC outage produces an explicit degraded report rather than an unsupported verification claim.

## Payment boundary

The canary worker is deliberately fail-closed. Setting `ENABLE_PAID_CANARY=true` does not enable spending; the worker refuses to start until an approved payment adapter exists. A future adapter must also pass a target allowlist, per-call cap, and daily budget cap.
