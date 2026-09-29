# Build context is the repo root so the workspace lockfile is used (reproducible installs).
# Usage: docker build -f backend/Dockerfile .

FROM node:22-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace backend
COPY backend backend
WORKDIR /app/backend
RUN npx prisma generate && npm run build

# One-shot image target used by the `migrate` compose service (needs the Prisma CLI + tsx).
FROM build AS migrate
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts"]

FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace backend --omit=dev && npm cache clean --force
COPY --from=build /app/node_modules/.prisma /app/node_modules/.prisma
WORKDIR /app/backend
COPY --from=build /app/backend/dist dist
COPY backend/public public
COPY backend/openapi.yaml ./
RUN mkdir -p uploads && chown -R node:node uploads
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1
CMD ["node", "dist/server.js"]
