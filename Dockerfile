# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm build && pnpm prune --prod --ignore-scripts

FROM node:24-alpine AS runtime
ARG VERSION=dev
LABEL org.opencontainers.image.title="Konto Planer" \
      org.opencontainers.image.source="https://github.com/rde-master/konto-planer" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.version="${VERSION}"
ENV NODE_ENV=production PORT=3000 TZ=Europe/Berlin BACKUP_DIR=/app/data/backups
WORKDIR /app
# pg_dump must match the PostgreSQL major version in docker-compose.yml (backup before migrations)
RUN apk add --no-cache tzdata postgresql17-client
COPY --from=build --chown=node:node /app/build ./build
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --from=build --chown=node:node /app/package.json ./package.json
RUN mkdir -p /app/data/backups && chown -R node:node /app/data
USER node
EXPOSE 3000
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "build"]
