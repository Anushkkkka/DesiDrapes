# n8n automation

Workflows and credentials in this folder are imported into the n8n container on every start by
[`bootstrap.sh`](bootstrap.sh), so the repo is the source of truth.

| Folder | Contents |
|---|---|
| `workflows/` | Exported workflow JSON (one file per workflow) |
| `credentials/` | Local-only credentials (e.g. Mailpit SMTP), safe to commit because they point at local services |

The API publishes domain events to `http://n8n:5678/webhook/<event>` (see
`backend/src/services/events.ts`). n8n sends email through Mailpit (`http://localhost:8025`), so
nothing leaves your machine during development.

Editing a workflow in the n8n UI (`http://localhost:5678`)? Export it back here so it isn't
overwritten on the next restart:

```sh
docker compose exec n8n n8n export:workflow --id=<id> --output=/tmp/wf.json
docker compose cp n8n:/tmp/wf.json n8n/workflows/<name>.json
```
