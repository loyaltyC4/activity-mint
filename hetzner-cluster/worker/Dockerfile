# Activity Mint Worker — CloakBrowser stealth Chromium + Express
# Node 20 base; CloakBrowser downloads its patched Chromium binary on install.
FROM node:20-bookworm-slim

WORKDIR /app

# Chromium runtime dependencies (libs the patched Chromium links against)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdbus-1-3 \
    libdrm2 libxkbcommon0 libatspi2.0-0 libxcomposite1 libxdamage1 \
    libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 \
    libx11-xcb1 libfontconfig1 libx11-6 libxcb1 libxext6 libxshmfence1 \
    libglib2.0-0 libgtk-3-0 libpangocairo-1.0-0 libcairo-gobject2 \
    libgdk-pixbuf-2.0-0 libxss1 libxtst6 fonts-liberation \
    fonts-noto-color-emoji fonts-unifont fonts-freefont-ttf \
    fonts-ipafont-gothic fonts-wqy-zenhei \
    ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    CLOAKBROWSER_CACHE_DIR=/root/.cloakbrowser

# Install npm deps including cloakbrowser
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Pre-download CloakBrowser's patched Chromium binary at build time
# (so the first request after `docker compose up -d` isn't a 200MB cold download)
# cloakbrowser is ESM-only — must use dynamic import(), not require()
RUN node -e "import('cloakbrowser').then(m => m.ensureBinary()).then(() => console.log('CloakBrowser binary ready')).catch(err => { console.error('ensureBinary failed:', err); process.exit(1); })"

# App source
COPY . .

# Profile dir mounted via docker-compose volume; create as fallback
RUN mkdir -p /app/profile

EXPOSE 3010

CMD ["node", "server.js"]
