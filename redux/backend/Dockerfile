FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY nest-cli.json tsconfig*.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends clamav && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
RUN mkdir -p /var/lib/deliversync && chown node:node /var/lib/deliversync
USER node
ENV NODE_ENV=production DATA_DIR=/var/lib/deliversync/data UPLOAD_DIR=/var/lib/deliversync/uploads LOG_DIR=/var/lib/deliversync/logs CLAMSCAN_PATH=/usr/bin/clamscan
EXPOSE 3001
CMD ["node","dist/main.js"]
