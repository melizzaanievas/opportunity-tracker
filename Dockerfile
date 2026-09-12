FROM node:22-bookworm-slim AS base

# Install native build tools
RUN apt-get update && apt-get install -y python3 make g++ gcc && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

WORKDIR /app

# Copy project files
COPY . .

# Install dependencies across all workspaces
RUN pnpm install --frozen-lockfile

# Build ONLY the API server (bypasses Vite frontend requirements like BASE_PATH and PORT)
RUN pnpm --filter @workspace/api-server... run build

# Ensure static fallback directory exists
RUN mkdir -p artifacts/opportunity-tracker/dist/public && \
    if [ ! -f artifacts/opportunity-tracker/dist/public/index.html ]; then \
      echo "<!DOCTYPE html><html><body><h1>API Server Running</h1></body></html>" > artifacts/opportunity-tracker/dist/public/index.html; \
    fi

EXPOSE 3000

CMD ["node", "artifacts/api-server/dist/index.js"]
