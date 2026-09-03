FROM node:22-alpine
RUN apk add --no-cache python3 make g++
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY . .
RUN pnpm install --no-frozen-lockfile --ignore-scripts
RUN pnpm rebuild better-sqlite3 esbuild

# Build both API server and Frontend
RUN pnpm --filter opportunity-tracker build
RUN pnpm --filter @workspace/api-server build

EXPOSE 5000
CMD ["pnpm", "--filter", "@workspace/api-server", "start"]
