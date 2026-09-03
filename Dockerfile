FROM node:22-alpine

# Enable Corepack and activate pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy monorepo files
COPY . .

# Install dependencies without blocking on lockfile
RUN pnpm install --no-frozen-lockfile

# Approve build scripts for all native modules (better-sqlite3, esbuild)
RUN pnpm approve-builds --all

# Set build safety variables
ENV BASE_PATH="/"
ENV NODE_ENV="production"

# Build ONLY the Express backend
RUN pnpm --filter @workspace/api-server build

EXPOSE 5000

# Start ONLY the Express backend
CMD ["pnpm", "--filter", "@workspace/api-server", "start"]
