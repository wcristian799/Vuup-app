# VUUP — Production Deploy Runbook

First production deploy of VUUP.

- **Frontend (PWA):** Vercel
- **Backend (Hono + SQLite):** self-hosted VPS running Coolify (Docker)
- **Source branch:** `integration/all-waves` (typecheck-clean; web + server tests green)
- **Repo:** https://github.com/wcristian799/Vuup-app.git

> Realtime note: the dispute/Efeito-Enxame "realtime" layer uses **Server-Sent
> Events (EventSource)** over the same HTTP API base URL (`/matching/*/stream`),
> not a separate WebSocket port. The reverse proxy must therefore **disable
> response buffering** for `/matching/` so SSE frames flush immediately. There is
> no separate WS upgrade endpoint to configure.

---

## 1. Prerequisites (founder must provide before going live)

These are environment/access inputs, not code. Gather them via the issue
interaction; do not guess or commit them.

| Need                                                             | Used for                                  |
| ---------------------------------------------------------------- | ----------------------------------------- |
| Vercel account/project access (or founder runs the Vercel build) | Frontend host                             |
| VPS reachable + Coolify installed and reachable                  | Backend host                              |
| Public domain for frontend, e.g. `vuup.app` / `www.vuup.app`     | PWA URL + CORS                            |
| Public domain for backend API, e.g. `api.vuup.app`               | Client `VITE_API_URL` + TLS               |
| DNS control for the above domains                                | A/CNAME records → Vercel + VPS            |
| `AUTH_SECRET` value (random, 32+ chars)                          | JWT signing in prod (generate, see below) |

Generate a strong `AUTH_SECRET`:

```bash
openssl rand -base64 48 | tr -d '/+=' | head -c 48
```

---

## 2. Environment variable inventory (names only — never commit values)

### Backend (set in Coolify → service → Environment)

| Var            | Required | Notes                                                                            |
| -------------- | -------- | -------------------------------------------------------------------------------- |
| `NODE_ENV`     | yes      | Must be `production`. Enables strict OTP + the AUTH_SECRET guard.                |
| `AUTH_SECRET`  | yes      | Random 32+ chars. Server **refuses to boot** in prod without it.                 |
| `CORS_ORIGINS` | yes      | Comma-separated frontend origins, e.g. `https://vuup.app,https://www.vuup.app`.  |
| `DB_PATH`      | no       | Defaults to `/app/data/vuup.db` in the image. Keep it inside the mounted volume. |
| `PORT`         | no       | Defaults to `3001`. Match the Coolify port mapping.                              |

### Frontend (set in Vercel → project → Settings → Environment Variables)

| Var            | Required | Notes                                                                                                                                                 |
| -------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_API_URL` | yes      | Backend base URL, e.g. `https://api.vuup.app`. Baked in at build time.                                                                                |
| `VITE_BASE`    | yes      | Set to `/` for web. (Capacitor builds use the default `./`.) Already set by `vercel.json`'s build command — only override if not using `vercel.json`. |

---

## 3. Backend deploy (Coolify / VPS)

The production image is `server/Dockerfile` (multi-stage, Node 20 Alpine,
non-root `appuser`, compiles `better-sqlite3` in the builder stage).

1. In Coolify, create a new **Dockerfile** application from the Git repo.
   - Branch: `main` (after merge) or `integration/all-waves`.
   - Build context / base directory: `server`
   - Dockerfile path: `server/Dockerfile`
2. Set the backend env vars from §2.
3. **Persistent storage:** add a volume mounted at `/app/data` so the SQLite DB
   survives redeploys. (The image declares `VOLUME ["/app/data"]` and defaults
   `DB_PATH=/app/data/vuup.db`.)
4. **Port:** expose container port `3001` (or your `PORT`); map Coolify's proxy to it.
5. **Domain + TLS:** assign `api.vuup.app`; Coolify provisions Let's Encrypt TLS.
6. **Reverse proxy / SSE:** ensure proxy buffering is OFF for the API (Traefik:
   no special config needed; Nginx: `proxy_buffering off;` for `/matching/`).
   Healthcheck path: `/health`.
7. Deploy. The container `HEALTHCHECK` polls `/health`; Coolify shows healthy
   once `{"status":"ok"}` returns.

Local image sanity check (optional, on the VPS or any Docker host):

```bash
docker build -t vuup-api ./server
docker run --rm -p 3001:3001 \
  -e NODE_ENV=production \
  -e AUTH_SECRET="$(openssl rand -base64 48 | tr -d '/+=' | head -c 48)" \
  -e CORS_ORIGINS="https://vuup.app" \
  -v vuup_data:/app/data \
  vuup-api
curl -s http://127.0.0.1:3001/health   # -> {"status":"ok",...}
```

---

## 4. Frontend deploy (Vercel)

Config lives in `vercel.json` (repo root):

- `buildCommand`: `VITE_BASE=/ npm run build`
- `outputDirectory`: `dist`
- SPA rewrite: all paths → `/index.html` (TanStack Router client routing)
- Long-cache headers for `/assets/*`; no-cache for `sw.js` and the manifest.

Steps:

1. Import the repo into Vercel. Framework preset: **Other** (`framework: null`).
   `vercel.json` supplies build + output settings.
2. Set `VITE_API_URL` (and `VITE_BASE=/` if not relying on `vercel.json`).
3. Assign the domain (`vuup.app` / `www.vuup.app`) and let Vercel handle TLS.
4. Deploy. After build, confirm:
   - The production URL serves the app.
   - `view-source` shows root-absolute asset paths (`/assets/...`).
   - `sw.js` and `manifest.webmanifest` are reachable; the SW registers.

> After setting `CORS_ORIGINS` on the backend, the Vercel origin must appear in
> that list or browser API calls will be blocked by CORS.

---

## 5. Post-deploy smoke test

```bash
# Backend health
curl -s https://api.vuup.app/health
# -> {"status":"ok","mode":"persistent",...}

# CORS preflight from the frontend origin
curl -s -i -X OPTIONS https://api.vuup.app/rides \
  -H "Origin: https://vuup.app" \
  -H "Access-Control-Request-Method: POST" | grep -i access-control

# Auth round-trip (dev OTP is disabled in prod; use a real flow)
curl -s -X POST https://api.vuup.app/auth/otp-request \
  -H "Content-Type: application/json" -d '{"phone":"+5511999999999"}'
```

Frontend (manual, hand to QA):

1. Load `https://vuup.app` — app shell renders, no console CORS errors.
2. Complete login → passenger ride request → fare estimate.
3. Open a ride dispute and confirm the SSE stream pushes live updates.
4. Install the PWA (Add to Home Screen) and confirm it launches standalone.

---

## 6. Rollback

- **Frontend:** Vercel → Deployments → select the previous deployment →
  **Promote to Production** (instant).
- **Backend:** Coolify → application → **Rollback** to the previous deployment,
  or redeploy a known-good commit. The SQLite volume is untouched by rollbacks,
  so data persists. Take a copy of `vuup.db` from the volume before risky
  migrations.

---

## 7. Security checklist

- [ ] `AUTH_SECRET` is random, 32+ chars, never committed (the server refuses to
      boot in prod otherwise).
- [ ] `CORS_ORIGINS` lists only the real frontend origins (no wildcards).
- [ ] TLS active on both domains; HTTP redirects to HTTPS.
- [ ] SQLite DB on a persistent volume; backup taken before migrations.
- [ ] No `.env` / secrets in the repo (`.gitignore` excludes `.env*`).
- [ ] `NODE_ENV=production` on the backend (strict OTP, no dev bypass).
