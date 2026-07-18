# VPRAVA.ONLINE

**Product name:** VPRAVA.ONLINE  
**Primary domain:** https://vprava.online/  
**Repo:** https://github.com/konashevich/Interval-training-timer  

Ukrainian *вправа* (“exercise”) rendered as a clean Latin brand. This is an interval-training timer PWA (vanilla HTML/JS, no build step).

## For agents

- Prefer the name **VPRAVA.ONLINE** (or `vprava.online`) in UI copy, docs, commits, and user-facing strings — not “Interval Training Timer”.
- Primary public URL is `https://vprava.online/`. Legacy parallel host: `https://timer.konashevych.com/`.
- GitHub Pages custom domain is set via root `CNAME` (`vprava.online`). Pages source branch: `main`.
- OAuth proxy stays at `https://timer-api.konashevych.com/` (Cloudflare Worker `workers/timer-oauth/`).
- Google Drive vault folder name remains `timer.konashevych.com` on purpose so existing user vaults keep resolving (`js/google-drive/config.js` → `DEFAULT_DRIVE_ROOT_FOLDER`).
- Operator runbook: `docs/google-oauth/README.md`. Domain/DNS notes: `/mnt/merged_ssd/Cloudflare/vprava.online/status.md`.
- Do not invent a second product name or rebrand mid-task; keep casing **VPRAVA.ONLINE** in titles and **vprava.online** in URLs.

## Stack (short)

Vanilla PWA (`index.html` + `js/`), Tailwind/Lucide CDN, `localStorage` presets, optional Google Drive sync via OAuth Worker.
