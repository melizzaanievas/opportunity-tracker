FROM node:22-bookworm-slim AS base

RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

WORKDIR /app

# Copy repository files
COPY . .

# Install dependencies ignoring native scripts
RUN pnpm install --frozen-lockfile --ignore-scripts

# Build all workspace projects (both api-server and opportunity-tracker)
RUN pnpm run build

EXPOSE 3000

# Explicitly start the API server node entrypoint
CMD ["node", "artifacts/api-server/dist/index.js"]
