# VUUP API server — production image
# Multi-stage build. Node 20 Alpine. better-sqlite3 is a native module, so we
# compile it in a builder stage with build tools, then ship only runtime deps.

# ─── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Native build toolchain for better-sqlite3
RUN apk add --no-cache python3 make g++

# Install all deps (incl. dev) against the lockfile for a reproducible build
COPY package.json package-lock.json ./
RUN npm ci

# Compile TypeScript -> dist/
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Prune to production dependencies only (keeps the compiled native binding)
RUN npm prune --omit=dev

# ─── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
# Persist the SQLite DB on a mounted volume; override via Coolify if needed.
ENV DB_PATH=/app/data/vuup.db
ENV PORT=3001

# Run as non-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# Data directory for the persistent volume (owned by the runtime user)
RUN mkdir -p /app/data && chown -R appuser:appgroup /app
VOLUME ["/app/data"]

USER appuser
EXPOSE 3001

# Container-level healthcheck hits the unauthenticated /health route
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]
