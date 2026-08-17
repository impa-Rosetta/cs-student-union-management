// 快捷流程留痕存储：workflow_records 表，一行一条快捷流程提交记录。
// 前端提交快捷流程（活动/归档/指导意见/时间线等）时追加，保留操作留痕。

import { getDb } from "./db.ts";

const db = getDb();

interface WorkflowRecordRow {
  id: number;
  kind: string;
  payload_json: string;
  created_at: string;
}

function safeParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export async function ensureWorkflowRecordsSchema() {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS workflow_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL DEFAULT '',
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_workflow_records_created ON workflow_records(created_at)"),
  ]);
}

export async function appendWorkflowRecord(record: Record<string, string>): Promise<void> {
  await ensureWorkflowRecordsSchema();
  const { kind = "", createdAt, ...payload } = record;
  await db.prepare("INSERT INTO workflow_records (kind, payload_json, created_at) VALUES (?, ?, ?)")
    .bind(kind, JSON.stringify(payload), createdAt || new Date().toISOString()).run();
}

export async function listWorkflowRecords(limit = 500): Promise<Array<Record<string, string>>> {
  await ensureWorkflowRecordsSchema();
  await migrateLegacyWorkflowRecordsOnce();
  const rows = await db.prepare("SELECT * FROM workflow_records ORDER BY id DESC LIMIT ?").bind(limit).all<WorkflowRecordRow>();
  return (rows.results || []).map((row) => ({
    ...safeParse<Record<string, string>>(row.payload_json, {}),
    kind: row.kind,
    createdAt: row.created_at,
  }));
}

/** 一次性数据迁移：若留痕表为空，则把 shared_state 中的历史留痕迁入。 */
export async function migrateLegacyWorkflowRecordsOnce(): Promise<void> {
  const count = await db.prepare("SELECT COUNT(*) AS c FROM workflow_records").first<{ c: number }>();
  if ((count?.c ?? 0) > 0) return;
  const legacy = await db.prepare("SELECT value FROM shared_state WHERE key = 'workflows'").first<{ value: string }>();
  if (!legacy?.value) return;
  try {
    const parsed = JSON.parse(legacy.value);
    if (Array.isArray(parsed)) {
      for (const item of parsed) await appendWorkflowRecord(item as Record<string, string>);
    }
  } catch { /* 忽略损坏的历史数据 */ }
}
