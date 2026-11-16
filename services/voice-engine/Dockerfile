# Voice engine: Node 20 + Chromium (Playwright) + ffmpeg. See README.md.
# The Playwright image tag must match the playwright version in package.json,
# so the bundled browser is the one the library expects.
FROM mcr.microsoft.com/playwright:v1.57.0-noble AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json tsconfig.build.json ./
COPY scripts ./scripts
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM mcr.microsoft.com/playwright:v1.57.0-noble
ENV NODE_ENV=production \
    TZ=America/Chicago \
    PORT=8080 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg tzdata \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build --chown=pwuser:pwuser /app/node_modules ./node_modules
COPY --from=build --chown=pwuser:pwuser /app/dist ./dist
COPY --chown=pwuser:pwuser package.json ./
COPY --chown=pwuser:pwuser voice ./voice
COPY --chown=pwuser:pwuser assets ./assets
USER pwuser
EXPOSE 8080
HEALTHCHECK --interval=60s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
