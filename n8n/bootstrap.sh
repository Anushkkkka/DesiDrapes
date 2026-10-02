#!/bin/sh
# n8n container entrypoint (see docker-compose.yml).
# Makes the JSON files committed in ./n8n the source of truth: on every start it
# imports credentials and workflows from the repo, publishes (activates) each
# workflow, then launches n8n. Re-importing a workflow with the same id updates it.
set -u

BOOTSTRAP_DIR=/bootstrap
STAGING=/tmp/n8n-bootstrap-workflows

has_json() { ls "$1"/*.json >/dev/null 2>&1; }

if has_json "$BOOTSTRAP_DIR/credentials"; then
  echo "[bootstrap] importing credentials"
  n8n import:credentials --separate --input="$BOOTSTRAP_DIR/credentials" || echo "[bootstrap] WARNING: credential import failed"
fi

if has_json "$BOOTSTRAP_DIR/workflows"; then
  # n8n stores each import as a workflow-history version keyed by versionId, so every
  # boot needs a fresh versionId or re-importing unchanged files would collide.
  rm -rf "$STAGING" && mkdir -p "$STAGING"
  node -e '
    const fs = require("fs"), path = require("path"), crypto = require("crypto");
    const [src, dst] = process.argv.slice(1);
    for (const f of fs.readdirSync(src).filter((f) => f.endsWith(".json"))) {
      const wf = JSON.parse(fs.readFileSync(path.join(src, f), "utf8"));
      wf.versionId = crypto.randomUUID();
      fs.writeFileSync(path.join(dst, f), JSON.stringify(wf));
      console.log(wf.id);
    }' "$BOOTSTRAP_DIR/workflows" "$STAGING" > "$STAGING.ids"

  echo "[bootstrap] importing $(wc -l < "$STAGING.ids") workflows"
  if n8n import:workflow --separate --input="$STAGING"; then
    # Webhook triggers only listen while a workflow is published (active).
    while read -r id; do
      n8n publish:workflow --id="$id" >/dev/null 2>&1 \
        && echo "[bootstrap] published $id" \
        || echo "[bootstrap] WARNING: could not publish $id"
    done < "$STAGING.ids"
  else
    echo "[bootstrap] WARNING: workflow import failed"
  fi
else
  echo "[bootstrap] no workflows in $BOOTSTRAP_DIR/workflows yet; starting n8n empty"
fi

# A failed import must never stop n8n itself from starting.
exec n8n start
