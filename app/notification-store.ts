// 通知关系存储：把通知从 shared_state JSON 迁移到关系表 notifications。
// 一行一条通知事件，收件人列表以 JSON 列保存（回执见 notification-receipts.ts）。

import { getDb } from "./db.ts";

const db = getDb();
import type { NotificationRecord } from "./workflow/notifications.ts";

interface NotificationRow {
  id: string;
  recipient_usernames_json: string;
  title: string;
  detail: string;
  level: string | null;
  entity_type: string | null;
  entity_id: string | null;
  parent_task_id: number | null;
  created_at: string;
}

function safeParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

function rowToNotification(row: NotificationRow): NotificationRecord {
  const record: NotificationRecord = {
    id: row.id,
    recipientUsernames: safeParse(row.recipient_usernames_json, [] as string[]),
    title: row.title,
    detail: row.detail,
    createdAt: row.created_at,
    level: (row.level as NotificationRecord["level"]) || "info",
    entity: { type: "system" },
  };
  if (row.entity_type) {
    record.entity = { type: row.entity_type, id: row.entity_id ?? undefined, parentTaskId: row.parent_task_id ?? undefined };
  }
  return record;
}

export async function ensureNotificationSchema() {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      recipient_usernames_json TEXT NOT NULL DEFAULT '[]',
      title TEXT NOT NULL,
      detail TEXT NOT NULL,
      level TEXT,
      entity_type TEXT,
      entity_id TEXT,
      parent_task_id INTEGER,
      created_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at)"),
  ]);
}

export async function insertNotifications(records: NotificationRecord[]): Promise<void> {
  if (!records.length) return;
  await ensureNotificationSchema();
  const statements = records.map((record) =>
    db.prepare(`INSERT OR IGNORE INTO notifications (id, recipient_usernames_json, title, detail, level, entity_type, entity_id, parent_task_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        record.id,
        JSON.stringify(record.recipientUsernames),
        record.title,
        record.detail,
        record.level ?? null,
        record.entity?.type ?? null,
        record.entity?.id != null ? String(record.entity.id) : null,
        record.entity?.parentTaskId ?? null,
        record.createdAt,
      ),
  );
  await db.batch(statements);
}

export async function listNotifications(limit = 300): Promise<NotificationRecord[]> {
  await ensureNotificationSchema();
  await migrateLegacyNotificationsOnce();
  const rows = await db.prepare("SELECT * FROM notifications ORDER BY created_at DESC, id DESC LIMIT ?")
    .bind(limit)
    .all<NotificationRow>();
  return (rows.results || []).map(rowToNotification);
}

/** 一次性数据迁移：若通知表为空，则把 shared_state 中的历史通知 JSON 迁入。 */
export async function migrateLegacyNotificationsOnce(): Promise<void> {
  const count = await db.prepare("SELECT COUNT(*) AS c FROM notifications").first<{ c: number }>();
  if ((count?.c ?? 0) > 0) return;
  const legacy = await db.prepare("SELECT value FROM shared_state WHERE key = 'notifications'").first<{ value: string }>();
  if (!legacy?.value) return;
  try {
    const parsed = JSON.parse(legacy.value);
    if (Array.isArray(parsed) && parsed.length) await insertNotifications(parsed as NotificationRecord[]);
  } catch { /* 忽略损坏的历史数据 */ }
}
