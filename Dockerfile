# Multi-stage build targeting linux/arm64 (Pi 4/5). Build with:
#   docker buildx build --platform linux/arm64 -t dashboard-next:latest .
# from your dev machine, then push/pull to the Pi - don't run `next build`
# on-device unless you don't mind the RAM/CPU spike during the build step.

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Runtime image only needs the pruned "standalone" server output, not the
# full node_modules tree or source - keeps the deployed image small.
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN groupadd --system nextjs && useradd --system --gid nextjs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
