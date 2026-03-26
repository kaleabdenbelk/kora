# ---- Stage 1: Pruner ----
FROM node:20-alpine AS pruner
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY . .
# Isolate the server package and its local dependencies
RUN pnpm dlx turbo prune server --docker

# ---- Stage 2: Installer ----
FROM node:20-alpine AS installer
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# First, install dependencies (this layer is cached if pnpm-lock.yaml doesn't change)
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---- Stage 3: Builder ----
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy the node_modules from installer and the full source from pruner
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .
COPY turbo.json turbo.json

# Build the server (and its workspace dependencies)
RUN pnpm turbo run build --filter=server

# ---- Stage 4: Runner ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy built application and production dependencies
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/package.json ./apps/server/package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

EXPOSE $PORT

# Start from the app directory
WORKDIR /app/apps/server
CMD ["node", "dist/index.js"]
