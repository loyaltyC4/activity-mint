# Activity Mint Orchestrator — small Node.js + Express service
# Multi-stage so the runtime image carries no build tooling.
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# ── Runtime stage ────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

# Drop privileges to the non-root `node` user
COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node . .

USER node

EXPOSE 3001

CMD ["node", "server.js"]
