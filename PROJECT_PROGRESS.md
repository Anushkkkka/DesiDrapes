# Project Progress — DesiDrapes

_Last updated: 2026-10-02 · Branch: `feature/full-platform` (pushed) · Phase 2 complete_

## Current Status

Full-stack e-commerce platform for Indian ethnic wear (AUD, Australia). **Phases 0, 1 and 2 are complete.**
Root `lint`, `typecheck`, `test` (39 unit tests) and `build` pass; Playwright passes 12/12. n8n 2.42.2
imports and publishes 7 workflows from the repo on start, and every store event was verified end to end:
API → n8n (API-key guarded) → workflow → Mailpit → email content checked. Next: Phase 3 (integration tests).

## Completed

| Area | What | Where | Verified by |
|---|---|---|---|
| Repo cleanup | Removed `frontend_site/`, duplicate JSX/TSX entry points, moved Prisma into backend | `119f50b` | git |
| Database | 13-model Prisma schema with enums, per-size `ProductVariant`, indexes; initial migration | `backend/prisma/` | `prisma migrate dev` applied |
| Seed | Idempotent seed: 74 products / 327 variants from original catalog, demo users, coupons, 14 orders | `backend/prisma/seed.ts`, `seed/products.json` | ran: counts printed |
| Auth | Register/login/logout/me, httpOnly JWT cookie, bcrypt, password policy, forgot/reset password, RBAC, n8n service key | `backend/src/modules/auth`, `middleware/auth.ts` | curl; reset link from email used end to end (Phase 2) |
| Catalog | Filter/search/sort/paginate, categories, product detail, related, verified-purchase reviews, Redis cache | `modules/products` | curl (`x-cache: HIT`) |
| Orders | Server-side quote, atomic stock reservation (no overselling), coupons, cancel + restock, status machine, stale-order sweeper | `modules/orders` | curl (oversell → 409, cancel restores stock) |
| Payments | Stripe Checkout + signed webhook + refunds; mock gateway when no Stripe key | `modules/payments`, `orders.service.ts` | mock path tested; **Stripe path not tested** |
| Admin API | Stats, orders, products CRUD + uploads, users/roles, coupons, audit log | `modules/admin` | curl (partial) |
| AI | Stylist assistant + description generator via OpenAI-compatible API, keyword fallback | `modules/ai` | fallback tested; **real LLM not tested** |
| Hardening | Helmet, CORS allow-list, rate limits, Zod validation, uniform errors, pino logs with redaction, health/readiness | `app.ts`, `middleware/` | curl |
| API docs | OpenAPI 3 spec, Swagger UI at `/api/docs` (38 paths) | `backend/openapi.yaml` | curl 200 |
| Frontend | TS rewrite: storefront, cart, checkout, orders, auth, AI stylist, notifications, admin dashboard | `frontend/src` | tsc, eslint, vite build, Playwright 12/12 |
| Tooling (Phase 1) | n8n bootstrap, complete `.env.example`, backend ESLint, Vitest in both workspaces, 39 unit tests | `n8n/`, `.env.example`, `backend/eslint.config.js`, `backend/tests/unit`, `frontend/src/**/*.test.*` | root scripts |
| **Automation (Phase 2)** | 7 n8n workflows (below), API-key-guarded webhooks, Mailpit SMTP credential, workflow generator, n8n 2.x bootstrap (import + publish), event delivery retry/backoff | `n8n/`, `backend/src/services/events.ts`, `docker-compose.yml` | full-path tests below |
| Containers | Multi-stage Dockerfiles, compose (Postgres, Redis, migrate, backend, frontend, n8n, Mailpit), nginx proxy | `docker-compose.yml`, `*/Dockerfile` | n8n/Mailpit/db/redis run; **app images never built** |

### n8n workflows (Phase 2)

| Workflow | Trigger | Email to | Full-path test | Mailpit result |
|---|---|---|---|---|
| Order confirmation + admin alert | `order.paid` | customer + admin | real order via API, mock payment success | 2 emails; total $55.00 matched API; items, size, address, order link present |
| Status update | `order.status_changed` | customer | admin PATCH PAID → SHIPPED | "Order #…: Shipped", "on its way" |
| Payment failed | `payment.failed` | customer | real order, mock payment declined | "did not go through", "No money was taken" |
| Welcome | `user.registered` | customer | register via API (name containing HTML) | delivered; `WELCOME10`; name HTML-escaped |
| Password reset | `password.reset_requested` | customer | forgot-password via API | link extracted from email reset the password; new login OK, old rejected, link single-use |
| Low stock | `inventory.low` | admin | bought a size down to its threshold (5 → 3) | "Low stock: Gold Satin Evening Gown (XL)", "3 left (threshold 3)" |
| Daily report | 08:00 schedule (+ manual) | admin | `n8n execute` → GET `/api/internal/reports/daily` with key | figures matched API response; restock list |

## In Progress
- Nothing. Awaiting go-ahead for Phase 3.

## Remaining
- Integration tests against a test database (auth, overselling, webhook signature, access control); E2E login reuse (issue #16).
- Docker full-stack build + E2E against `:3000`.
- GitHub Actions CI (E2E against the production build fixes issue #13).
- README / architecture / setup / troubleshooting docs; update stale `docs/*`.
- Security review: `npm audit`, compose JWT fallback (#18), demo-credential exposure in production, image rights.
- Optional: deployment.

## Known Issues
| # | Issue | Status |
|---|---|---|
| 1–4 | Phase 1 breakages (n8n bootstrap, `npm test`, backend lint, `.env.example`) | **Fixed (Phase 1)** |
| 5 | `docs/README.md`, `docs/database-setup.md`, `frontend/README.md` are stale | Confirmed; Phase 7 |
| 6 | App Dockerfiles / full compose stack never built end-to-end | Needs verification; Phase 4 |
| 7 | Stripe live-test path and real-LLM path untested | Needs verification (needs keys; optional) |
| 8 | 5 `npm audit` findings, all in dev tooling | Needs re-check; Phase 6 |
| 9 | Seed creates ~40 low-stock sizes → frequent `inventory.low` alerts | Confirmed (daily report lists 40); tune seed |
| 10 | Product photos: origin/licence unknown | Owner to confirm before public deploy |
| 11 | Floating "AI Stylist" button overlaps the cart's "Proceed to checkout" button at ~1280px | Cosmetic; polish |
| 12 | E2E tests create real orders in the dev database | By design; `npm run db:reset` |
| 13 | E2E first page load can exceed 5 s on the Vite dev server (on-demand compilation, cold cache) | Intermittent; CI will test the production build (Phase 5) |
| 14 | ~~`backend/dist/` not gitignored~~ | **Fixed (Phase 1)** |
| 15 | Dev machine memory pressure (0.5 GB free of 7.8 GB with Docker + n8n + dev servers + browsers) slows first page loads | Environment; mitigated by `workers: 1` (Phase 2) |
| 16 | Repeated E2E runs within 15 min hit the login rate limiter (20/15 min/IP) → 429 | Security feature working; Phase 3: log in once and reuse session (`storageState`) |
| 17 | Event delivery to n8n is best-effort: dropped (logged) if n8n is down > ~15 s | Documented; durable outbox would remove it |
| 18 | `docker-compose.yml` still has a fallback `JWT_SECRET` (`local-dev-only-change-me-please`) | Phase 6 (same fix as N8N_API_KEY: require it) |
| 19 | n8n webhooks reply HTTP 200 even when the key is rejected (run fails, no email) | By design (hides key validity); visible as failed executions |
| 20 | n8n logs a deprecation for internal task-runner mode and a missing-Python note | Harmless: no Code nodes are used |
| 21 | Mailpit keeps mail in memory; restarting it clears the inbox | Expected for a local test inbox |

## Decisions

**D1 — Monorepo with npm workspaces (frontend, backend), one root lockfile.**
Why: one install, shared tooling, reproducible Docker builds. Alternatives: separate repos; pnpm/turbo.

**D2 — Stock tracked per size (`ProductVariant`) and reserved at order creation with a conditional `UPDATE … WHERE stock >= qty`.**
Why: prevents overselling under concurrency without locks. Unpaid orders release stock via cancel, Stripe `expired` webhook and a 10-minute sweeper.

**D3 — httpOnly cookie JWT + same-origin proxy (Vite dev proxy / nginx).**
Why: token unreadable by JS; same origin avoids CORS/cookie issues; SameSite=Lax + JSON-only API mitigates CSRF.

**D4 — Payment provider abstraction with a mock gateway.**
Why: runs free with zero keys; Stripe (test keys only) activates when `STRIPE_SECRET_KEY` is set.

**D5 — AI via any OpenAI-compatible endpoint, grounded in catalog data, with deterministic fallback.**
Why: works with OpenAI, local Ollama (free) or none; hallucinated product IDs are dropped.

**D6 — Side effects (emails, alerts) delegated to n8n via fire-and-forget domain events.**
Why: workflows editable without redeploying; checkout never fails because automation is down; Mailpit keeps email local.

**D7 — Guest cart in localStorage (Zustand), priced authoritatively by the server.**
Why: no login needed to shop; prices/stock never trusted from the client.

**D8 — Pin n8n 2.42.2 (was 1.123.5).** _(Phase 2)_
Why: n8n 1.123 cannot activate workflows imported via the CLI (activation needs a version-history row the
import never writes; confirmed in n8n source). 2.x import writes history and `publish:workflow` activates.
Alternatives: write rows into n8n's SQLite (unsupported, fragile); automate owner + API key and use the REST API (heavy).
Impact: bootstrap gives each import a fresh `versionId` and publishes per workflow; `DB_SQLITE_POOL_SIZE` must stay unset (pooled SQLite deadlocked the import).

**D9 — Webhooks authenticated with a shared `x-api-key`, checked as the first node of every workflow.** _(Phase 2)_
Why: unauthenticated webhooks let anyone trigger branded emails to arbitrary addresses (spam relay). Key
lives only in env (`N8N_API_KEY` → `DESIDRAPES_API_KEY`); compose refuses to start without it.
Alternatives: n8n header-auth credential (would put the secret in a committed credential file).

**D10 — Workflows generated from one script (`n8n/scripts/build-workflows.mjs`).** _(Phase 2)_
Why: shared email layout, node versions and security guard in one place; deterministic output (verified by regenerate-and-diff).

## Testing
| Date | Test | Mechanism | Result |
|---|---|---|---|
| 2026-09-29 | API smoke + purchase flow, oversell, cancel/restock, RBAC, AI fallback, service key | curl | Pass (2 bugs fixed) |
| 2026-10-02 | Phase 0: E2E 12/12; typecheck / lint / build | Playwright, tsc, eslint, vite | Pass (blank-page bug + test-timing issue fixed) |
| 2026-10-02 | Phase 1: compose, bootstrap, `.env.example` vs schema, backend lint, 39 unit tests, mutation check, root scripts, E2E 12/12 | various | Pass |
| 2026-10-02 | Payload contract: fields read by each workflow vs fields published | grep both sides | All match |
| 2026-10-02 | n8n 1.123 import/activation | bootstrap logs, n8n source | **Failed** → pool-size deadlock, then FK on activation (upstream limitation) → D8 |
| 2026-10-02 | n8n 2.42.2 first boot from empty volume | bootstrap logs | 1 credential + 7 workflows imported, 7 published |
| 2026-10-02 | Webhook security: no key / wrong key / correct key | curl to webhook + Mailpit count + n8n executions | 0 / 0 / 1 emails; rejected runs recorded as errors |
| 2026-10-02 | Full path for all 7 workflows | real API actions → Mailpit API | 10 emails, correct recipients and subjects |
| 2026-10-02 | Email content | 13 checks against API data | 13/13 pass (totals, escaping, links, wording, sender) |
| 2026-10-02 | Password reset loop | link from email → reset API → login | Pass; token single-use |
| 2026-10-02 | n8n ↔ API | internal report with / without key | 200 / 401 |
| 2026-10-02 | Outage F1: n8n down | register | 201 in 0.46 s, warning logged, API healthy |
| 2026-10-02 | Outage F2: Mailpit down | pay order, read n8n execution | Payment OK; email retried and delivered after recovery (success, 31.6 s) |
| 2026-10-02 | n8n start-up race | pay at the instant `/healthz` is ok | **Found bug:** event lost (404 not retried). Measured 3.9 s window → backoff fix → both emails delivered |
| 2026-10-02 | Root scripts, compose (with `.env`, `.env.example`, key missing), generator determinism, secret scan | various | Pass; missing key fails with clear message |
| 2026-10-02 | E2E regression | Playwright | Flaky under memory pressure + rate limiter (#15, #16) → `workers: 1`; **two clean full runs 12/12** |

## Git History
History was rewritten on 2026-10-02 (owner-approved): placeholder author email replaced with the owner's
GitHub noreply address and AI co-author trailers removed; trees, dates and messages otherwise identical.
Backups: local `backup/*` branches and `../desidrapes-backups-2026-10-02/`.

- (Phase 2) — test(e2e): run Playwright with a single worker
- (Phase 2) — feat(automation): add n8n email workflows with authenticated delivery
- `83c0779` — test: add unit tests for pricing, validation, AI intent, cart and product card
- `277265e` — chore(backend): add ESLint config and ignore build output
- `0fde582` — chore(config): document every environment variable in .env.example
- `f49eea3` — fix(docker): add n8n bootstrap so the compose stack starts
- `340bd93` — feat(frontend): TypeScript storefront and admin dashboard
- `7607d96` — feat(backend): admin product detail endpoint and OpenAPI docs (also contains 13 old-JSX deletions)
- `119f50b` — feat(backend): production API with auth, catalog, orders, payments, admin, AI and n8n events
- `989947b`, `1ff07ea`, `405e484` — repo cleanup and platform scaffold
- `3134a89` … `e30f7e0` — original React storefront (2025)
- `9b861d9` (main) — Merge pull request #1

## Next Steps
1. Phase 3: integration tests (Supertest + test DB), E2E session reuse — awaiting go-ahead.
2. Phase 4: build and run the full Docker stack; E2E against `:3000`.
3. Owner decisions pending: product-photo rights, deployment, deleting local backup branches.
