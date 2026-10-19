# syntax=docker/dockerfile:1

# ---------- 1. deps: install all dependencies (native modules are built per target platform) ----------
FROM node:24-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---------- 2. build: icons + Next.js standalone output ----------
FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
ARG APP_VERSION=0.0.0
ARG GIT_SHA=dev
ARG BUILD_DATE=
ARG REPO_URL=
ENV APP_VERSION=${APP_VERSION} \
    GIT_SHA=${GIT_SHA} \
    BUILD_DATE=${BUILD_DATE} \
    REPO_URL=${REPO_URL} \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm generate:icons && pnpm build

# ---------- 3. runner: minimal runtime image ----------
FROM node:24-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends tini gosu ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ARG APP_VERSION=0.0.0
ARG GIT_SHA=dev
ARG BUILD_DATE=
ARG REPO_URL=
LABEL org.opencontainers.image.source="${REPO_URL}" \
      org.opencontainers.image.title="Pulse Journal" \
      org.opencontainers.image.description="Self-hosted, single-owner trading journal for your home NAS." \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${GIT_SHA}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.licenses="MIT"

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/data \
    TZ=Europe/Zurich \
    PUID=1000 \
    PGID=1000 \
    NEXT_TELEMETRY_DISABLED=1

# scripts/postbuild.mjs already placed .next/static, public (with the version-stamped sw.js) and the drizzle
# migrations inside the standalone folder, so one COPY brings server, static assets, public files and migrations.
COPY --from=build /app/.next/standalone ./
COPY docker/entrypoint.sh /entrypoint.sh

# Fail the build early if a native module was not traced into the standalone output.
RUN chmod +x /entrypoint.sh \
  && node -e "require('better-sqlite3'); require('sharp'); require('@node-rs/argon2'); console.log('native modules ok')"

VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--", "/entrypoint.sh"]
CMD ["node", "server.js"]
