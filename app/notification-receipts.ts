// 通知回执：把通知已读状态从浏览器本地存储迁移到服务端关系表。
// 每个「通知 × 用户」一行，存在即表示已读。

import { getDb } from "./db.ts";

const db = getDb();

export async function ensureNotificationReceiptsSchema() {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS notification_receipts (
      notification_id TEXT NOT NULL,
      username TEXT NOT NULL,
      read_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (notification_id, username)
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_notification_receipts_user ON notification_receipts(username)"),
  ]);
}

export async function listReadNotificationIds(username: string): Promise<string[]> {
  await ensureNotificationReceiptsSchema();
  const result = await db.prepare(
    "SELECT notification_id FROM notification_receipts WHERE username = ?",
  )
    .bind(username)
    .all<{ notification_id: string }>();
  return (result.results || []).map((row) => row.notification_id);
}

export async function markNotificationsRead(username: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  await ensureNotificationReceiptsSchema();
  const statements = ids.map((id) =>
    db.prepare(
      "INSERT OR IGNORE INTO notification_receipts (notification_id, username) VALUES (?, ?)",
    ).bind(id, username),
  );
  await db.batch(statements);
}
