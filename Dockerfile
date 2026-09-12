FROM node:22-bookworm-slim AS base

# Install build dependencies required by node-gyp for better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ gcc && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

WORKDIR /app

COPY . .

# Install dependencies with build tools available
RUN pnpm install --frozen-lockfile

# Build workspace projects
RUN pnpm run build

EXPOSE 3000

CMD ["node", "artifacts/api-server/dist/index.js"]
