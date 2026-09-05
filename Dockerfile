FROM node:22-slim

RUN apt-get update && apt-get install -y python3 make g++ --no-install-recommends && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app
COPY . .

# Force pnpm to ignore lifecycle scripts during install
RUN pnpm install --no-frozen-lockfile --ignore-scripts

# Manually trigger native compilation for necessary packages
RUN pnpm rebuild better-sqlite3 esbuild

# Provide build-time fallback environment variables required by vite.config.ts
ENV PORT=5000
ENV BASE_PATH=/

# Build frontend and backend
RUN pnpm --filter opportunity-tracker build
RUN pnpm --filter @workspace/api-server build

EXPOSE 5000
CMD ["pnpm", "--filter", "@workspace/api-server", "start"]
