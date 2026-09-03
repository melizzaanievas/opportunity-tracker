FROM node:22-alpine

# 1. Install standard C++ build toolchain for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

# 2. Enable Corepack and activate pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# 3. Copy monorepo contents
COPY . .

# 4. Install dependencies while skipping lifecycle script locks
RUN pnpm install --no-frozen-lockfile --ignore-scripts

# 5. Explicitly compile required native binaries using the Alpine C++ toolchain
RUN pnpm rebuild better-sqlite3 esbuild

# 6. Set environment safety nets
ENV BASE_PATH="/"
ENV NODE_ENV="production"

# 7. Build strictly the Express API server workspace
RUN pnpm --filter @workspace/api-server build

EXPOSE 5000

# 8. Start strictly the Express API server
CMD ["pnpm", "--filter", "@workspace/api-server", "start"]
