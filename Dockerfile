FROM node:20-alpine

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy entire monorepo context
COPY . .

# Install all workspace dependencies
RUN pnpm install --frozen-lockfile

# Set environment variable safety nets to prevent Vite/frontend check crashes
ENV BASE_PATH="/"
ENV NODE_ENV="production"

# Build ONLY the backend workspace
RUN pnpm --filter @workspace/api-server build

EXPOSE 5000

# Start ONLY the backend workspace
CMD ["pnpm", "--filter", "@workspace/api-server", "start"]
