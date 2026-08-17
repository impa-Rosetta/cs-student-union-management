// 静态校验部署配置：在无外部资源的情况下，把 Docker / Caddy / 备份脚本纳入测试门禁。
//
// 校验点：
//  - Dockerfile 引用真实构建产物与依赖（npm ci + package-lock.json + dist + drizzle）；
//  - docker-compose 的 build 上下文能解析到含 Dockerfile 的目录；
//  - compose 引用的环境变量在 .env.example 中均有定义；
//  - 备份脚本具备失败即停 + 指向正确的 compose 文件 + 使用 pg_dump；
//  - Caddy 反向代理目标与 compose 的应用服务名/端口一致。

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function read(rel) {
  return readFile(join(root, rel), "utf8");
}

test("部署配置：Dockerfile 引用真实构建产物与依赖", async () => {
  const dockerfile = await read("Dockerfile");
  assert.match(dockerfile, /npm ci/, "应使用 npm ci 以锁定依赖");
  assert.match(dockerfile, /package-lock\.json/, "应复制锁文件");
  assert.match(dockerfile, /dist\/server\/index\.js/, "应引用 vinext 构建产物入口");
  assert.match(dockerfile, /\/app\/drizzle/, "应携带迁移文件");
});

test("部署配置：docker-compose 构建上下文指向含 Dockerfile 的仓库根", async () => {
  const compose = await read("deploy/docker-compose.yml");
  const match = compose.match(/^\s*build:\s*(\S+)/m);
  assert.ok(match, "compose 应声明 build 上下文");
  const context = match[1];
  // build 上下文相对 compose 文件所在目录（deploy/）解析。
  const contextDir = resolve(root, "deploy", context);
  const dockerfile = await readFile(join(contextDir, "Dockerfile"), "utf8");
  assert.ok(dockerfile.trim().length > 0, "构建上下文应包含 Dockerfile");
});

test("部署配置：compose 引用的环境变量均在 .env.example 中定义", async () => {
  const compose = await read("deploy/docker-compose.yml");
  const env = await read("deploy/.env.example");
  const refs = [...compose.matchAll(/\$\{([A-Z0-9_]+)/g)].map((m) => m[1]);
  const unique = [...new Set(refs)];
  assert.ok(unique.length > 0, "compose 应引用环境变量");
  const defined = new Set(
    env.split("\n")
      .filter((line) => line.trim() && !line.trim().startsWith("#"))
      .map((line) => line.split("=")[0].trim()),
  );
  for (const name of unique) {
    assert.ok(defined.has(name), `compose 引用 ${name} 但 .env.example 未定义`);
  }
});

test("部署配置：备份脚本具备失败即停并指向正确的 compose 文件", async () => {
  const backup = await read("scripts/backup.sh");
  assert.match(backup, /set -euo pipefail/, "应失败即停");
  assert.match(backup, /deploy\/docker-compose\.yml/, "应指向 compose 文件");
  assert.match(backup, /pg_dump/, "应使用 pg_dump 做数据库备份");
});

test("部署配置：Caddy 反向代理目标与应用服务端口一致", async () => {
  const caddy = await read("deploy/Caddyfile");
  assert.match(caddy, /reverse_proxy app:3000/, "Caddy 应代理到 app:3000");
  const dockerfile = await read("Dockerfile");
  assert.match(dockerfile, /EXPOSE 3000/, "应用镜像应暴露 3000 端口");
  const compose = await read("deploy/docker-compose.yml");
  assert.match(compose, /^\s{2}app:/m, "compose 应存在 app 服务供 Caddy 解析 app 主机名");
});
