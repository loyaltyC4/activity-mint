# Activity Mint — Hetzner 5-Worker Cluster (CloakBrowser)

Five isolated Docker containers, each running its own [CloakBrowser](https://github.com/CloakHQ/CloakBrowser)
stealth Chromium with one Instagram account, one dedicated SOCKS5 proxy IP, and
one persistent profile. A single orchestrator on port 3001 sits in front and
routes scrape jobs sticky-by-username with least-loaded fallback.

## Architecture

```
        Vercel (api/apify-proxy.js)
                │
                ▼ POST :3001/scrape  (X-Secret header)
   ┌────────── orchestrator ──────────┐
   │  routing: sticky-by-username     │
   │  state:  Redis (counters, blocks)│
   └─────┬──────┬──────┬──────┬──────┘
         │      │      │      │
         ▼      ▼      ▼      ▼
      w1     w2     w3     w4     w5
   (acct1)(acct2)(acct3)(acct4)(acct5)
   (ip1)  (ip2)  (ip3)  (ip4)  (ip5)
   (pr1)  (pr2)  (pr3)  (pr4)  (pr5)
```

## CloakBrowser features in use

Each worker launches CloakBrowser with these stealth options (see `worker/server.js`):

- **`geoip: true`** — auto-detects timezone + locale from the proxy exit IP
  (so worker_3 routed through a Texas residential IP automatically gets
  `America/Chicago` and `en-US`). Also auto-injects `--fingerprint-webrtc-ip`
  so WebRTC can't leak the host IP through the SOCKS/HTTPS tunnel.
- **`humanize: true`** — every Playwright call (`page.click`, `page.fill`,
  `page.locator(...).type`, etc.) is replaced with human-equivalent behavior:
  mouse Bezier curves, per-character typing delays with thinking pauses,
  realistic scroll easing.
- **Persistent `userDataDir`** at `/app/profile` (host-mounted from
  `/opt/activitymint/profiles/profile_N`) — cookies and localStorage survive
  container restarts, so sessions look like a real returning user (no
  incognito-detection).
- **58 source-level Chromium patches** baked into the CloakBrowser binary
  cover canvas, WebGL, audio, fonts, GPU, screen properties, WebRTC, network
  timing, automation signal removal, and CDP input behavior. No JS-level
  `playwright-stealth` overrides needed — the patches are at the C++ source.

## Hard pairings (never rotate)

| Worker   | Account                | Proxy IP         | Profile    |
|----------|------------------------|------------------|------------|
| worker_1 | `IG_USER_1`            | 168.158.21.28    | profile_1  |
| worker_2 | `IG_USER_2`            | 165.254.99.133   | profile_2  |
| worker_3 | `IG_USER_3`            | 65.195.109.107   | profile_3  |
| worker_4 | `IG_USER_4`            | 161.77.140.110   | profile_4  |
| worker_5 | `IG_USER_5`            | 77.47.158.43     | profile_5  |

## First-time deployment (on the Hetzner host)

```bash
# 1. SSH in
ssh root@46.224.227.199

# 2. Clone the repo to /opt/activitymint (skip if already cloned)
mkdir -p /opt/activitymint && cd /opt/activitymint
git clone https://github.com/loyaltyC4/activity-mint.git .
# or: git pull

# 3. Create the real .env (NEVER commit this)
cp hetzner-cluster/.env.example .env
nano .env
#  ↑ Fill in: SCRAPER_SECRET (must match Vercel),
#             proxy creds, all 5 Instagram accounts (user:pass:totp-secret).

# 4. Run the deploy script
bash hetzner-cluster/deploy.sh
```

The first build pulls the CloakBrowser patched Chromium binary (~200MB) once
per worker image during `docker compose build`; after that, `docker compose up
-d` is near-instant.

## Daily operations

```bash
# Tail logs (all containers, follow)
docker compose -f /opt/activitymint/hetzner-cluster/docker-compose.yml logs -f

# Just one worker
docker compose -f /opt/activitymint/hetzner-cluster/docker-compose.yml logs -f worker_3

# Restart one worker (e.g. after a block)
docker compose -f /opt/activitymint/hetzner-cluster/docker-compose.yml restart worker_3

# Check cluster health
curl -H "X-Secret: $SCRAPER_SECRET" http://localhost:3001/health | jq

# Smoke-test a scrape (replace USERNAME and SECRET)
curl -X POST http://localhost:3001/scrape \
  -H "X-Secret: $SCRAPER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action":"profile","payload":{"username":"instagram"}}'
```

## What lives where

- `docker-compose.yml` — 5 workers + orchestrator + redis, defines isolation.
- `orchestrator/` — Node.js + Express on :3001. Routes to workers, tracks
  per-worker request counters and 429-blocked windows in Redis, sticky-by-target
  with 7-day TTL.
- `worker/` — Node.js + Express on :3010, runs CloakBrowser via the
  `cloakbrowser` npm package. Single-flight job queue per worker, idempotent
  login with TOTP 2FA (otplib), scrape actions: profile / followers / following / stories.
- `.env.example` — template (committed).
- `.env` — real creds (NEVER committed, lives only on Hetzner host at
  `/opt/activitymint/.env`).
- `deploy.sh` — one-shot deploy from the Hetzner host (checks env, tests
  proxies, builds, brings up the stack, calls /health).

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `/health` shows worker `logged_in: false` | Initial login still running, or 2FA secret wrong | Wait 30s; check `docker compose logs worker_N` for the `2fa_required_but_no_secret` or `incorrect_2fa_code` line |
| `/health` shows worker `blocked: true` | Instagram challenge / suspicious login | `docker compose restart worker_N`; if it repeats, the account is cooked — replace it in `.env` |
| Worker container won't start | Missing env var | `docker compose logs worker_N` — should print `IG_USERNAME / IG_PASSWORD missing` etc. |
| `unauthorized` on /scrape | SCRAPER_SECRET mismatch | Make sure Vercel's `SCRAPER_SECRET` env var equals the one in `/opt/activitymint/.env` |
| Slow first request | CloakBrowser binary download | Should be pre-pulled at build; if not, first scrape downloads ~200MB through the worker's proxy |
