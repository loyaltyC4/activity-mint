# Activity Mint — Hetzner 5-Worker Cluster

Five isolated Docker containers, each running its own Playwright/Chromium with one
Instagram account, one residential proxy IP, and one persistent Chrome profile.
A single orchestrator on port 3001 sits in front and routes scrape jobs.

## Architecture

```
        Vercel (apify-proxy.js)
                │
                ▼ POST :3001/scrape
   ┌────────── orchestrator ──────────┐
   │  routing: sticky-by-target       │
   └─────┬──────┬──────┬──────┬──────┘
         │      │      │      │
         ▼      ▼      ▼      ▼
      w1     w2     w3     w4     w5
   (acct1)(acct2)(acct3)(acct4)(acct5)
   (ip1)  (ip2)  (ip3)  (ip4)  (ip5)
   (pr1)  (pr2)  (pr3)  (pr4)  (pr5)
```

## Hard pairings (never rotate)

| Worker   | Account            | Proxy IP         | Profile    |
|----------|--------------------|------------------|------------|
| worker_1 | (IG_USER_1)        | 168.158.21.28    | profile_1  |
| worker_2 | (IG_USER_2)        | 165.254.99.133   | profile_2  |
| worker_3 | (IG_USER_3)        | 65.195.109.107   | profile_3  |
| worker_4 | (IG_USER_4)        | 161.77.140.110   | profile_4  |
| worker_5 | (IG_USER_5)        | 77.47.158.43     | profile_5  |

## First-time deployment (Hetzner host)

```bash
# 1. SSH in
ssh root@46.224.227.199

# 2. Clone the repo to /opt/activitymint
mkdir -p /opt/activitymint && cd /opt/activitymint
git clone https://github.com/loyaltyC4/activity-mint.git .

# 3. Create the real .env (NEVER commit this)
cp hetzner-cluster/.env.example .env
nano .env
#  ↑ Fill in: SCRAPER_SECRET, proxy creds, all 5 Instagram accounts (user:pass:2fa)

# 4. Run the deploy script
bash hetzner-cluster/deploy.sh
```

## Daily operations

```bash
# Tail logs
docker compose -f /opt/activitymint/hetzner-cluster/docker-compose.yml logs -f

# Restart one worker (e.g. after a block)
docker compose restart worker_3

# Check worker health
curl -H "X-Secret: $SCRAPER_SECRET" http://localhost:3001/health
```

## What lives where

- `docker-compose.yml` — 5 workers + orchestrator + redis, defines isolation
- `orchestrator/` — Node.js service on port 3001 that routes to workers
- `worker/` — Node.js + Playwright service that logs in once + handles scrape jobs
- `.env.example` — template (committed)
- `.env` — real creds (NEVER committed, lives only on Hetzner)
- `deploy.sh` — one-shot deploy from the Hetzner host
