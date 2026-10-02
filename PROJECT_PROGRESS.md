# Project Progress — DesiDrapes

_Last updated: 2026-10-02 · Branch: `feature/full-platform` (not pushed) · Phase 1 complete_

## Current Status

Full-stack e-commerce platform for Indian ethnic wear (AUD, Australia). **Phases 0 and 1 are complete.**
From the repo root, `npm run lint`, `typecheck`, `test` (39 unit tests) and `build` all pass; the
Playwright suite passes 12/12; the n8n container boots via the committed bootstrap script and Mailpit
is reachable. Next: Phase 2 (n8n workflows + Mailpit email delivery).

## Completed

| Area | What | Where | Verified by |
|---|---|---|---|
| Repo cleanup | Removed `frontend_site/`, duplicate JSX/TSX entry points, moved Prisma into backend | git `2f762e5` | git |
| Database | 13-model Prisma schema with enums, per-size `ProductVariant`, indexes; initial migration | `backend/prisma/` | `prisma migrate dev` applied |
| Seed | Idempotent seed: 74 products / 327 variants from original catalog, demo users, coupons, 14 orders | `backend/prisma/seed.ts`, `seed/products.json` | ran: counts printed |
| Auth | Register/login/logout/me, httpOnly JWT cookie, bcrypt, password policy, forgot/reset password, RBAC, n8n service key | `backend/src/modules/auth`, `middleware/auth.ts` | curl |
| Catalog | Filter/search/sort/paginate, categories, product detail, related, verified-purchase reviews, Redis cache | `modules/products` | curl (`x-cache: HIT`) |
| Orders | Server-side quote, atomic stock reservation (no overselling), coupons, cancel + restock, status machine, stale-order sweeper | `modules/orders` | curl (oversell → 409, cancel restores stock) |
| Payments | Stripe Checkout + signed webhook + refunds; mock gateway when no Stripe key | `modules/payments`, `orders.service.ts` | mock path curl-tested; **Stripe path not tested** |
| Admin API | Stats, orders, products CRUD + uploads, users/roles, coupons, audit log | `modules/admin` | curl (partial) |
| AI | Stylist assistant + description generator via OpenAI-compatible API, keyword fallback | `modules/ai` | fallback curl-tested; **real LLM not tested** |
| Events | Domain events → n8n webhooks (retry/timeout), in-app notifications, audit log | `services/events.ts` | delivery fails today (no workflows yet) — by design non-blocking |
| Hardening | Helmet, CORS allow-list, rate limits, Zod validation, uniform errors, pino logs with redaction, health/readiness | `app.ts`, `middleware/` | curl |
| API docs | OpenAPI 3 spec, Swagger UI at `/api/docs` (38 paths) | `backend/openapi.yaml` | curl 200 |
| Frontend | TS rewrite: home, collection (URL-state filters), product, cart (server quote), auth, reset password, checkout, mock checkout, success, orders, AI stylist, notifications, 404, error boundary | `frontend/src` | tsc, eslint, vite build, Playwright |
| Admin UI | Dashboard (KPIs, revenue chart), orders, products + form (upload, sizes, AI description), coupons, users, audit | `frontend/src/pages/admin` | Playwright (partial) |
| Containers | Multi-stage Dockerfiles, compose (Postgres, Redis, migrate, backend, frontend, n8n, Mailpit), nginx proxy | `docker-compose.yml`, `*/Dockerfile` | **images never built** |

| Tooling (Phase 1) | n8n bootstrap (imports repo workflows/credentials on start), complete `.env.example`, backend ESLint, Vitest in both workspaces, 39 unit tests | `n8n/`, `.env.example`, `backend/eslint.config.js`, `*/vitest` configs, `backend/tests/unit`, `frontend/src/**/*.test.*` | root lint/typecheck/test/build; n8n `/healthz` ok |

## In Progress
- Nothing. Awaiting go-ahead for Phase 2.

## Remaining (see roadmap in the current-state report)
- n8n workflows (order confirmation, status updates, password reset, welcome, low-stock alert, daily report) + Mailpit credential.
- Integration tests against a test database (auth, overselling, webhook signature, access control).
- Docker full-stack build + E2E against `:3000`.
- GitHub Actions CI.
- README / architecture / setup / troubleshooting docs; update stale `docs/*`.
- Security review: `npm audit`, demo-credential exposure in production, image rights.
- Optional: deployment, GitHub push (awaiting owner decision).

## Known Issues
| # | Issue | Status |
|---|---|---|
| 1 | ~~`docker compose up` will fail for n8n: `./n8n/bootstrap.sh` missing~~ | **Fixed (Phase 1)** — n8n boots, `/healthz` ok |
| 2 | ~~`npm test` fails: Vitest finds no test files~~ | **Fixed (Phase 1)** — 28 backend + 11 frontend tests |
| 3 | ~~`npm run lint` fails in backend: no `eslint.config.js`~~ | **Fixed (Phase 1)** — 33 files linted, clean |
| 4 | ~~`.env.example` lists obsolete vars and lacks new ones~~ | **Fixed (Phase 1)** — validated against `env.ts` schema |
| 5 | `docs/README.md`, `docs/database-setup.md`, `frontend/README.md` are stale | Confirmed |
| 6 | Dockerfiles / compose never built end-to-end | Needs verification |
| 7 | Stripe live-test path and real-LLM path untested | Needs verification (needs keys; optional) |
| 8 | 5 `npm audit` findings, all in dev tooling (vitest mocker, Prisma CLI dependency) | Needs re-check |
| 9 | Seed creates ~39 low-stock sizes → many `inventory.low` alerts | Suspected annoyance; tune |
| 10 | Product photos: origin/licence unknown | Owner to confirm before public deploy |
| 11 | Floating "AI Stylist" button overlaps the cart's "Proceed to checkout" button at ~1280px width | Confirmed (screenshot); cosmetic, scheduled for polish |
| 12 | E2E tests create real orders in the dev database (dashboard totals grow per run) | By design for now; reset with `npm run db:reset` |
| 13 | E2E home-page test can time out on the first load after the Vite dev server clears its cache (on-demand compilation) | Confirmed once (Phase 1); passes when warm. CI will run E2E against the production build (Phase 5) |
| 14 | ~~`backend/dist/` build output was not gitignored~~ | **Fixed (Phase 1)** — repo-wide `dist/` rule |

## Decisions

**D1 — Monorepo with npm workspaces (frontend, backend), one root lockfile.**
Why: one install, shared tooling, reproducible Docker builds. Alternatives: separate repos; pnpm/turbo.
Impact: Dockerfiles build from repo root. (`2f762e5`)

**D2 — Stock tracked per size (`ProductVariant`) and reserved at order creation with a conditional
`UPDATE … WHERE stock >= qty`.**
Why: clothing stock is per size; conditional decrement prevents overselling under concurrency without
explicit locks. Alternative: decrement on payment (risks overselling while customers pay).
Impact: unpaid orders must release stock — handled by cancel, Stripe `expired` webhook, and a 10-minute sweeper. (`2f762e5`)

**D3 — httpOnly cookie JWT + same-origin proxy (Vite dev proxy / nginx).**
Why: token is not readable by JS (XSS-resistant); same origin avoids CORS/cookie issues. SameSite=Lax plus
JSON-only endpoints mitigates CSRF. Alternative: Bearer token in localStorage. (`2f762e5`)

**D4 — Payment provider abstraction with a mock gateway.**
Why: project must run free with zero keys; Stripe activates automatically when `STRIPE_SECRET_KEY` is set
(test keys only for this project). (`2f762e5`)

**D5 — AI via any OpenAI-compatible endpoint, grounded in catalog data, with deterministic fallback.**
Why: works with OpenAI, local Ollama (free) or none; model may only recommend product IDs retrieved from
the DB (hallucinated IDs are dropped). (`2f762e5`)

**D6 — Side effects (emails, alerts) delegated to n8n via fire-and-forget domain events.**
Why: business workflows editable without redeploying; checkout never fails because automation is down.
Mailpit catches all email locally so nothing reaches real inboxes. (`2f762e5`)

**D7 — Guest cart in localStorage (Zustand), priced authoritatively by the server.**
Why: no login needed to shop; prices/stock never trusted from the client. Removed the unused `Cart` tables. (frontend, uncommitted)

## Testing
| Date | Test | Mechanism | Result |
|---|---|---|---|
| 2026-09-29 | Backend typecheck | `tsc --noEmit` | Pass |
| 2026-09-29 | API smoke + purchase flow, oversell, cancel/restock, RBAC, AI fallback, service key | curl scripts | Pass (2 bugs found & fixed: log redaction, report date) |
| 2026-09-30 | Frontend typecheck / lint / build | `tsc`, `eslint`, `vite build` | Pass |
| 2026-10-02 | Browser E2E (12 tests, desktop + mobile) | Playwright | 9 pass / 3 fail (test selectors); blank-page bug found & fixed (`scrollTo` effect) |
| 2026-10-02 | Phase 0 E2E run #1 | `npx playwright test` | 10/12; 2 fails = same test on 2 viewports: counted cards before results loaded (screenshot showed loading skeleton; API returned 7 results). **Test timing issue, not app bug** → added wait for first card |
| 2026-10-02 | Phase 0 E2E: affected test, then full suite | `npx playwright test` | Affected 2/2; **full suite 12/12 pass (28.2s)** |
| 2026-10-02 | Visual check of saved screenshots (cart, admin dashboard) | manual review | Correct totals ($60 − $6 + $10 = $64); found issue #11 |
| 2026-10-02 | Frontend typecheck / lint / build; backend typecheck | `tsc --noEmit`, `eslint .`, `vite build` | All PASS (exit 0) |
| 2026-10-02 | Compose file + n8n bootstrap | `docker compose config`; `docker compose up -d n8n mailpit`; `/healthz` | Valid; n8n healthy, bootstrap log line present, deprecation warnings removed; Mailpit UI 200 |
| 2026-10-02 | `.env.example` vs backend schema | load as env, import `env.ts`; negative test with short JWT | Accepted (mock payments, AI fallback); short secret rejected; compose accepts file |
| 2026-10-02 | Backend ESLint | `eslint .` + JSON count + stdin probe | 33 files, 0 findings; probe caught 3 planted errors |
| 2026-10-02 | Unit tests | `vitest run` (both workspaces) | Backend 28/28, frontend 11/11 |
| 2026-10-02 | Mutation check on pricing | planted free-shipping bug, then restored | Exactly the targeted test failed; file restored with no diff |
| 2026-10-02 | Root scripts | `npm run lint / typecheck / test / build` | All exit 0 |
| 2026-10-02 | E2E regression | `npx playwright test` | Run 1: 10/12 (cold Vite cache, issue #13); targeted rerun 2/2; **full rerun 12/12** |

## Git History
- (Phase 1) — test: add unit tests for pricing, validation, AI intent, cart and product card
- (Phase 1) — chore(backend): add ESLint config and ignore build output
- (Phase 1) — chore(config): document every environment variable in .env.example
- (Phase 1) — fix(docker): add n8n bootstrap so the compose stack starts
- `b75a24e` — feat(frontend): TypeScript storefront and admin dashboard
- `74a16f8` — feat(backend): admin product detail endpoint and OpenAPI docs (also contains the 13 old-JSX deletions that were pre-staged)
- `2f762e5` — feat(backend): production API with auth, catalog, orders, payments, admin, AI and n8n events
- `6796d11` — chore: remove obsolete frontend_site files
- `815aaf3` — chore: remove tracked node_modules and fix .gitignore
- `b35867a` — feat: scaffold AI commerce platform foundation
- earlier — original React storefront (home page, navigation, routing)

## Next Steps
1. Phase 2: n8n workflows + Mailpit — awaiting go-ahead.
2. Continue roadmap phases 3–8.
3. Owner decisions pending: GitHub push, product-photo rights, deployment.
