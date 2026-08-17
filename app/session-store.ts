// 会话存储：正式认证的服务端会话（自托管密码登录用）。
// 会话令牌用 Web Crypto 生成，存关系表 sessions，带过期时间。

import { getDb } from "./db.ts";

const db = getDb();

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 天

export async function ensureSessionSchema() {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)"),
  ]);
}

export async function createSession(userId: number, ttlMs = SESSION_TTL_MS): Promise<string> {
  await ensureSessionSchema();
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  await db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(token, userId, expiresAt).run();
  return token;
}

export async function getSessionUser(token: string): Promise<{ id: number; username: string; name: string; email: string; role: string; department: string; title: string; scope: string; active: boolean } | null> {
  await ensureSessionSchema();
  const row = await db.prepare(`SELECT a.id, a.username, a.name, a.email, a.role, a.department, a.title, a.scope, a.active
    FROM sessions s JOIN app_accounts a ON a.id = s.user_id
    WHERE s.token = ? AND s.expires_at > ?`)
    .bind(token, new Date().toISOString()).first<{ id: number; username: string; name: string; email: string; role: string; department: string; title: string; scope: string; active: number }>();
  if (!row) return null;
  return { ...row, active: Boolean(row.active) };
}

export async function deleteSession(token: string): Promise<void> {
  await ensureSessionSchema();
  await db.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
}
