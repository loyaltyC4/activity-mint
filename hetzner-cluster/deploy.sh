#!/bin/bash
# Activity Mint — Hetzner Cluster Deploy Script
#
# Run this ON THE HETZNER HOST (not in the Hyperagent sandbox).
# Prerequisites:
#   - Docker + docker-compose installed
#   - /opt/activitymint/.env file already created with real credentials
#
# Usage:
#   cd /opt/activitymint
#   git pull            (or scp the hetzner-cluster/ dir up)
#   bash deploy.sh

set -e

CLUSTER_DIR="/opt/activitymint"
COMPOSE_FILE="$CLUSTER_DIR/hetzner-cluster/docker-compose.yml"
ENV_FILE="$CLUSTER_DIR/.env"

echo "=== Activity Mint Cluster Deploy ==="

# ── 1. Check .env exists ─────────────────────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ ERROR: $ENV_FILE not found."
  echo "   Copy hetzner-cluster/.env.example to $ENV_FILE and fill in real values first."
  exit 1
fi

# Spot-check for placeholders
if grep -q "CHANGEME" "$ENV_FILE"; then
  echo "❌ ERROR: $ENV_FILE still contains CHANGEME placeholders. Fill in real values first."
  exit 1
fi
echo "✅ .env file looks valid"

# ── 2. Create profile directories ────────────────────────────────────────
echo "[1/5] Creating Chrome profile directories..."
for i in 1 2 3 4 5; do
  mkdir -p "$CLUSTER_DIR/profiles/profile_$i"
done
chmod -R 755 "$CLUSTER_DIR/profiles"

# ── 3. Test each proxy is alive ──────────────────────────────────────────
echo "[2/5] Testing proxy connectivity..."
source "$ENV_FILE"
PROXIES=(168.158.21.28 165.254.99.133 65.195.109.107 161.77.140.110 77.47.158.43)
for p in "${PROXIES[@]}"; do
  IP=$(curl -s --max-time 8 --proxy "http://${PROXY_USER}:${PROXY_PASS}@${p}:${PROXY_HTTP_PORT}" "https://api.ipify.org" 2>&1 || echo "FAIL")
  if [[ "$IP" =~ ^[0-9]+\. ]]; then
    echo "  ✅ $p → exit IP: $IP"
  else
    echo "  ⚠️  $p → FAILED ($IP) — worker will retry at startup"
  fi
done

# ── 4. Build images ──────────────────────────────────────────────────────
echo "[3/5] Building Docker images (Playwright base, ~3 min first time)..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build

# ── 5. Bring up cluster ──────────────────────────────────────────────────
echo "[4/5] Starting cluster..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

# ── 6. Wait + show worker health ─────────────────────────────────────────
echo "[5/5] Waiting 30s for workers to log into Instagram..."
sleep 30
echo ""
echo "=== Worker Status ==="
curl -s -H "X-Secret: $SCRAPER_SECRET" "http://localhost:3001/health" | python3 -m json.tool || echo "Orchestrator not responding yet — check 'docker compose logs orchestrator'"
echo ""
echo "=== Tail logs with: ==="
echo "  docker compose -f $COMPOSE_FILE logs -f"
echo ""
echo "✅ Deploy complete. Vercel can now hit http://46.224.227.199:3001/scrape"
