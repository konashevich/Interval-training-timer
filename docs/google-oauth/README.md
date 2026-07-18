# Google Drive & OAuth — VPRAVA.ONLINE

Operator runbook for Google sign-in, Drive vault sync/backup, and share links.

**GCP project:** `vprava-online` (display name **vprava**, number `745192830125`) · Console: https://console.cloud.google.com/home/dashboard?project=vprava-online  
**App (primary):** https://vprava.online/  
**App (legacy):** https://timer.konashevych.com/  
**OAuth proxy (current):** https://timer-api.konashevych.com/ — **retarget to** https://api.vprava.online/

---

## 1. What users get

| Feature | Behavior |
|---------|----------|
| **Drive sync** | Bidirectional merge of local trainings with `timer.konashevych.com/vault/` on Drive (legacy folder name) |
| **Auto-backup** | Debounced push after local saves when enabled in Settings |
| **Share** | Snapshot under `shared/` → `https://vprava.online/#share={fileId}` |

Trainings remain in browser `localStorage`. Drive is backup/cross-device only. Scope: `drive.file` (+ openid/email/profile).

---

## 2. Architecture

```text
Browser (vprava.online or timer.konashevych.com)
  │ PKCE popup → Google
  │ access_token in localStorage / IndexedDB
  │ cookie itt_oauth → timer-api.konashevych.com
  ├─ POST /oauth/exchange|refresh|revoke ──► Cloudflare Worker
  │                                         (client_secret + refresh tokens in KV)
  └─ Drive API ────────────────────────────► Drive folder timer.konashevych.com/
```

---

## 3. GCP Console (project vprava-online)

1. Open [Google Cloud Console](https://console.cloud.google.com/home/dashboard?project=vprava-online) → project **vprava** (`vprava-online`, number `745192830125`).
2. Enable **Google Drive API** (Library) if not already enabled (already enabled at project creation).
3. Link a **billing account** if Google requires it for API quotas.
4. **OAuth consent screen** (External): app name `VPRAVA.ONLINE`; privacy/terms:
   - https://vprava.online/privacy/
   - https://vprava.online/terms/
5. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: `VPRAVA.ONLINE`
   - Authorized JavaScript origins:
     - `https://vprava.online`
     - `https://www.vprava.online`
     - `http://localhost:8080` (dev)
   - Authorized redirect URIs:
     - `https://vprava.online/oauth-callback.html`
     - `https://www.vprava.online/oauth-callback.html`
6. Copy **Client ID** into [`js/google-drive/config.js`](../../js/google-drive/config.js) (`GOOGLE_CLIENT_ID`).
7. Copy **Client secret** — set only as Worker secret (never commit):
   ```bash
   source /mnt/merged_ssd/Cloudflare/account.env
   export GOOGLE_CLIENT_SECRET='...'
   ./scripts/deploy-oauth-worker.sh
   ```
8. Create an **API key**, restrict to Google Drive API + HTTP referrers for `vprava.online`, put in `GOOGLE_API_KEY` in `config.js` (needed for anonymous `#share=` opens).
9. Consent scopes: `drive.file`, `openid`, `email`, `profile`. While in Testing, add test users; publish when ready.

Also set Worker `[vars].GOOGLE_CLIENT_ID` in [`workers/timer-oauth/wrangler.toml`](../../workers/timer-oauth/wrangler.toml) to the same Client ID before deploy. Retarget Worker host to `api.vprava.online` (cookie domain `.vprava.online`).

---

## 4. Cloudflare Worker + DNS

```bash
source /mnt/merged_ssd/Cloudflare/account.env
./scripts/deploy-oauth-worker.sh
./scripts/ensure-api-timer-dns.sh
curl -sS https://timer-api.konashevych.com/health
```

Worker code: [`workers/timer-oauth/`](../../workers/timer-oauth/).

Secrets: `SESSION_SIGNING_KEY`, `GOOGLE_CLIENT_SECRET`.

**Hostname note:** use `timer-api.konashevych.com` (not `api.timer.…`). Cloudflare Free Universal SSL covers `*.konashevych.com` but not nested `api.timer.konashevych.com`.

---

## 5. App config

[`js/google-drive/config.js`](../../js/google-drive/config.js):

| Constant | Purpose |
|----------|---------|
| `GOOGLE_CLIENT_ID` | Enables Drive UI when non-empty |
| `GOOGLE_API_KEY` | Public share downloads |
| `OAUTH_PROXY_URL` | Default `https://timer-api.konashevych.com` |
| `SITE_URL` | Primary site `https://vprava.online` |
| `DEFAULT_DRIVE_ROOT_FOLDER` | Legacy `timer.konashevych.com` (keep for existing vaults) |
| `GOOGLE_DRIVE_ENABLED` | Hard off switch |

Feature is hidden in Settings until `GOOGLE_CLIENT_ID` is set.

---

## 6. Drive layout

```text
timer.konashevych.com/
├── vault/
│   ├── manifest.json
│   └── trainings/{id}.json
└── shared/
    └── share-{timestamp}.json
```

Merge rule: last-write-wins per training by `updatedAt`. Deletes are sync'd via manifest `deleted` tombstones; orphan training files are trashed after push.
