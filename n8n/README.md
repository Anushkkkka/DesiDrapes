# n8n automation

Event-driven emails for DesiDrapes. The API publishes domain events; n8n turns them into emails
delivered to Mailpit (`http://localhost:8025`), so nothing leaves your machine during development.

```
API (events.ts) ──POST /webhook/<event> + x-api-key──► n8n workflow ──SMTP──► Mailpit
n8n (8am schedule) ──GET /api/internal/reports/daily + x-api-key──► API
```

## Workflows

| File | Trigger | Email to | Content |
|---|---|---|---|
| `order-paid.json` | `order.paid` | customer + admin | Confirmation with items, total, address, order link; admin "new order" alert |
| `order-status.json` | `order.status_changed` | customer | Processing / shipped / delivered / cancelled message |
| `payment-failed.json` | `payment.failed` | customer | Payment failed, order cancelled, no money taken |
| `welcome.json` | `user.registered` | customer | Welcome + `WELCOME10` coupon |
| `password-reset.json` | `password.reset_requested` | customer | One-time reset link (60 min) |
| `low-stock.json` | `inventory.low` | admin | Size at/below its alert threshold |
| `daily-report.json` | Schedule 08:00 (+ manual) | admin | Yesterday's revenue, orders, new customers, restock list (fetched from the API) |

## Security

- Every webhook workflow starts with **Verify API key**: the request's `x-api-key` header must equal
  `$env.DESIDRAPES_API_KEY` (and the key must be non-empty). Otherwise the run stops with an error and
  no email is sent. The backend sends `N8N_API_KEY` as that header.
- The daily report calls the API's `/api/internal/*` routes with the same key.
- No secret is stored in this folder: keys come from environment variables (`N8N_API_KEY` in `.env`).
  `credentials/mailpit-smtp.json` only points at the local Mailpit container (no username/password).
- User-supplied values (names, addresses, product names) are HTML-escaped in email templates.

## How workflows get into n8n

`bootstrap.sh` is the container entrypoint. On every start it imports `credentials/` and `workflows/`
(with a fresh `versionId`, which n8n's version history requires), publishes each workflow by id
(`n8n publish:workflow`), then runs `n8n start`. The repo is the source of truth.

Requires **n8n 2.x** (pinned in `docker-compose.yml`): n8n 1.x could not activate CLI-imported workflows.

## Editing workflows

The JSON is generated. Edit [`scripts/build-workflows.mjs`](scripts/build-workflows.mjs), then:

```sh
node n8n/scripts/build-workflows.mjs   # regenerate n8n/workflows/*.json
docker compose restart n8n             # re-import and publish
```

Changes made in the n8n UI are overwritten on the next restart unless ported back into the generator.

## Running the daily report on demand

```sh
docker compose exec -e N8N_RUNNERS_BROKER_PORT=5699 n8n n8n execute --id ddDailyReport001
```

(The separate broker port avoids clashing with the running n8n server.)

## Reliability notes

- The API retries event delivery for ~15 s (1/2/4/8 s backoff), covering n8n restarts and the few
  seconds after start-up before webhooks are registered. Delivery is best-effort: if n8n is down for
  longer, the event is dropped and logged (`Event delivery to n8n failed`). Checkout never waits on n8n.
- Email nodes retry SMTP 3 times; an email sent during a short Mailpit/SMTP outage is delivered once it
  recovers.
- Hybrid dev (API on the host, n8n in Docker): set `DESIDRAPES_API_URL=http://host.docker.internal:4000`
  in `.env` so the daily report can reach the API.
