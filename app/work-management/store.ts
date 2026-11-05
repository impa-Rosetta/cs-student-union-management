import { getDb } from "../db.ts";
import type { AuthenticatedUser } from "../server-auth.ts";
import { ensureTaskSchema } from "../task-store.ts";
import { toUnifiedWorkStatus, type UnifiedWorkStatus } from "./status.ts";

const db = getDb();
let schemaPromise: Promise<void> | null = null;

export type WorkItemSourceType = "task" | "subtask" | "venue_request" | "purchase_request" | "white_card";

export type WorkItem = {
  id: string;
  sourceType: WorkItemSourceType;
  sourceId: string;
  title: string;
  statusGroup: UnifiedWorkStatus;
  nativeStatus: string;
  activityId: string;
  activityName: string;
  ownerDepartmentName: string;
  assigneeAccountId?: number;
  assigneeName: string;
  requesterAccountId?: number;
  requesterUsername: string;
  requesterName: string;
  priority: string;
  plannedStartAt: string;
  dueAt: string;
  completedAt: string;
  blocked: boolean;
  blockedReason: string;
  nextActorType: string;
  nextActorId: string;
  createdAt: string;
  updatedAt: string;
};

type WorkItemRow = {
  id: string; source_type: WorkItemSourceType; source_id: string; title: string; status_group: UnifiedWorkStatus;
  native_status: string; activity_id: string; activity_name: string; owner_department_name: string;
  assignee_account_id: number | null; assignee_name: string; requester_account_id: number | null;
  requester_username: string; requester_name: string; priority: string; planned_start_at: string; due_at: string;
  completed_at: string; blocked: number; blocked_reason: string; next_actor_type: string; next_actor_id: string;
  created_at: string; updated_at: string;
};

function rowToItem(row: WorkItemRow): WorkItem {
  return {
    id: row.id, sourceType: row.source_type, sourceId: row.source_id, title: row.title,
    statusGroup: row.status_group, nativeStatus: row.native_status, activityId: row.activity_id,
    activityName: row.activity_name, ownerDepartmentName: row.owner_department_name,
    assigneeAccountId: row.assignee_account_id ?? undefined, assigneeName: row.assignee_name,
    requesterAccountId: row.requester_account_id ?? undefined, requesterUsername: row.requester_username,
    requesterName: row.requester_name, priority: row.priority, plannedStartAt: row.planned_start_at,
    dueAt: row.due_at, completedAt: row.completed_at, blocked: Boolean(row.blocked),
    blockedReason: row.blocked_reason, nextActorType: row.next_actor_type, nextActorId: row.next_actor_id,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

async function prepareSchema() {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS work_items (
      id TEXT PRIMARY KEY, source_type TEXT NOT NULL, source_id TEXT NOT NULL, title TEXT NOT NULL,
      status_group TEXT NOT NULL, native_status TEXT NOT NULL, activity_id TEXT NOT NULL DEFAULT '',
      activity_name TEXT NOT NULL DEFAULT '', owner_department_name TEXT NOT NULL DEFAULT '',
      assignee_account_id INTEGER, assignee_name TEXT NOT NULL DEFAULT '', requester_account_id INTEGER,
      requester_username TEXT NOT NULL DEFAULT '', requester_name TEXT NOT NULL DEFAULT '', priority TEXT NOT NULL DEFAULT '普通',
      planned_start_at TEXT NOT NULL DEFAULT '', due_at TEXT NOT NULL DEFAULT '', completed_at TEXT NOT NULL DEFAULT '',
      blocked INTEGER NOT NULL DEFAULT 0, blocked_reason TEXT NOT NULL DEFAULT '', next_actor_type TEXT NOT NULL DEFAULT '',
      next_actor_id TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(source_type, source_id)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS work_item_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, work_item_id TEXT NOT NULL, action TEXT NOT NULL,
      from_status TEXT NOT NULL DEFAULT '', to_status TEXT NOT NULL DEFAULT '', actor_account_id INTEGER,
      actor_name TEXT NOT NULL DEFAULT '', changes_json TEXT NOT NULL DEFAULT '{}', note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_work_items_activity ON work_items(activity_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_work_items_department ON work_items(owner_department_name, status_group)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_work_items_assignee ON work_items(assignee_account_id, status_group)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_work_items_requester ON work_items(requester_username, status_group)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_work_item_events_item ON work_item_events(work_item_id, id)"),
  ]);
}

export function ensureWorkItemSchema() {
  if (!schemaPromise) schemaPromise = prepareSchema().catch((error) => { schemaPromise = null; throw error; });
  return schemaPromise;
}

type RawRecord = Record<string, unknown>;

async function safeAll(sql: string): Promise<RawRecord[]> {
  try {
    const result = await db.prepare(sql).all<RawRecord>();
    return result.results || [];
  } catch {
    return [];
  }
}

function text(value: unknown) { return value == null ? "" : String(value); }
function numberOrNull(value: unknown) { const valueNumber = Number(value); return Number.isFinite(valueNumber) && valueNumber > 0 ? valueNumber : null; }

function nextActorFor(sourceType: WorkItemSourceType, row: RawRecord) {
  const status = text(row.status);
  if (toUnifiedWorkStatus(status) === "done" || toUnifiedWorkStatus(status) === "canceled") return { type: "", id: "" };
  if (sourceType === "task") return status === "待验收" ? { type: "role", id: "chair" } : { type: "account", id: text(row.assignee_account_id || row.person) };
  if (sourceType === "subtask") return status === "待验收" ? { type: "department_role", id: `${text(row.department)}:leader` } : { type: "account", id: text(row.assignee_account_id || row.assignee) };
  if (sourceType === "venue_request") return ["草稿", "待补充材料"].includes(status) ? { type: "account", id: text(row.requester_username) } : { type: "department", id: "办公室" };
  if (sourceType === "purchase_request") {
    if (["草稿", "待补充材料"].includes(status)) return { type: "account", id: text(row.requester_username) };
    return { type: "department", id: status === "待办公室报销" ? "办公室" : "生活部" };
  }
  if (status === "待新媒体领取") return { type: "department", id: "新媒体中心" };
  if (status === "新媒体制作中") return { type: "account", id: text(row.handler_username) };
  if (status === "待主席审核") return { type: "account", id: text(row.reviewer_username) };
  return { type: "account", id: text(row.submitter_username) };
}

function project(sourceType: WorkItemSourceType, row: RawRecord): WorkItem {
  const sourceId = text(row.id);
  const status = text(row.status);
  const nextActor = nextActorFor(sourceType, row);
  const isWhiteCard = sourceType === "white_card";
  const isDone = toUnifiedWorkStatus(status) === "done";
  return {
    id: `${sourceType}:${sourceId}`, sourceType, sourceId, title: text(row.title), statusGroup: toUnifiedWorkStatus(status),
    nativeStatus: status, activityId: isWhiteCard ? "" : text(row.activity_id), activityName: isWhiteCard ? "" : text(row.activity_name),
    ownerDepartmentName: sourceType === "task" || sourceType === "subtask" ? text(row.department) : sourceType === "venue_request" ? "办公室" : sourceType === "purchase_request" ? "生活部" : "学习部 / 新媒体中心",
    assigneeAccountId: numberOrNull(row.assignee_account_id) ?? undefined,
    assigneeName: text(row.person || row.assignee || row.handler_name || row.reviewer_name),
    requesterAccountId: numberOrNull(row.requester_account_id) ?? undefined,
    requesterUsername: text(row.requester_username || row.submitter_username), requesterName: text(row.requester_name || row.submitter_name),
    priority: text(row.priority) || "普通", plannedStartAt: text(row.planned_start_at),
    dueAt: text(row.planned_end_at || row.deadline || row.expected_at || (row.usage_date && row.start_time ? `${row.usage_date}T${row.start_time}` : "")),
    completedAt: isDone ? text(row.updated_at) : "", blocked: Boolean(row.blocked), blockedReason: text(row.blocked_reason),
    nextActorType: nextActor.type, nextActorId: nextActor.id, createdAt: text(row.created_at), updatedAt: text(row.updated_at),
  };
}

async function upsertProjected(items: WorkItem[]) {
  if (!items.length) return;
  await db.batch(items.map((item) => db.prepare(`INSERT INTO work_items (
    id,source_type,source_id,title,status_group,native_status,activity_id,activity_name,owner_department_name,
    assignee_account_id,assignee_name,requester_account_id,requester_username,requester_name,priority,
    planned_start_at,due_at,completed_at,blocked,blocked_reason,next_actor_type,next_actor_id,created_at,updated_at
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(source_type,source_id) DO UPDATE SET title=excluded.title,status_group=excluded.status_group,
    native_status=excluded.native_status,activity_id=excluded.activity_id,activity_name=excluded.activity_name,
    owner_department_name=excluded.owner_department_name,assignee_account_id=excluded.assignee_account_id,
    assignee_name=excluded.assignee_name,requester_account_id=excluded.requester_account_id,
    requester_username=excluded.requester_username,requester_name=excluded.requester_name,priority=excluded.priority,
    planned_start_at=excluded.planned_start_at,due_at=excluded.due_at,completed_at=excluded.completed_at,
    blocked=excluded.blocked,blocked_reason=excluded.blocked_reason,next_actor_type=excluded.next_actor_type,
    next_actor_id=excluded.next_actor_id,updated_at=excluded.updated_at`)
    .bind(item.id,item.sourceType,item.sourceId,item.title,item.statusGroup,item.nativeStatus,item.activityId,item.activityName,
      item.ownerDepartmentName,item.assigneeAccountId ?? null,item.assigneeName,item.requesterAccountId ?? null,
      item.requesterUsername,item.requesterName,item.priority,item.plannedStartAt,item.dueAt,item.completedAt,
      item.blocked?1:0,item.blockedReason,item.nextActorType,item.nextActorId,item.createdAt || new Date().toISOString(),item.updatedAt || new Date().toISOString())));
}

export async function rebuildWorkItemIndex() {
  await ensureTaskSchema();
  await ensureWorkItemSchema();
  const [tasks, subtasks, venues, purchases, whiteCards] = await Promise.all([
    safeAll("SELECT * FROM tasks"),
    safeAll("SELECT subtasks.*, tasks.department, tasks.activity_id, tasks.activity_name FROM subtasks LEFT JOIN tasks ON tasks.id = subtasks.parent_task_id"),
    safeAll("SELECT venue_requests.*, app_accounts.id AS requester_account_id FROM venue_requests LEFT JOIN app_accounts ON app_accounts.username = venue_requests.requester_username"),
    safeAll("SELECT purchase_requests.*, app_accounts.id AS requester_account_id FROM purchase_requests LEFT JOIN app_accounts ON app_accounts.username = purchase_requests.requester_username"),
    safeAll("SELECT white_card_submissions.*, app_accounts.id AS requester_account_id FROM white_card_submissions LEFT JOIN app_accounts ON app_accounts.username = white_card_submissions.submitter_username"),
  ]);
  const items = [
    ...tasks.map((row) => project("task", row)), ...subtasks.map((row) => project("subtask", row)),
    ...venues.map((row) => project("venue_request", row)), ...purchases.map((row) => project("purchase_request", row)),
    ...whiteCards.map((row) => project("white_card", row)),
  ];
  await upsertProjected(items);
  return items.length;
}

export async function listWorkItemsForUser(user: AuthenticatedUser): Promise<WorkItem[]> {
  await rebuildWorkItemIndex();
  const rows = await db.prepare("SELECT * FROM work_items ORDER BY updated_at DESC, id DESC").all<WorkItemRow>();
  const items = (rows.results || []).map(rowToItem);
  if (["admin", "chair", "teacher"].includes(user.role)) return items;
  if (user.role === "leader") return items.filter((item) =>
    item.ownerDepartmentName.includes(user.department) || item.requesterUsername === user.username ||
    item.assigneeAccountId === user.id || item.nextActorId === user.username || item.nextActorId === user.department || item.nextActorId === `${user.department}:leader`,
  );
  return items.filter((item) => item.requesterUsername === user.username || item.assigneeAccountId === user.id || item.nextActorId === user.username || item.nextActorId === String(user.id));
}

export async function listActivityServiceWorkItems(activityId?: string): Promise<WorkItem[]> {
  await rebuildWorkItemIndex();
  const rows = activityId
    ? await db.prepare("SELECT * FROM work_items WHERE activity_id = ? AND source_type NOT IN ('task','subtask') ORDER BY updated_at DESC").bind(activityId).all<WorkItemRow>()
    : await db.prepare("SELECT * FROM work_items WHERE activity_id <> '' AND source_type NOT IN ('task','subtask') ORDER BY updated_at DESC").all<WorkItemRow>();
  return (rows.results || []).map(rowToItem);
}

