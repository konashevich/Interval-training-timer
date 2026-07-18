#!/usr/bin/env bash
# Ensure CNAME timer-api.konashevych.com for the Workers route.
# Uses CLOUDFLARE_DNS_API_TOKEN from Cloudflare/konashevych.com/.env when present
# (account Workers token often lacks Zone DNS:Edit).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CF_ENV="${CLOUDFLARE_ENV:-/mnt/merged_ssd/Cloudflare/account.env}"
ZONE_ENV="/mnt/merged_ssd/Cloudflare/konashevych.com/.env"

if [[ -f "$CF_ENV" ]]; then
  # shellcheck source=/dev/null
  source "$CF_ENV"
fi
if [[ -f "$ZONE_ENV" ]]; then
  # shellcheck source=/dev/null
  source "$ZONE_ENV"
fi

TOKEN="${CLOUDFLARE_DNS_API_TOKEN:-${CLOUDFLARE_API_TOKEN:-}}"
: "${TOKEN:?Set CLOUDFLARE_DNS_API_TOKEN or CLOUDFLARE_API_TOKEN}"

ZONE_NAME="konashevych.com"
RECORD_NAME="timer-api"
API="https://api.cloudflare.com/client/v4"

ZONE_ID="$(curl -sS -H "Authorization: Bearer ${TOKEN}" \
  "${API}/zones?name=${ZONE_NAME}" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d["result"][0]["id"] if d.get("result") else "")')"

if [[ -z "$ZONE_ID" ]]; then
  echo "Zone ${ZONE_NAME} not found" >&2
  exit 1
fi

EXISTING="$(curl -sS -H "Authorization: Bearer ${TOKEN}" \
  "${API}/zones/${ZONE_ID}/dns_records?name=${RECORD_NAME}.${ZONE_NAME}&type=CNAME")"

HAS="$(echo "$EXISTING" | python3 -c 'import sys,json; d=json.load(sys.stdin); print("yes" if d.get("result") else "no")')"

if [[ "$HAS" == "yes" ]]; then
  echo "DNS CNAME ${RECORD_NAME}.${ZONE_NAME} already exists"
  echo "$EXISTING" | python3 -c 'import sys,json; d=json.load(sys.stdin); r=d["result"][0]; print(r["name"], "->", r["content"], "proxied=", r.get("proxied"))'
  exit 0
fi

PAYLOAD='{"type":"CNAME","name":"timer-api","content":"konashevych.com","ttl":1,"proxied":true}'
RESP="$(curl -sS -X POST -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  --data "$PAYLOAD" \
  "${API}/zones/${ZONE_ID}/dns_records")"

echo "$RESP" | python3 -c 'import sys,json; d=json.load(sys.stdin); print("ok" if d.get("success") else d); raise SystemExit(0 if d.get("success") else 1)'
echo "Created proxied CNAME ${RECORD_NAME}.${ZONE_NAME} → konashevych.com"
