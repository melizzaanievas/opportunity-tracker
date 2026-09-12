# Build ONLY the API server and its backend dependencies
RUN pnpm --filter @workspace/api-server... run build
