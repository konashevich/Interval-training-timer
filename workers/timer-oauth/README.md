# VPRAVA.ONLINE OAuth proxy (Cloudflare Worker)

See **[docs/google-oauth/README.md](../../docs/google-oauth/README.md)**.

```bash
source /mnt/merged_ssd/Cloudflare/account.env
./scripts/deploy-oauth-worker.sh
```

Health check after deploy: `curl -sS https://timer-api.konashevych.com/health`
