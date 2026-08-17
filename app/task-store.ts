// 任务/子任务关系存储：从 shared_state JSON 迁移到关系表 tasks / subtasks。
// 这里负责「整表读取 + 单实体 upsert」，动态字段（fields）与附件以 JSON 列保存。

import { getDb } from "./db.ts";

const db = getDb();

export type TaskEntity = Record<string, unknown> & { id: number };
export type SubtaskEntity = Record<string, unknown> & { id: string };

interface TaskRow {
  id: number;
  title: string;
  department: string;
  person: string;
  deadline: string;
  status: string;
  risk: number;
  kind: string;
  description: string;
  fields_json: string;
  activity_name: string | null;
  activity_time: string | null;
  activity_location: string | null;
  liaison_teacher: string | null;
  attachments_json: string;
  control_mode: string | null;
  last_action: string | null;
}

interface SubtaskRow {
  id: string;
  parent_task_id: number | null;
  parent: string;
  title: string;
  assignee: string;
  deadline: string;
  evidence: string;
  status: string;
  completed_by: string | null;
  completion_note: string | null;
  attachments_json: string;
  last_action: string | null;
}

function safeParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

function setIfPresent(target: Record<string, unknown>, key: string, value: unknown) {
  if (value !== null && value !== undefined) target[key] = value;
}

export async function ensureTaskSchema() {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      department TEXT NOT NULL,
      person TEXT NOT NULL,
      deadline TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,
      risk INTEGER NOT NULL DEFAULT 0,
      kind TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      fields_json TEXT NOT NULL DEFAULT '[]',
      activity_name TEXT,
      activity_time TEXT,
      activity_location TEXT,
      liaison_teacher TEXT,
      attachments_json TEXT NOT NULL DEFAULT '[]',
      control_mode TEXT,
      last_action TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS subtasks (
      id TEXT PRIMARY KEY,
      parent_task_id INTEGER,
      parent TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      assignee TEXT NOT NULL,
      deadline TEXT NOT NULL DEFAULT '',
      evidence TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,
      completed_by TEXT,
      completion_note TEXT,
      attachments_json TEXT NOT NULL DEFAULT '[]',
      last_action TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_subtasks_parent ON subtasks(parent_task_id)"),
  ]);
}

function rowToTask(row: TaskRow): TaskEntity {
  const task: TaskEntity = {
    id: row.id,
    title: row.title,
    department: row.department,
    person: row.person,
    deadline: row.deadline,
    status: row.status,
    risk: Boolean(row.risk),
    kind: row.kind,
    description: row.description,
    fields: safeParse(row.fields_json, []),
    attachments: safeParse(row.attachments_json, []),
  };
  setIfPresent(task, "activityName", row.activity_name);
  setIfPresent(task, "activityTime", row.activity_time);
  setIfPresent(task, "activityLocation", row.activity_location);
  setIfPresent(task, "liaisonTeacher", row.liaison_teacher);
  setIfPresent(task, "controlMode", row.control_mode);
  setIfPresent(task, "lastAction", row.last_action);
  return task;
}

function rowToSubtask(row: SubtaskRow): SubtaskEntity {
  const subtask: SubtaskEntity = {
    id: row.id,
    parentTaskId: row.parent_task_id ?? undefined,
    parent: row.parent,
    title: row.title,
    assignee: row.assignee,
    deadline: row.deadline,
    evidence: row.evidence,
    status: row.status,
    attachments: safeParse(row.attachments_json, []),
  };
  setIfPresent(subtask, "completedBy", row.completed_by);
  setIfPresent(subtask, "completionNote", row.completion_note);
  setIfPresent(subtask, "lastAction", row.last_action);
  return subtask;
}

export async function listAllTasks(): Promise<TaskEntity[]> {
  await ensureTaskSchema();
  await migrateLegacyTasksOnce();
  const result = await db.prepare("SELECT * FROM tasks ORDER BY id").all<TaskRow>();
  return (result.results || []).map(rowToTask);
}

/** 一次性数据迁移：若关系表为空，则把 shared_state 中的历史 tasks/subtasks JSON 迁入。 */
export async function migrateLegacyTasksOnce(): Promise<void> {
  const tasksCount = await db.prepare("SELECT COUNT(*) AS c FROM tasks").first<{ c: number }>();
  if ((tasksCount?.c ?? 0) > 0) return;
  const legacyTasks = await db.prepare("SELECT value FROM shared_state WHERE key = 'tasks'").first<{ value: string }>();
  const legacySubtasks = await db.prepare("SELECT value FROM shared_state WHERE key = 'subtasks'").first<{ value: string }>();
  if (legacyTasks?.value) {
    try {
      const parsed = JSON.parse(legacyTasks.value);
      if (Array.isArray(parsed) && parsed.length) await upsertTasks(parsed as TaskEntity[]);
    } catch { /* 忽略损坏的历史数据 */ }
  }
  if (legacySubtasks?.value) {
    try {
      const parsed = JSON.parse(legacySubtasks.value);
      if (Array.isArray(parsed) && parsed.length) await upsertSubtasks(parsed as SubtaskEntity[]);
    } catch { /* 忽略损坏的历史数据 */ }
  }
}

export async function listAllSubtasks(): Promise<SubtaskEntity[]> {
  await ensureTaskSchema();
  const result = await db.prepare("SELECT * FROM subtasks ORDER BY id").all<SubtaskRow>();
  return (result.results || []).map(rowToSubtask);
}

export async function upsertTasks(tasks: TaskEntity[]): Promise<void> {
  if (!tasks.length) return;
  await ensureTaskSchema();
  const statements = tasks.map((task) => {
    const fieldsJson = JSON.stringify(task.fields ?? []);
    const attachmentsJson = JSON.stringify(task.attachments ?? []);
    return db.prepare(`INSERT INTO tasks (id, title, department, person, deadline, status, risk, kind, description, fields_json, activity_name, activity_time, activity_location, liaison_teacher, attachments_json, control_mode, last_action, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET title=excluded.title, department=excluded.department, person=excluded.person, deadline=excluded.deadline, status=excluded.status, risk=excluded.risk, kind=excluded.kind, description=excluded.description, fields_json=excluded.fields_json, activity_name=excluded.activity_name, activity_time=excluded.activity_time, activity_location=excluded.activity_location, liaison_teacher=excluded.liaison_teacher, attachments_json=excluded.attachments_json, control_mode=excluded.control_mode, last_action=excluded.last_action, updated_at=CURRENT_TIMESTAMP`)
      .bind(
        task.id,
        String(task.title ?? ""),
        String(task.department ?? ""),
        String(task.person ?? ""),
        String(task.deadline ?? ""),
        String(task.status ?? ""),
        task.risk ? 1 : 0,
        String(task.kind ?? ""),
        String(task.description ?? ""),
        fieldsJson,
        task.activityName != null ? String(task.activityName) : null,
        task.activityTime != null ? String(task.activityTime) : null,
        task.activityLocation != null ? String(task.activityLocation) : null,
        task.liaisonTeacher != null ? String(task.liaisonTeacher) : null,
        attachmentsJson,
        task.controlMode != null ? String(task.controlMode) : null,
        task.lastAction != null ? String(task.lastAction) : null,
      );
  });
  await db.batch(statements);
}

export async function upsertSubtasks(subtasks: SubtaskEntity[]): Promise<void> {
  if (!subtasks.length) return;
  await ensureTaskSchema();
  const statements = subtasks.map((subtask) => {
    const attachmentsJson = JSON.stringify(subtask.attachments ?? []);
    return db.prepare(`INSERT INTO subtasks (id, parent_task_id, parent, title, assignee, deadline, evidence, status, completed_by, completion_note, attachments_json, last_action, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET parent_task_id=excluded.parent_task_id, parent=excluded.parent, title=excluded.title, assignee=excluded.assignee, deadline=excluded.deadline, evidence=excluded.evidence, status=excluded.status, completed_by=excluded.completed_by, completion_note=excluded.completion_note, attachments_json=excluded.attachments_json, last_action=excluded.last_action, updated_at=CURRENT_TIMESTAMP`)
      .bind(
        subtask.id,
        subtask.parentTaskId != null ? Number(subtask.parentTaskId) : null,
        String(subtask.parent ?? ""),
        String(subtask.title ?? ""),
        String(subtask.assignee ?? ""),
        String(subtask.deadline ?? ""),
        String(subtask.evidence ?? ""),
        String(subtask.status ?? ""),
        subtask.completedBy != null ? String(subtask.completedBy) : null,
        subtask.completionNote != null ? String(subtask.completionNote) : null,
        attachmentsJson,
        subtask.lastAction != null ? String(subtask.lastAction) : null,
      );
  });
  await db.batch(statements);
}

/** 对比前后实体，返回新增或发生变化（用于只 upsert 真正变动的实体）。 */
export function changedById<T extends { id: string | number }>(before: T[], after: T[]): T[] {
  const beforeById = new Map(before.map((entity) => [String(entity.id), entity]));
  const changed: T[] = [];
  for (const entity of after) {
    const prev = beforeById.get(String(entity.id));
    if (!prev || JSON.stringify(prev) !== JSON.stringify(entity)) changed.push(entity);
  }
  return changed;
}
