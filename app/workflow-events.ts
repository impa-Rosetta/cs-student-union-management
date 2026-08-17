// 工作流事件审计表：记录每次任务/子任务状态转换，形成服务端审计轨迹。
// 这是从 shared_state JSON 迁移到关系表的第一步（审计与 workflow_events）。

import { getDb } from "./db.ts";

const db = getDb();
import type { WorkflowTransitionEvent } from "./workflow/types.ts";

export async function ensureWorkflowEventsSchema() {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS workflow_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      from_status TEXT NOT NULL,
      to_status TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_workflow_events_entity ON workflow_events(entity_type, entity_id)"),
  ]);
}

export async function recordWorkflowEvent(
  event: WorkflowTransitionEvent,
  actorName: string,
  actorRole: string,
) {
  await ensureWorkflowEventsSchema();
  await db.prepare(
    `INSERT INTO workflow_events (entity_type, entity_id, action, from_status, to_status, actor_name, actor_role, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      event.entityType,
      String(event.entityId),
      event.action,
      event.fromStatus,
      event.toStatus,
      actorName,
      actorRole,
      event.reason ?? null,
    )
    .run();
}

export async function listWorkflowEvents(limit = 200) {
  await ensureWorkflowEventsSchema();
  const result = await db.prepare(
    "SELECT * FROM workflow_events ORDER BY id DESC LIMIT ?",
  )
    .bind(limit)
    .all<{
      id: number;
      entity_type: string;
      entity_id: string;
      action: string;
      from_status: string;
      to_status: string;
      actor_name: string;
      actor_role: string;
      reason: string | null;
      created_at: string;
    }>();
  return result.results;
}
