FROM node:22-slim

RUN apt-get update && apt-get install -y python3 make g++ --no-install-recommends && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app
COPY . .

# Pass approved build dependencies via pnpm's native env var config
ENV pnpm_config_only_built_dependencies="better-sqlite3,esbuild"

# Run pnpm install
RUN pnpm install --no-frozen-lockfile

# Build frontend and backend
RUN pnpm --filter opportunity-tracker build
RUN pnpm --filter @workspace/api-server build

EXPOSE 5000
CMD ["pnpm", "--filter", "@workspace/api-server", "start"]
