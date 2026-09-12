FROM node:22-alpine AS base

# Install build dependencies for C++ native modules
RUN apk add --no-cache python3 make g++ gcc

# Set node-gyp to fetch headers directly from official Node.js releases
ENV npm_config_tarball_url="https://nodejs.org/download/release/v22.23.2/node-v22.23.2-headers.tar.gz"

RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

WORKDIR /app

COPY . .

# Install dependencies with official header URL active
RUN pnpm install --frozen-lockfile

# Build the API server
RUN pnpm --filter @workspace/api-server run build

EXPOSE 3000

CMD ["node", "artifacts/api-server/dist/index.js"]
