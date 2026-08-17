# 自托管应用镜像（阶段 4 脚手架，尚未可上线）。
#
# 现状与缺口：
#  - 当前 `npm run build`（vinext build）产物是 Cloudflare Worker 包（dist/server/index.js +
#    dist/server/wrangler.json，绑定 D1/R2），并非独立 Node HTTP 服务；
#  - 因此下面的 `CMD node dist/server/index.js` 在纯 Node 下不会监听端口，需在
#    app/platform-node.ts 提供 Node/PostgreSQL/S3 实现并把组合根切换到 Node 后才可运行。
#  - DatabaseRepository 端口已有 Node/SQLite 实现（platform/node-sqlite-db.mjs，供测试/单机），
#    生产 PostgreSQL 实现（pg + SQL 方言适配）待建。

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
COPY --from=build /app/drizzle ./drizzle
EXPOSE 3000
CMD ["node", "dist/server/index.js"]
