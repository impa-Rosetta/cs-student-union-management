// PostgreSQL DatabaseRepository 实现（国内自托管）。
//
// 依赖 `pg`：仅在未注入连接池时才懒加载 `import("pg")`，因此本文件可在未安装 pg 的
// 环境中编写、类型校验与单测（注入假连接池即可）。
//
// prepare() 会把 SQLite 方言翻译为 PostgreSQL 方言（见 sql-dialect.mjs）。
// 注意：CREATE TABLE / PRAGMA 等 DDL 不在此翻译，应改用 PostgreSQL 迁移文件管理；
//       存储模块里 D1 时代的运行时 ensure*Schema DDL 在 PostgreSQL 部署中应被迁移替换。

import { translateSqliteToPostgres } from "./sql-dialect.mjs";

export function createPgRepository({ connectionString, pool } = {}) {
  let pgPool = pool;

  async function getPool() {
    if (!pgPool) {
      const { Pool } = await import("pg");
      pgPool = new Pool({ connectionString });
    }
    return pgPool;
  }

  function prepare(sql) {
    const translated = translateSqliteToPostgres(sql);
    let values = [];
    const statement = {
      bind(...bound) {
        values = bound;
        return statement;
      },
      async first() {
        const { rows } = await (await getPool()).query(translated, values);
        return rows[0] ?? null;
      },
      async all() {
        const { rows } = await (await getPool()).query(translated, values);
        return { results: rows };
      },
      async run() {
        await (await getPool()).query(translated, values);
        return {};
      },
    };
    return statement;
  }

  return {
    prepare,
    async batch(statements) {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      return results;
    },
    async end() {
      if (pgPool && typeof pgPool.end === "function") await pgPool.end();
    },
  };
}
