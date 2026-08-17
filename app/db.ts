// DatabaseRepository 的访问器（组合根的一部分）。
// 存储模块通过 getDb() 使用数据库端口，不再直接依赖 `cloudflare:workers`。
// 国内自托管时，把 getDb() 换成 PostgreSQL 实现即可（SQL 方言仍需适配）。

import { env } from "cloudflare:workers";
import type { DatabaseRepository, SqlStatement } from "./ports.ts";

let cached: DatabaseRepository | null = null;
let override: DatabaseRepository | null = null;

/**
 * 注入自定义 DatabaseRepository（用于 Node 自托管或测试）。
 * 传入 null 恢复 Cloudflare D1 默认实现。
 */
export function setDb(repo: DatabaseRepository | null): void {
  override = repo;
}

function cloudflareRepository(): DatabaseRepository {
  if (!cached) {
    cached = {
      prepare(sql: string): SqlStatement {
        return env.DB.prepare(sql) as unknown as SqlStatement;
      },
      batch(statements: SqlStatement[]): Promise<unknown[]> {
        return env.DB.batch(statements as unknown as Parameters<typeof env.DB.batch>[0]) as Promise<unknown[]>;
      },
    };
  }
  return cached;
}

/**
 * 返回 DatabaseRepository 访问器。
 *
 * 存储模块常在模块顶层执行 `const db = getDb()`；这里返回一个代理，
 * 每次方法调用时转发到「当前生效」的实现（override 或 D1），
 * 使测试 / 自托管可以随时用 setDb 切换，而不受模块缓存影响。
 */
export function getDb(): DatabaseRepository {
  return new Proxy({} as DatabaseRepository, {
    get(_target, prop) {
      const db = override ?? cloudflareRepository();
      const value = (db as unknown as Record<string | symbol, unknown>)[prop];
      return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(db) : value;
    },
  });
}
