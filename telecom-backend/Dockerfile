# ── Build stage: compile TypeScript ───────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Runtime stage: production deps + compiled JS only ─────────────────────────
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=5000

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

USER node
EXPOSE 5000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:${PORT}/health || exit 1

CMD ["node", "dist/app.js"]
