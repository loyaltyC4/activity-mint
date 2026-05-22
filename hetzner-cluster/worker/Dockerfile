# Activity Mint Worker — Playwright + Express
# Base on the official Playwright image so Chromium + all OS deps are present.
FROM mcr.microsoft.com/playwright:v1.45.0-jammy AS deps

WORKDIR /app

# Install only production deps. Cache layer when package files are unchanged.
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# ── Runtime stage ────────────────────────────────────────────────────────
FROM mcr.microsoft.com/playwright:v1.45.0-jammy AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Copy installed node_modules from the deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY . .

# Profile dir mounted via docker-compose volume; create it just in case.
RUN mkdir -p /app/profile

EXPOSE 3010

CMD ["node", "server.js"]
