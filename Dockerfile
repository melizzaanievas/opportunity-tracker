FROM node:22-alpine

# Enable Corepack and prepare pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy monorepo files
COPY . .

# Force pnpm to execute build scripts for native binaries (better-sqlite3, esbuild)
RUN pnpm install --no-frozen-lockfile --no-ignored-builds

# Set environment safety nets
ENV BASE_PATH="/"
ENV NODE_ENV="production"

# Build strictly the Express API server package
RUN pnpm --filter @workspace/api-server build

EXPOSE 5000

# Start strictly the Express API server package
CMD ["pnpm", "--filter", "@workspace/api-server", "start"]
