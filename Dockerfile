FROM node:22-alpine
RUN apk add --no-cache python3 make g++
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY . .

# Bypass pnpm ignored build scripts block during Docker build
RUN pnpm install --no-frozen-lockfile --config.ignore-scripts=false

# Rebuild native bindings explicitly for Alpine Linux
RUN pnpm rebuild better-sqlite3 esbuild @rollup/rollup-linux-x64-musl

# Build frontend and backend
RUN pnpm --filter opportunity-tracker build
RUN pnpm --filter @workspace/api-server build

EXPOSE 5000
CMD ["pnpm", "--filter", "@workspace/api-server", "start"]
