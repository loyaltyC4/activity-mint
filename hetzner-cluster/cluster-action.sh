#!/bin/bash
#
# Activity Mint Hetzner cluster action runner.
#
# This script is invoked from .github/workflows/deploy-hetzner-cluster.yml.
# The workflow's run step is a thin wrapper that injects secrets as env vars
# and execs this file with $ACTION as the first argument. Keeping the logic
# here keeps the workflow YAML under the GitHub Actions 21,000-char limit on
# expression-bodied run blocks (it had grown to 28k once we added enough
# per-action branches).
#
# Required env vars (set by the workflow's env: block):
#   HETZNER_HOST, HETZNER_USER, HETZNER_PASSWORD
#   SCRAPER_SECRET, PROXY_USER, PROXY_PASS
#   IG_USER_1..5, IG_PASS_1..5, IG_2FA_1..5
#   TT_USERNAME, TT_PASSWORD, TT_EMAIL, TT_EMAIL_PASS, TT_PROXY_HOST
#
# Usage:
#   bash hetzner-cluster/cluster-action.sh <action>
#
# Where <action> is one of:
#   deploy, status, restart, logs, diagnostics, smoke,
#   test_each, test_proxies, reset_worker_1, test_tiktok_login,
#   test_unsuspend_w4, reset_worker_4

set -e
ACTION="${1:-deploy}"

# ─── .env content for /opt/activitymint/.env on Hetzner ────────────────────
ENV_CONTENT=$(cat <<EOF
SCRAPER_SECRET=$SCRAPER_SECRET
PROXY_USER=$PROXY_USER
PROXY_PASS=$PROXY_PASS
PROXY_HTTP_PORT=50100
IG_USER_1=$IG_USER_1
IG_PASS_1=$IG_PASS_1
IG_2FA_1=$IG_2FA_1
IG_USER_2=$IG_USER_2
IG_PASS_2=$IG_PASS_2
IG_2FA_2=$IG_2FA_2
IG_USER_3=$IG_USER_3
IG_PASS_3=$IG_PASS_3
IG_2FA_3=$IG_2FA_3
IG_USER_4=$IG_USER_4
IG_PASS_4=$IG_PASS_4
IG_2FA_4=$IG_2FA_4
IG_USER_5=$IG_USER_5
IG_PASS_5=$IG_PASS_5
IG_2FA_5=$IG_2FA_5
EOF
)

# ─── Generic SSH wrapper ───────────────────────────────────────────────────
ssh_run() {
  sshpass -p "$HETZNER_PASSWORD" ssh \
    -o StrictHostKeyChecking=no \
    -o UserKnownHostsFile=/dev/null \
    -o LogLevel=ERROR \
    "$HETZNER_USER@$HETZNER_HOST" \
    "$@"
}

# Helper that pipes ENV_CONTENT to the box (no logging of the content)
write_env_on_host() {
  echo "$ENV_CONTENT" | sshpass -p "$HETZNER_PASSWORD" ssh \
    -o StrictHostKeyChecking=no \
    -o UserKnownHostsFile=/dev/null \
    -o LogLevel=ERROR \
    "$HETZNER_USER@$HETZNER_HOST" \
    "cat > /opt/activitymint/.env && chmod 600 /opt/activitymint/.env && echo '.env written ('$(wc -l < /opt/activitymint/.env)' lines)'"
}

# ─── DEPLOY ───────────────────────────────────────────────────────────────
if [ "$ACTION" = "deploy" ]; then
  echo "==> Verifying SSH connection..."
  ssh_run "echo OK && uname -a && (docker --version || echo 'docker not installed')"

  echo "==> Installing docker (if missing) + docker compose plugin..."
  ssh_run "command -v docker >/dev/null 2>&1 || (apt-get update -qq && apt-get install -y -qq docker.io docker-compose-v2 git curl openssl)"

  echo "==> Cloning/updating repo..."
  ssh_run "mkdir -p /opt/activitymint && cd /opt/activitymint && ( if [ -d .git ]; then git fetch --all && git reset --hard origin/main; else git clone https://github.com/loyaltyC4/activity-mint.git .; fi )"

  echo "==> Writing .env on Hetzner..."
  write_env_on_host

  echo "==> Stopping any existing scraper on port 3001..."
  ssh_run "docker ps --filter 'publish=3001' -q | xargs -r docker stop"
  ssh_run "docker ps -a --filter 'publish=3001' -q | xargs -r docker rm"

  echo "==> Running deploy.sh..."
  ssh_run "cd /opt/activitymint && bash hetzner-cluster/deploy.sh 2>&1 | tail -80"

  echo "==> Final health check..."
  sleep 10
  ssh_run "source /opt/activitymint/.env && curl -s -H \"X-Secret: \$SCRAPER_SECRET\" http://localhost:3001/health | python3 -m json.tool 2>&1 | head -100"
fi

# ─── STATUS ────────────────────────────────────────────────────────────────
if [ "$ACTION" = "status" ]; then
  ssh_run "cd /opt/activitymint && docker compose -f hetzner-cluster/docker-compose.yml ps"
  echo "==> Worker health:"
  ssh_run "source /opt/activitymint/.env && curl -s -H \"X-Secret: \$SCRAPER_SECRET\" http://localhost:3001/health | python3 -m json.tool"
fi

# ─── RESTART ───────────────────────────────────────────────────────────────
if [ "$ACTION" = "restart" ]; then
  ssh_run "cd /opt/activitymint && docker compose -f hetzner-cluster/docker-compose.yml --env-file /opt/activitymint/.env restart"
fi

# ─── LOGS ──────────────────────────────────────────────────────────────────
if [ "$ACTION" = "logs" ]; then
  ssh_run "cd /opt/activitymint && docker compose -f hetzner-cluster/docker-compose.yml logs --tail=100"
fi

# ─── TEST_PROXIES — verify each proxy independently of Instagram ───────────
if [ "$ACTION" = "test_proxies" ]; then
  for ip in 168.158.21.28 165.254.99.133 65.195.109.107 161.77.140.110 77.47.158.43 161.77.70.149; do
    echo "════════════════════════════════════════════════════════════"
    echo "  PROXY $ip"
    echo "════════════════════════════════════════════════════════════"
    echo "─ HTTP (port 50100) exit IP via api.ipify.org ─"
    ssh_run "curl -s --max-time 12 --proxy http://$PROXY_USER:$PROXY_PASS@${ip}:50100 https://api.ipify.org -w ' [code=%{http_code}]' || echo ' [curl_failed]'"
    echo ""
    echo "─ HTTP — instagram.com response code ─"
    ssh_run "curl -s --max-time 15 -o /dev/null -w 'instagram.com [code=%{http_code} time=%{time_total}s]' --proxy http://$PROXY_USER:$PROXY_PASS@${ip}:50100 https://www.instagram.com/ || echo ' [curl_failed]'"
    echo ""
    echo "─ HTTP — instagram /accounts/login/ response code ─"
    ssh_run "curl -s --max-time 15 -o /dev/null -w 'instagram/login [code=%{http_code} time=%{time_total}s]' --proxy http://$PROXY_USER:$PROXY_PASS@${ip}:50100 https://www.instagram.com/accounts/login/ || echo ' [curl_failed]'"
    echo ""
  done
fi

# ─── TEST_EACH — bypass orchestrator, hit each worker container directly ───
if [ "$ACTION" = "test_each" ]; then
  for w in 1 2 3 4 5; do
    echo "════════════════════════════════════════════════════════════"
    echo "  WORKER $w"
    echo "════════════════════════════════════════════════════════════"
    echo "─ /health ─"
    ssh_run "docker exec am_worker_${w} curl -s --max-time 5 http://localhost:3010/health" | python3 -m json.tool 2>/dev/null || echo '(invalid json)'
    echo ""
    echo "─ scrape profile @instagram ─"
    ssh_run "source /opt/activitymint/.env && docker exec am_worker_${w} curl -s --max-time 90 -X POST -H \"X-Secret: \$SCRAPER_SECRET\" -H 'Content-Type: application/json' -d '{\"action\":\"profile\",\"payload\":{\"username\":\"instagram\"}}' http://localhost:3010/scrape" | python3 -m json.tool 2>/dev/null | head -25 || echo '(scrape returned non-json)'
    echo ""
  done
fi

# ─── SMOKE — end-to-end real scrape through the orchestrator ──────────────
if [ "$ACTION" = "smoke" ]; then
  echo "==> /health from inside the box"
  ssh_run "source /opt/activitymint/.env && curl -s -H \"X-Secret: \$SCRAPER_SECRET\" http://localhost:3001/health | python3 -m json.tool"
  echo ""
  echo "==> Real scrape: profile @instagram"
  ssh_run "source /opt/activitymint/.env && curl -s -X POST -H \"X-Secret: \$SCRAPER_SECRET\" -H 'Content-Type: application/json' --max-time 120 -d '{\"action\":\"profile\",\"payload\":{\"username\":\"instagram\"}}' http://localhost:3001/scrape | python3 -m json.tool | head -100"
  echo ""
  echo "==> Real scrape: followers @instagram limit=10"
  ssh_run "source /opt/activitymint/.env && curl -s -X POST -H \"X-Secret: \$SCRAPER_SECRET\" -H 'Content-Type: application/json' --max-time 180 -d '{\"action\":\"followers\",\"payload\":{\"username\":\"instagram\",\"limit\":10}}' http://localhost:3001/scrape | python3 -m json.tool | head -100"
fi

# ─── RESET_WORKER_N — stop worker, wipe its profile dir, restart fresh ─────
# Shared helper used by reset_worker_1 / reset_worker_4. Pass worker number
# as $1. Used after changing credentials or proxy: ensures CloakBrowser
# launches with no stale cookies / SingletonLock files.
reset_one_worker() {
  local W="$1"
  echo "==> Pulling latest repo (so docker-compose has current config)..."
  ssh_run "cd /opt/activitymint && git fetch --all && git reset --hard origin/main"

  echo "==> Writing latest .env on Hetzner..."
  write_env_on_host

  echo "==> Stopping + removing worker_${W}..."
  ssh_run "cd /opt/activitymint && docker compose -f hetzner-cluster/docker-compose.yml --env-file /opt/activitymint/.env stop worker_${W} && docker compose -f hetzner-cluster/docker-compose.yml --env-file /opt/activitymint/.env rm -f worker_${W}"

  echo "==> Wiping /opt/activitymint/profiles/profile_${W} contents..."
  ssh_run "rm -rf /opt/activitymint/profiles/profile_${W}/* /opt/activitymint/profiles/profile_${W}/.* 2>/dev/null; mkdir -p /opt/activitymint/profiles/profile_${W}; ls -la /opt/activitymint/profiles/profile_${W}"

  echo "==> Rebuilding + bringing worker_${W} back up..."
  ssh_run "cd /opt/activitymint && docker compose -f hetzner-cluster/docker-compose.yml --env-file /opt/activitymint/.env up -d --build worker_${W}"

  echo "==> Waiting 40s for CloakBrowser launch + login flow..."
  sleep 40

  echo "==> Worker_${W} health:"
  ssh_run "docker exec am_worker_${W} curl -s --max-time 5 http://localhost:3010/health | python3 -m json.tool 2>/dev/null || echo '(unreachable)'"

  echo ""
  echo "==> Worker_${W} recent log lines:"
  ssh_run "docker logs --tail 50 am_worker_${W} 2>&1"
}

if [ "$ACTION" = "reset_worker_1" ]; then reset_one_worker 1; fi
if [ "$ACTION" = "reset_worker_4" ]; then reset_one_worker 4; fi

# ─── TEST_TIKTOK_LOGIN — one-off CloakBrowser probe of TikTok login ───────
if [ "$ACTION" = "test_tiktok_login" ]; then
  echo "==> Pulling latest repo so probe_tiktok.js is on disk..."
  ssh_run "cd /opt/activitymint && git fetch --all && git reset --hard origin/main"

  ssh_run "docker rm -f am_tt_probe 2>/dev/null; rm -rf /tmp/tt_probe; mkdir -p /tmp/tt_probe && chmod 755 /tmp/tt_probe"

  echo "==> Launching TikTok login probe..."
  ssh_run "docker run --name am_tt_probe --network hetzner-cluster_am_public -e TT_USERNAME='$TT_USERNAME' -e TT_PASSWORD='$TT_PASSWORD' -e TT_EMAIL='$TT_EMAIL' -e PROXY_HOST='$TT_PROXY_HOST' -e PROXY_USER='$PROXY_USER' -e PROXY_PASS='$PROXY_PASS' -e PROXY_HTTP_PORT=50100 -v /opt/activitymint/hetzner-cluster/worker/probe_tiktok.js:/app/probe_tiktok.js:ro -v /tmp/tt_probe:/app/profile hetzner-cluster-worker_1 node probe_tiktok.js 2>&1" || true

  echo ""
  echo "==> Captured files:"
  ssh_run "ls -la /tmp/tt_probe/"

  echo ""
  echo "==> Initial page structure:"
  ssh_run "grep -oE '(<title>[^<]+|aria-label=\"[^\"]+\"|<input[^>]+(name|placeholder|type)=\"[^\"]+)' /tmp/tt_probe/last_tt_login_initial.html 2>/dev/null | head -40 || echo '(no html)'"

  echo ""
  echo "==> Cleanup..."
  ssh_run "docker rm -f am_tt_probe 2>/dev/null"
fi

# ─── TEST_UNSUSPEND_W4 — CloakBrowser humanize attempt to clear worker_4 ──
if [ "$ACTION" = "test_unsuspend_w4" ]; then
  echo "==> Pulling latest repo..."
  ssh_run "cd /opt/activitymint && git fetch --all && git reset --hard origin/main"

  ssh_run "docker rm -f am_unsuspend_w4 2>/dev/null; rm -rf /tmp/unsuspend_w4; mkdir -p /tmp/unsuspend_w4 && chmod 755 /tmp/unsuspend_w4"

  echo "==> Launching unsuspend probe for worker_4..."
  ssh_run "docker run --name am_unsuspend_w4 --network hetzner-cluster_am_public -e IG_USERNAME='$IG_USER_4' -e IG_PASSWORD='$IG_PASS_4' -e IG_2FA_SECRET='$IG_2FA_4' -e PROXY_HOST=161.77.140.110 -e PROXY_USER='$PROXY_USER' -e PROXY_PASS='$PROXY_PASS' -e PROXY_HTTP_PORT=50100 -v /opt/activitymint/hetzner-cluster/worker/probe_unsuspend.js:/app/probe_unsuspend.js:ro -v /tmp/unsuspend_w4:/app/profile hetzner-cluster-worker_1 node probe_unsuspend.js 2>&1" || true

  echo ""
  echo "==> Captured files:"
  ssh_run "ls -la /tmp/unsuspend_w4/last_unsuspend_*.html /tmp/unsuspend_w4/last_unsuspend_*.png 2>/dev/null || echo '(no artifacts)'"

  echo ""
  echo "==> Cleanup..."
  ssh_run "docker rm -f am_unsuspend_w4 2>/dev/null"
fi

# ─── DIAGNOSTICS — pull worker HTML dumps to inspect form structure ───────
if [ "$ACTION" = "diagnostics" ]; then
  for w in 1 2 3 4 5; do
    echo "=========================================="
    echo "=== WORKER_${w} DIAGNOSTICS ==="
    echo "=========================================="
    echo "--- URL + page state from worker logs ---"
    ssh_run "docker logs am_worker_${w} 2>&1 | grep -E 'url=|page title|body snippet|WARN|ERROR' | tail -10"
    echo ""
    echo "--- HTML form inputs from /app/profile/last_login_failure.html ---"
    ssh_run "ls -la /opt/activitymint/profiles/profile_${w}/last_login_failure.html 2>/dev/null && grep -oE '<input[^>]+>' /opt/activitymint/profiles/profile_${w}/last_login_failure.html | head -10 || echo '(no HTML dump found)'"
    echo ""
    echo "--- Followers scrape errors from logs ---"
    ssh_run "docker logs am_worker_${w} 2>&1 | grep -E 'followers|following|modal' | tail -20"
    echo ""
  done
fi
