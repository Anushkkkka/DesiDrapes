#!/bin/sh
# n8n container entrypoint (see docker-compose.yml).
# Makes the JSON files committed in ./n8n the source of truth: on every start it
# imports credentials and workflows from the repo, activates the workflows, then
# launches n8n. Re-importing a workflow with the same id updates it in place.
set -u

BOOTSTRAP_DIR=/bootstrap

has_json() { ls "$1"/*.json >/dev/null 2>&1; }

if has_json "$BOOTSTRAP_DIR/credentials"; then
  echo "[bootstrap] importing credentials"
  n8n import:credentials --separate --input="$BOOTSTRAP_DIR/credentials" || echo "[bootstrap] WARNING: credential import failed"
fi

if has_json "$BOOTSTRAP_DIR/workflows"; then
  echo "[bootstrap] importing workflows"
  n8n import:workflow --separate --input="$BOOTSTRAP_DIR/workflows" || echo "[bootstrap] WARNING: workflow import failed"
  # Webhook triggers only listen while a workflow is active.
  n8n update:workflow --all --active=true || echo "[bootstrap] WARNING: could not activate workflows"
else
  echo "[bootstrap] no workflows in $BOOTSTRAP_DIR/workflows yet; starting n8n empty"
fi

# A failed import must never stop n8n itself from starting.
exec n8n start
