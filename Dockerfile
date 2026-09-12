FROM node:22-bookworm-slim AS base

RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

WORKDIR /app

# Copy full repository
COPY . .

# Install dependencies (allowing scripts so esbuild and ts-node/tsc prepare properly)
RUN pnpm install --frozen-lockfile

# Compile the api-server project explicitly into dist/index.js
RUN pnpm --filter @workspace/api-server run build

EXPOSE 3000

CMD ["node", "artifacts/api-server/dist/index.js"]
