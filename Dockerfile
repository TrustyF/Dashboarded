# Multi-stage build targeting linux/arm64 (Pi 4/5). Don't run `next build`
# on-device - build from your dev machine and ship it over instead, via:
#   .\scripts\deploy-to-pi.ps1
#
# The deps/builder stages run under --platform=$BUILDPLATFORM (the build
# machine's own arch, e.g. amd64) rather than the target arm64 - there are no
# native/arch-specific deps in package.json, so npm ci and next build produce
# the same architecture-independent JS output either way, and running them
# natively skips QEMU emulation entirely (much faster than emulated arm64).
# Only the final runner stage's base image needs to actually be arm64.

FROM --platform=$BUILDPLATFORM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# Docker's normal layer cache already skips this whole stage when the lock
# file hasn't changed; this cache mount just speeds up the case where it has
# (npm doesn't have to re-download packages it's already fetched before).
RUN --mount=type=cache,target=/root/.npm npm ci

FROM --platform=$BUILDPLATFORM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Persists Next.js's own incremental build cache across image builds (BuildKit
# cache mounts survive even when earlier layers invalidate, unlike normal
# Docker layer caching) - meaningfully cuts rebuild time on repeat deploys
# where most of the app hasn't changed. Needs BuildKit, which is the default
# builder on Docker 23+ (no extra config needed).
RUN --mount=type=cache,target=/app/.next/cache npm run build

# Runtime image only needs the pruned "standalone" server output, not the
# full node_modules tree or source - keeps the deployed image small.
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# brightnessctl backs /api/settings/toggle-brightness - writes through the
# /sys/class/backlight mount from docker-compose.yml. On Debian that path is
# typically group-owned "video", so nextjs joins that group (rather than
# running the whole container as root) to get write access to it.
RUN apt-get update && apt-get install -y --no-install-recommends brightnessctl \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --system nextjs && useradd --system --gid nextjs nextjs \
    && (getent group video || groupadd --system video) \
    && usermod -aG video nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
