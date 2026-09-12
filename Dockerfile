FROM node:22-alpine AS base

# Install build dependencies for C++ native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++ gcc

RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

WORKDIR /app

# Copy repository files
COPY . .

# Install dependencies (native modules will compile successfully now)
RUN pnpm install --frozen-lockfile

# Build the API server target
RUN pnpm --filter @workspace/api-server run build

EXPOSE 3000

# Start server from compiled output
CMD ["node", "artifacts/api-server/dist/index.js"]
