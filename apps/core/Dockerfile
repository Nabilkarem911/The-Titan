# ============================================================
# Titan Core API — Dockerfile
# Build context must be the monorepo ROOT (docker build -f apps/core/Dockerfile .)
# ============================================================

# ── Stage 1: Dependencies ───────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json      packages/shared/package.json
COPY packages/config/package.json      packages/config/package.json
COPY packages/logging/package.json     packages/logging/package.json
COPY packages/database/package.json    packages/database/package.json
COPY packages/memory/package.json      packages/memory/package.json
COPY packages/tools/package.json       packages/tools/package.json
COPY packages/queue/package.json       packages/queue/package.json
COPY packages/sandbox/package.json     packages/sandbox/package.json
COPY packages/auth/package.json        packages/auth/package.json
COPY packages/websocket/package.json   packages/websocket/package.json
COPY packages/observability/package.json packages/observability/package.json
COPY packages/telemetry/package.json   packages/telemetry/package.json
COPY packages/agent-engine/package.json packages/agent-engine/package.json
COPY apps/core/package.json            apps/core/package.json
COPY apps/dashboard/package.json       apps/dashboard/package.json
RUN for i in 1 2 3; do npm install --no-audit --no-fund && break || (echo "npm install attempt $i failed, retrying..." && sleep 5); done

# ── Stage 2: Build ──────────────────────────────────────────
FROM deps AS builder
COPY tsconfig.base.json tsconfig.json ./
COPY packages/ ./packages/
COPY apps/core/ ./apps/core/
COPY apps/dashboard/ ./apps/dashboard/
RUN npm run build
RUN npm run build:dashboard

# ── Stage 3: Production runtime ─────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ARG INSTALL_SSH_TOOLS=true
RUN apk update && apk add --no-cache dumb-init curl git openssl && \
    if [ "$INSTALL_SSH_TOOLS" = "true" ]; then apk add --no-cache openssh-client sshpass; fi

# Copy only what's needed to run
COPY package.json package-lock.json ./
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/core ./apps/core
COPY --from=builder /app/apps/dashboard/dist ./apps/dashboard/dist
RUN for i in 1 2 3; do npm install --omit=dev --no-audit --no-fund && break || (echo "npm install attempt $i failed, retrying..." && sleep 5); done && rm -rf /tmp/* ~/.npm

# Non-root user
RUN addgroup -S titan -g 1001 && adduser -S titan -G titan -u 1001
RUN mkdir -p /app/workspaces /home/titan/.ssh && \
    chown -R titan:titan /app/workspaces /home/titan/.ssh && \
    chmod 700 /home/titan/.ssh
USER titan

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD curl -f http://localhost:3000/api/v1/health/live || exit 1

CMD ["dumb-init", "node", "apps/core/dist/index.js"]
