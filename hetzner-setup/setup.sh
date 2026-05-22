#!/bin/bash
# Activity Mint — Hetzner Proxy + Profile Setup Script
# Run this on your Hetzner server as root:
#   bash <(curl -s https://raw.githubusercontent.com/loyaltyC4/activity-mint/main/hetzner-setup/setup.sh)
# OR scp this file and run: bash setup.sh

set -e
echo "=== Activity Mint — Proxy Profile Setup ==="

# ── 1. Create profile directories ────────────────────────────────────────────
echo "[1/4] Creating CloakBrowser profile directories..."
for i in 1 2 3 4 5; do
  mkdir -p /opt/activitymint/profiles/profile_$i
  echo "  Created /opt/activitymint/profiles/profile_$i"
done

# ── 2. Write proxy config file ────────────────────────────────────────────────
echo "[2/4] Writing proxy configuration..."
cat > /opt/activitymint/proxies.json << 'PROXYEOF'
[
  {
    "id": "proxy_1",
    "profile": "profile_1",
    "host": "168.158.21.28",
    "http_port": 50100,
    "socks5_port": 50101,
    "username": "slyvesterchiko1",
    "password": "BfkeoNCVTY",
    "type": "residential",
    "active": true
  },
  {
    "id": "proxy_2",
    "profile": "profile_2",
    "host": "165.254.99.133",
    "http_port": 50100,
    "socks5_port": 50101,
    "username": "slyvesterchiko1",
    "password": "BfkeoNCVTY",
    "type": "residential",
    "active": true
  },
  {
    "id": "proxy_3",
    "profile": "profile_3",
    "host": "65.195.109.107",
    "http_port": 50100,
    "socks5_port": 50101,
    "username": "slyvesterchiko1",
    "password": "BfkeoNCVTY",
    "type": "residential",
    "active": true
  },
  {
    "id": "proxy_4",
    "profile": "profile_4",
    "host": "161.77.140.110",
    "http_port": 50100,
    "socks5_port": 50101,
    "username": "slyvesterchiko1",
    "password": "BfkeoNCVTY",
    "type": "residential",
    "active": true
  },
  {
    "id": "proxy_5",
    "profile": "profile_5",
    "host": "77.47.158.43",
    "http_port": 50100,
    "socks5_port": 50101,
    "username": "slyvesterchiko1",
    "password": "BfkeoNCVTY",
    "type": "residential",
    "active": true
  }
]
PROXYEOF
echo "  Written /opt/activitymint/proxies.json"

# ── 3. Set permissions ────────────────────────────────────────────────────────
echo "[3/4] Setting permissions..."
chmod -R 755 /opt/activitymint/profiles/
chmod 600 /opt/activitymint/proxies.json
echo "  Permissions set"

# ── 4. Test proxy connectivity ────────────────────────────────────────────────
echo "[4/4] Testing proxy connectivity..."
PROXIES=(
  "168.158.21.28:50100"
  "165.254.99.133:50100"
  "65.195.109.107:50100"
  "161.77.140.110:50100"
  "77.47.158.43:50100"
)
LOGIN="slyvesterchiko1"
PASS="BfkeoNCVTY"

for proxy in "${PROXIES[@]}"; do
  RESULT=$(curl -s --max-time 8 \
    --proxy "http://${LOGIN}:${PASS}@${proxy}" \
    "https://api.ipify.org?format=json" 2>&1)
  if echo "$RESULT" | grep -q '"ip"'; then
    SEEN_IP=$(echo "$RESULT" | grep -o '"ip":"[^"]*"' | cut -d'"' -f4)
    echo "  ✅ ${proxy} → exit IP: ${SEEN_IP}"
  else
    echo "  ❌ ${proxy} → FAILED (${RESULT})"
  fi
done

echo ""
echo "=== Setup complete! ==="
echo "Profile dirs: /opt/activitymint/profiles/profile_{1..5}"
echo "Proxy config: /opt/activitymint/proxies.json"
echo ""
echo "Next step: restart your CloakBrowser scraper Docker service"
echo "  docker compose -f /opt/activitymint/docker-compose.yml restart scraper"
