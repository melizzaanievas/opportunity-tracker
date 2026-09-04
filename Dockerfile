FROM node:22-alpine
RUN apk add --no-cache python3 make g++
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY . .

# Install dependencies including optional platform binaries
RUN pnpm install --no-frozen-lockfile

# Force rebuild of native bindings for Alpine Linux
RUN pnpm rebuild better-sqlite3 esbuild @rollup/rollup-linux-x64-musl

# Build both API server and Frontend
RUN pnpm --filter opportunity-tracker build
RUN pnpm --filter @workspace/api-server build

EXPOSE 5000
CMD ["pnpm", "--filter", "@workspace/api-server", "start"]
