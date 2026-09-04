FROM node:22-alpine
RUN apk add --no-cache python3 make g++
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY . .

# Install dependencies (pnpm will now execute native builds for approved packages)
RUN pnpm install --no-frozen-lockfile

# Build frontend and backend
RUN pnpm --filter opportunity-tracker build
RUN pnpm --filter @workspace/api-server build

EXPOSE 5000
CMD ["pnpm", "--filter", "@workspace/api-server", "start"]
