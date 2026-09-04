FROM node:22-slim

# Install C++ build tools required by better-sqlite3 for glibc
RUN apt-get update && apt-get install -y python3 make g++ --no-install-recommends && rm -rf /var/lib/apt/lists/*

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app
COPY . .

# Install dependencies matching glibc/linux-x64
RUN pnpm install --no-frozen-lockfile

# Build both applications
RUN pnpm --filter opportunity-tracker build
RUN pnpm --filter @workspace/api-server build

EXPOSE 5000
CMD ["pnpm", "--filter", "@workspace/api-server", "start"]
