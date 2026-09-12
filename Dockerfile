FROM node:22-bookworm-slim AS base

RUN corepack enable && corepack prepare pnpm@10.28.0 --activate

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile --ignore-scripts

RUN pnpm --filter @workspace/api-server run build

EXPOSE 3000

CMD ["node", "artifacts/api-server/dist/index.js"]
