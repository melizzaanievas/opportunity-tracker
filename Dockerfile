FROM node:22-bookworm-slim AS base

RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

WORKDIR /app

# Copy repository files
COPY . .

# Install dependencies (allows onlyBuiltDependencies like esbuild/better-sqlite3)
RUN pnpm install --frozen-lockfile

# Build all workspace packages and artifacts sequentially
RUN pnpm run build

# Verify build output exists during image creation to fail fast if compilation misses
RUN test -f artifacts/api-server/dist/index.js || (echo "Error: dist/index.js was not generated!" && exit 1)

EXPOSE 3000

CMD ["node", "artifacts/api-server/dist/index.js"]
