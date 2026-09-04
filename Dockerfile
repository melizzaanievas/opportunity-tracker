FROM node:22-slim

RUN apt-get update && apt-get install -y python3 make g++ --no-install-recommends && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app
COPY . .

# Run install with built dependencies authorized via pnpm config
RUN pnpm install --no-frozen-lockfile --config.only-built-dependencies=true

# Build frontend and backend
RUN pnpm --filter opportunity-tracker build
RUN pnpm --filter @workspace/api-server build

EXPOSE 5000
CMD ["pnpm", "--filter", "@workspace/api-server", "start"]
