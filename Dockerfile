# Use official Node.js image with Corepack enabled for pnpm
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

WORKDIR /app

# Copy lockfile and package manifests for caching
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY artifacts/api-server/package.json ./artifacts/api-server/
# Copy any other workspace package manifests if they exist (e.g. packages/api-zod)
COPY packages/ ./packages/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy full source code
COPY . .

# Build the API server
RUN pnpm --filter @workspace/api-server run build

EXPOSE 3000

# Start server from compiled output
CMD ["node", "artifacts/api-server/dist/index.js"]
