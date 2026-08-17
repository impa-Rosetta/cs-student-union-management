// SQLite → PostgreSQL 的 SQL 方言翻译（纯函数，供 PostgreSQL DatabaseRepository 使用）。
//
// 范围：存储模块在运行时经 prepare() 发出的 DML（SELECT / INSERT / UPDATE / DELETE）。
// 不处理 CREATE TABLE / PRAGMA 等 DDL——DDL 应通过 PostgreSQL 迁移文件管理
// （见 drizzle/ 与 docs/自托管部署方案.md「AUTOINCREMENT → SERIAL 等」）。
//
// 处理规则：
//  - `?` 占位符 → `$1`、`$2`…（跳过单引号字符串字面量内的 ?，支持 '' 转义）；
//  - `INSERT OR IGNORE INTO …` → `INSERT INTO … ON CONFLICT DO NOTHING`
//    （两者均只忽略唯一/主键冲突，语义一致）。

export function translateSqliteToPostgres(sql) {
  // 1) 占位符翻译：只翻译字符串字面量之外的 ?
  let out = "";
  let param = 0;
  let inString = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'") {
      out += ch;
      if (inString && sql[i + 1] === "'") {
        out += "'";
        i++;
      } else {
        inString = !inString;
      }
      continue;
    }
    if (ch === "?" && !inString) {
      param += 1;
      out += `$${param}`;
      continue;
    }
    out += ch;
  }
  let translated = out;

  // 2) INSERT OR IGNORE → INSERT ... ON CONFLICT DO NOTHING（仅当语句本身没有 ON CONFLICT）
  if (/INSERT\s+OR\s+IGNORE\s+INTO\b/i.test(translated) && !/ON\s+CONFLICT/i.test(translated)) {
    translated = translated.replace(/INSERT\s+OR\s+IGNORE\s+INTO\b/i, "INSERT INTO");
    const semicolon = /;\s*$/.test(translated);
    translated = translated.replace(/;\s*$/, "").replace(/\s+$/, "");
    translated += " ON CONFLICT DO NOTHING" + (semicolon ? ";" : "");
  }

  return translated;
}
