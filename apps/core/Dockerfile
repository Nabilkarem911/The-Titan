# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY tsconfig.json ./
COPY tsconfig.base.json ./
COPY vitest.config.ts ./
COPY packages/ ./packages/
COPY apps/ ./apps/
RUN npm ci --legacy-peer-deps && \
    npm run build:shared && \
    npm run build:config && \
    npm run build:logging && \
    npm run build:database && \
    npm run build:memory && \
    npm run build:tools && \
    npm run build:queue && \
    npm run build:agent-engine && \
    npm run build:auth && \
    npm run build:websocket && \
    npm run build:observability && \
    npm run build:telemetry && \
    npm run build:core && \
    npm run build:sandbox

# Stage 2: Production runtime
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache dumb-init curl
# Install only production deps
COPY package*.json ./
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps ./apps
RUN npm ci --omit=dev --legacy-peer-deps && \
    rm -rf /tmp/* ~/.npm

# Create non-root user
RUN addgroup -S titan -g 1000 && adduser -S titan -G titan -u 1000
USER titan

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8080/health/live || exit 1

CMD ["dumb-init", "node", "apps/core/dist/index.js"]
