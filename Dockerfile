FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

WORKDIR /app

# Copy all repository files
COPY . .

# Install all workspace dependencies
RUN pnpm install --frozen-lockfile

# Build the API server target
RUN pnpm --filter @workspace/api-server run build

EXPOSE 3000

# Start server from compiled output
CMD ["node", "artifacts/api-server/dist/index.js"]
