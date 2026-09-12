FROM node:22-bookworm-slim AS base

# Install build dependencies for better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ gcc && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

WORKDIR /app

# Copy repository
COPY . .

# Install dependencies across all workspaces
RUN pnpm install --frozen-lockfile

# Explicitly build the API server package
RUN pnpm --filter @workspace/api-server run build

# Verify build output exists before concluding build phase
RUN test -f artifacts/api-server/dist/index.mjs || (echo "Build failed: dist/index.mjs not found!" && exit 1)

EXPOSE 3000

CMD ["node", "artifacts/api-server/dist/index.mjs"]

