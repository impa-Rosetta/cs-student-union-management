// SQL 方言翻译器与 PostgreSQL DatabaseRepository 的单元测试（无需安装 pg）。
//
// 通过注入假连接池，验证 createPgRepository 会把 SQLite 方言翻译为 PostgreSQL 方言，
// 并正确传递绑定值。

import { test } from "node:test";
import assert from "node:assert/strict";
import { translateSqliteToPostgres } from "../platform/sql-dialect.mjs";
import { createPgRepository } from "../platform/node-pg-db.mjs";

test("方言翻译：? 占位符按顺序替换为 $1/$2", () => {
  assert.equal(
    translateSqliteToPostgres("SELECT * FROM t WHERE a = ? AND b = ?"),
    "SELECT * FROM t WHERE a = $1 AND b = $2",
  );
});

test("方言翻译：字符串字面量内的 ? 保持不变", () => {
  assert.equal(
    translateSqliteToPostgres("SELECT 'a?b' AS x, c FROM t WHERE c = ?"),
    "SELECT 'a?b' AS x, c FROM t WHERE c = $1",
  );
});

test("方言翻译：字符串内 '' 转义与问号混合", () => {
  assert.equal(
    translateSqliteToPostgres("INSERT INTO t (x) VALUES ('it''s ? ok')"),
    "INSERT INTO t (x) VALUES ('it''s ? ok')",
  );
});

test("方言翻译：INSERT OR IGNORE → ON CONFLICT DO NOTHING", () => {
  assert.equal(
    translateSqliteToPostgres("INSERT OR IGNORE INTO notifications (id, title) VALUES (?, ?);"),
    "INSERT INTO notifications (id, title) VALUES ($1, $2) ON CONFLICT DO NOTHING;",
  );
});

test("方言翻译：ON CONFLICT DO UPDATE 保持并翻译占位符", () => {
  assert.equal(
    translateSqliteToPostgres("INSERT INTO tasks (id, title) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET title=excluded.title"),
    "INSERT INTO tasks (id, title) VALUES ($1, $2) ON CONFLICT(id) DO UPDATE SET title=excluded.title",
  );
});

test("PgRepository：prepare/bind/all 翻译 SQL 并传递绑定值", async () => {
  const calls = [];
  const fakePool = {
    async query(text, values) {
      calls.push({ text, values });
      return { rows: [{ id: 1, title: "x" }] };
    },
  };
  const repo = createPgRepository({ pool: fakePool });

  const result = await repo.prepare("SELECT * FROM tasks WHERE id = ? AND status = ?").bind(7, "待开始").all();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].text, "SELECT * FROM tasks WHERE id = $1 AND status = $2");
  assert.deepEqual(calls[0].values, [7, "待开始"]);
  assert.deepEqual(result.results, [{ id: 1, title: "x" }]);
});

test("PgRepository：first 无结果返回 null", async () => {
  const repo = createPgRepository({ pool: { async query() { return { rows: [] }; } } });
  const row = await repo.prepare("SELECT * FROM t WHERE id = ?").bind(99).first();
  assert.equal(row, null);
});
