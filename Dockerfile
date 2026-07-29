# Stable production image for EasyPanel. The container applies Drizzle
# migrations before starting Nuxt, so database changes are deployed safely.
FROM node:22-bookworm-slim AS build

WORKDIR /app
ENV NODE_OPTIONS=--max-old-space-size=3072
LABEL org.opencontainers.image.source="https://github.com/NirajParmar73/OpenDojo"
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# Drizzle Kit and the schema are retained solely to run migrations at startup.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/pnpm-workspace.yaml /app/drizzle.config.ts ./
COPY --from=build /app/server/database ./server/database
COPY --from=build /app/.output ./.output
COPY --from=build /app/public ./public

# Application code writes uploads to public/uploads. The symbolic link makes
# them available through Nuxt's production static directory as well.
RUN mkdir -p /app/public/uploads && ln -s /app/public/uploads /app/.output/public/uploads
RUN chown -R node:node /app

USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["sh", "-c", "./node_modules/.bin/drizzle-kit migrate && node .output/server/index.mjs"]
