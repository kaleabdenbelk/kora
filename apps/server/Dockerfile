# Dockerfile for kora server
# Optimized multi-stage build for Docker deployment

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm/yarn if needed
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY apps/server/package.json ./apps/server/
COPY packages/db/package.json ./packages/db/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm run build --filter=@kora/server

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy built application
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/apps/server/package.json ./

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

EXPOSE 3000

CMD ["node", "dist/index.js"]
