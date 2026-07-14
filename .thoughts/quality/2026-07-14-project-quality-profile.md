# Project Quality Profile: ASP Pulse

## Detected Stack

- Clean repository with research and design artifacts; no existing application manifest or source tree.
- Approved implementation: Node.js 24, TypeScript 6 workspace monorepo, Next.js 16 App Router web app, Hono Node API, framework-independent deterministic scan core, worker process, and PostgreSQL persistence.
- External protocol surface: OKX.AI A2MCP and OKX Payments x402 on X Layer.

## Existing Commands

- None before Phase 4 scaffolding.
- The root manifest must expose stable aliases for `format`, `lint`, `typecheck`, `test`, `test:integration`, `build`, and `verify`.

## Required Local Checks

1. Format check for all hand-written source, configuration, Markdown, and styles.
2. ESLint for Next.js, React, browser, and Node API code.
3. TypeScript project-reference typecheck across every workspace.
4. Deterministic rule-engine unit tests, including canonical input ordering and verdict stability.
5. API integration tests using controlled compliant and non-compliant x402 endpoints.
6. SSRF tests covering private IPs, link-local ranges, redirects, alternate IP notation, and DNS rebinding boundaries.
7. Production builds for web, API, and worker.
8. Browser-level smoke tests for landing scan, report rendering, keyboard navigation, and mobile layout.

## Required CI Gates

- Dependency install from the committed lockfile.
- Format, lint, and typecheck.
- Unit and integration suites with no real payment or public-network dependency.
- Production build.
- Browser smoke and accessibility checks against the built application.
- Dependency audit; findings must be reviewed rather than automatically ignored.
- Paid canary tests are never part of ordinary CI.

## Suggested Hooks

- Pre-commit: staged formatting and linting only.
- Pre-push: typecheck plus deterministic-core unit tests.
- Full integration, browser, and build verification remains a CI and session-completion gate.

## File Size Policy

- Target: 200 source lines.
- Warning: above 200 source lines.
- Hard cap: above 300 source lines.
- Exclusions: generated files, build output, vendored research repositories, fixtures, lockfiles, framework output, and database migrations.
- Escape hatch: a larger file requires a written reason in this profile or the project log and should usually be split by responsibility.

## Commit Policy

- Use Conventional Commits: `feat`, `fix`, `test`, `docs`, `refactor`, `chore`, and `ci`.
- Commit after each verified meaningful phase so every integration boundary has a rollback point.
- Never commit secrets, wallet keys, payment credentials, funded-wallet configuration, or local environment files.

## AGENTS.md Notes

- The repository rules already require product-grade behavior, deterministic verdicts, session logging, current handoff notes, and a commit after meaningful work.
- Free preflight and paid canary evidence must remain visibly distinct in code, API responses, UI, and tests.
- No test or manual verification command may spend real funds unless separately and explicitly authorized.
- Exact OKX package names and network constants must be revalidated against current official documentation before installation or deployment.

## Open Questions

- Final managed PostgreSQL and container providers will be selected at deployment time.
- The funded canary path remains disabled until a separate wallet, secret-management method, spend cap, and explicit authorization are provided.
- OKX registry/API access available to the deployed ASP must be validated before the network-wide crawler is enabled.
