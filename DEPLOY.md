# Deploying My Idea Vault

The app is a fully static PWA — the build output in `dist/` is just files.
`dist/` is intentionally **not** in git; whatever deploys the app runs
`npm run build` and serves the result.

Hard requirement: **HTTPS**. Service workers and OPFS only work on secure
origins, so the PWA won't install or store data over plain HTTP.

Use a dedicated subdomain (e.g. `ideas.yourdomain.com`). Don't serve it under
a path of an existing site — OPFS storage is per-origin, and a subdomain keeps
the vault isolated from anything else (like a WordPress site) on the domain.

## Option A — Cloudflare Pages (recommended, no server needed)

Free static hosting on Cloudflare's CDN, auto-building from GitHub on every
push. Nothing to maintain on the VPS.

1. Cloudflare dashboard → **Workers & Pages → Create → Pages →
   Connect to Git** → pick this repository and branch.
2. Build settings:
   - Build command: `npm run build`
   - Build output directory: `dist`
3. Deploy, then **Custom domains → Add** `ideas.yourdomain.com`. Since the
   domain is already on Cloudflare, DNS + TLS are wired up automatically.

Every push to the selected branch redeploys. Installed apps pick up new
versions automatically (the service worker auto-updates).

## Option B — EasyPanel on the VPS

The repo ships a `Dockerfile` (Node build stage → nginx serving `dist/` with
correct service-worker/manifest cache headers). EasyPanel builds it directly
from GitHub.

1. **DNS**: in Cloudflare, add an `A` record `ideas` → your VPS public IP.
2. **EasyPanel**: Project → **+ Service → App**:
   - Source: this GitHub repository + branch
   - Build: **Dockerfile** (auto-detected at repo root)
   - Port: `80`
3. Service → **Domains**: add `ideas.yourdomain.com`, enable **HTTPS**
   (Let's Encrypt).
4. Cloudflare TLS: with the record proxied (orange cloud), set
   **SSL/TLS mode → Full (strict)**. If Let's Encrypt issuance fails behind
   the proxy, temporarily set the record to *DNS only* (grey cloud), issue the
   cert, then re-enable the proxy.
5. Redeploy on push: enable auto-deploy in the service settings (EasyPanel
   GitHub webhook), or click Deploy manually after pushing.

## What about WordPress?

Nothing to do — the app is standalone and shouldn't live inside WordPress.
At most, add a menu link on the WordPress site pointing to
`https://ideas.yourdomain.com`.

## After deploying

Open the URL in Chrome on Android → ⋮ menu → **Add to Home screen** (or the
install button in the app's Settings). Then verify offline mode: enable
airplane mode and reopen the installed app — it should work fully.
