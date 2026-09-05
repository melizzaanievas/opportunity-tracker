FROM node:22-slim

RUN apt-get update && apt-get install -y python3 make g++ --no-install-recommends && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app
COPY . .

RUN pnpm install --no-frozen-lockfile --ignore-scripts
RUN pnpm rebuild better-sqlite3 esbuild

# Hardcode the backend URL for Vite during compilation
ENV PORT=5000
ENV BASE_PATH=/
ENV VITE_API_BASE_URL=https://applynow.up.railway.app

# Force Docker cache to bust for the build step
RUN echo "rebuild-1"

RUN pnpm --filter opportunity-tracker build
RUN pnpm --filter @workspace/api-server build

EXPOSE 5000
CMD ["pnpm", "--filter", "@workspace/api-server", "start"]
