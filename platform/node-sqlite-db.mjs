// Node 自托管的 DatabaseRepository 实现：基于 Node 内置的 node:sqlite。
//
// 这是部署适配层（Ports）在非 Cloudflare 环境下的第一个真实实现，
// 对外提供与 Cloudflare D1 一致的 prepare / bind / first / all / run / batch 接口，
// 使业务存储模块（config-store / research-store / task-store 等）无需改动即可在
// 本地或自托管 Node 进程中运行。国内云主机部署时，可在此基础上替换为 PostgreSQL
// 实现（仅需把 SQL 方言从 SQLite 适配为 PostgreSQL，端口接口保持不变）。
//
// 注意：本文件仅供 Node 环境（测试 / 自托管）使用，不会被 Worker 构建打包。

import { DatabaseSync } from "node:sqlite";

export function createNodeSqliteRepository(path = ":memory:") {
  const sqlite = new DatabaseSync(path);
  sqlite.exec("PRAGMA foreign_keys = ON;");

  function prepare(sql) {
    let bound = [];
    // 延迟到真正执行时才 prepare：与 D1 语义一致（batch 中先建表后建索引等场景）。
    const statement = {
      bind(...values) {
        bound = values;
        return statement;
      },
      async first() {
        const row = sqlite.prepare(sql).get(...bound);
        return row ?? null;
      },
      async all() {
        return { results: sqlite.prepare(sql).all(...bound) };
      },
      async run() {
        return sqlite.prepare(sql).run(...bound);
      },
    };
    return statement;
  }

  return {
    prepare,
    // D1 batch 会按顺序执行：这里 map 时每个 run() 主体同步执行，顺序成立。
    async batch(statements) {
      return statements.map((statement) => statement.run());
    },
    // 便捷方法：执行任意 SQL（建表 / 建索引 / 写测试夹具）。
    exec(sql) {
      sqlite.exec(sql);
    },
    close() {
      sqlite.close();
    },
  };
}
