FROM node:22-alpine

# Enable Corepack and prepare pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Force pnpm to approve build scripts for native modules (fixes ERR_PNPM_IGNORED_BUILDS)
ENV PNPM_CONFIG_ONLY_BUILT_DEPENDENCIES="better-sqlite3,esbuild"

WORKDIR /app

# Copy monorepo files
COPY . .

# Install dependencies without lockfile enforcement
RUN pnpm install --no-frozen-lockfile

# Set safety variables for the build process
ENV BASE_PATH="/"
ENV NODE_ENV="production"

# Build strictly the Express API server package
RUN pnpm --filter @workspace/api-server build

EXPOSE 5000

# Start strictly the Express API server package
CMD ["pnpm", "--filter", "@workspace/api-server", "start"]
