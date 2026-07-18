#!/usr/bin/env bash
# Deploy VPRAVA.ONLINE Google OAuth proxy to Cloudflare Workers.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORKER_DIR="${ROOT}/workers/timer-oauth"
CF_ENV="${CLOUDFLARE_ENV:-/mnt/merged_ssd/Cloudflare/account.env}"
if [[ -f "$CF_ENV" ]]; then
  # shellcheck source=/dev/null
  source "$CF_ENV"
fi

: "${CLOUDFLARE_API_TOKEN:?Set CLOUDFLARE_API_TOKEN (Workers + KV permissions)}"
: "${CLOUDFLARE_ACCOUNT_ID:?Set CLOUDFLARE_ACCOUNT_ID}"

export CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID

cd "$WORKER_DIR"
npm install

if grep -q 'REPLACE_AFTER_KV_CREATE' wrangler.toml; then
  echo "Creating KV namespace..."
  KV_OUT="$(npx wrangler kv namespace create OAUTH_KV 2>&1)" || true
  echo "$KV_OUT"
  KV_ID="$(echo "$KV_OUT" | grep -oE 'id = "[a-f0-9]+"' | head -1 | grep -oE '[a-f0-9]+' || true)"
  if [[ -z "$KV_ID" ]]; then
    KV_ID="$(echo "$KV_OUT" | grep -oE '[a-f0-9]{32}' | head -1 || true)"
  fi
  if [[ -z "$KV_ID" ]]; then
    echo "Failed to create/parse KV namespace id" >&2
    exit 1
  fi
  sed -i "s/REPLACE_AFTER_KV_CREATE/${KV_ID}/g" wrangler.toml
  echo "KV namespace id: ${KV_ID}"
else
  echo "KV namespace already configured in wrangler.toml"
fi

if grep -q 'REPLACE_AFTER_OAUTH_CLIENT' wrangler.toml; then
  if [[ -z "${GOOGLE_CLIENT_ID:-}" ]]; then
    echo "WARN: GOOGLE_CLIENT_ID not set; wrangler.toml still has placeholder." >&2
    echo "Create OAuth Web client in GCP chromium-466007 and update wrangler.toml + js/google-drive/config.js" >&2
  else
    sed -i "s/REPLACE_AFTER_OAUTH_CLIENT/${GOOGLE_CLIENT_ID}/g" wrangler.toml
  fi
fi

if [[ -z "${SESSION_SIGNING_KEY:-}" ]]; then
  SESSION_SIGNING_KEY="$(openssl rand -hex 32)"
  echo "Generated SESSION_SIGNING_KEY"
fi
echo "$SESSION_SIGNING_KEY" | npx wrangler secret put SESSION_SIGNING_KEY

if [[ -z "${GOOGLE_CLIENT_SECRET:-}" ]]; then
  echo "WARN: GOOGLE_CLIENT_SECRET not set — Worker exchange/refresh will fail until you set it:" >&2
  echo "  echo 'SECRET' | npx wrangler secret put GOOGLE_CLIENT_SECRET" >&2
else
  echo "$GOOGLE_CLIENT_SECRET" | npx wrangler secret put GOOGLE_CLIENT_SECRET
fi

npx wrangler deploy

echo ""
echo "Deployed. Verify: curl -sS https://timer-api.konashevych.com/health"
echo "DNS (if needed): ${ROOT}/scripts/ensure-api-timer-dns.sh"
