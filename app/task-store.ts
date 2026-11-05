// 任务/子任务关系存储：从 shared_state JSON 迁移到关系表 tasks / subtasks。
// 这里负责「整表读取 + 单实体 upsert」，动态字段（fields）与附件以 JSON 列保存。

import { getDb } from "./db.ts";

const db = getDb();
let taskSchemaPromise: Promise<void> | null = null;

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
  activity_id: string;
  assignee_account_id: number | null;
  owner_department_id: number | null;
  activity_name: string | null;
  planned_start_at: string;
  planned_end_at: string;
  activity_time: string | null;
  activity_location: string | null;
  liaison_teacher: string | null;
  attachments_json: string;
  control_mode: string | null;
  last_action: string | null;
  blocked: number;
  blocked_reason: string;
  reassignment_reason: string;
  schedule_change_reason: string;
}

interface SubtaskRow {
  id: string;
  parent_task_id: number | null;
  parent: string;
  title: string;
  assignee: string;
  deadline: string;
  planned_start_at: string;
  planned_end_at: string;
  assignee_account_id: number | null;
  evidence: string;
  status: string;
  completed_by: string | null;
  completion_note: string | null;
  attachments_json: string;
  last_action: string | null;
  blocked: number;
  blocked_reason: string;
  reassignment_reason: string;
  schedule_change_reason: string;
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

async function prepareTaskSchema() {
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
      activity_id TEXT NOT NULL DEFAULT '',
      assignee_account_id INTEGER,
      owner_department_id INTEGER,
      activity_name TEXT,
      planned_start_at TEXT NOT NULL DEFAULT '',
      planned_end_at TEXT NOT NULL DEFAULT '',
      activity_time TEXT,
      activity_location TEXT,
      liaison_teacher TEXT,
      attachments_json TEXT NOT NULL DEFAULT '[]',
      control_mode TEXT,
      last_action TEXT,
      blocked INTEGER NOT NULL DEFAULT 0,
      blocked_reason TEXT NOT NULL DEFAULT '',
      reassignment_reason TEXT NOT NULL DEFAULT '',
      schedule_change_reason TEXT NOT NULL DEFAULT '',
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
      planned_start_at TEXT NOT NULL DEFAULT '',
      planned_end_at TEXT NOT NULL DEFAULT '',
      assignee_account_id INTEGER,
      evidence TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,
      completed_by TEXT,
      completion_note TEXT,
      attachments_json TEXT NOT NULL DEFAULT '[]',
      last_action TEXT,
      blocked INTEGER NOT NULL DEFAULT 0,
      blocked_reason TEXT NOT NULL DEFAULT '',
      reassignment_reason TEXT NOT NULL DEFAULT '',
      schedule_change_reason TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_subtasks_parent ON subtasks(parent_task_id)"),
  ]);
  const taskColumns = await db.prepare("PRAGMA table_info(tasks)").all<{ name: string }>();
  if (!taskColumns.results.some((column) => column.name === "activity_id")) await db.prepare("ALTER TABLE tasks ADD COLUMN activity_id TEXT NOT NULL DEFAULT ''").run();
  if (!taskColumns.results.some((column) => column.name === "planned_start_at")) await db.prepare("ALTER TABLE tasks ADD COLUMN planned_start_at TEXT NOT NULL DEFAULT ''").run();
  if (!taskColumns.results.some((column) => column.name === "planned_end_at")) await db.prepare("ALTER TABLE tasks ADD COLUMN planned_end_at TEXT NOT NULL DEFAULT ''").run();
  if (!taskColumns.results.some((column) => column.name === "assignee_account_id")) await db.prepare("ALTER TABLE tasks ADD COLUMN assignee_account_id INTEGER").run();
  if (!taskColumns.results.some((column) => column.name === "owner_department_id")) await db.prepare("ALTER TABLE tasks ADD COLUMN owner_department_id INTEGER").run();
  if (!taskColumns.results.some((column) => column.name === "blocked")) await db.prepare("ALTER TABLE tasks ADD COLUMN blocked INTEGER NOT NULL DEFAULT 0").run();
  if (!taskColumns.results.some((column) => column.name === "blocked_reason")) await db.prepare("ALTER TABLE tasks ADD COLUMN blocked_reason TEXT NOT NULL DEFAULT ''").run();
  if (!taskColumns.results.some((column) => column.name === "reassignment_reason")) await db.prepare("ALTER TABLE tasks ADD COLUMN reassignment_reason TEXT NOT NULL DEFAULT ''").run();
  if (!taskColumns.results.some((column) => column.name === "schedule_change_reason")) await db.prepare("ALTER TABLE tasks ADD COLUMN schedule_change_reason TEXT NOT NULL DEFAULT ''").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_tasks_activity ON tasks(activity_id)").run();
  const subtaskColumns = await db.prepare("PRAGMA table_info(subtasks)").all<{ name: string }>();
  if (!subtaskColumns.results.some((column) => column.name === "planned_start_at")) await db.prepare("ALTER TABLE subtasks ADD COLUMN planned_start_at TEXT NOT NULL DEFAULT ''").run();
  if (!subtaskColumns.results.some((column) => column.name === "planned_end_at")) await db.prepare("ALTER TABLE subtasks ADD COLUMN planned_end_at TEXT NOT NULL DEFAULT ''").run();
  if (!subtaskColumns.results.some((column) => column.name === "assignee_account_id")) await db.prepare("ALTER TABLE subtasks ADD COLUMN assignee_account_id INTEGER").run();
  if (!subtaskColumns.results.some((column) => column.name === "blocked")) await db.prepare("ALTER TABLE subtasks ADD COLUMN blocked INTEGER NOT NULL DEFAULT 0").run();
  if (!subtaskColumns.results.some((column) => column.name === "blocked_reason")) await db.prepare("ALTER TABLE subtasks ADD COLUMN blocked_reason TEXT NOT NULL DEFAULT ''").run();
  if (!subtaskColumns.results.some((column) => column.name === "reassignment_reason")) await db.prepare("ALTER TABLE subtasks ADD COLUMN reassignment_reason TEXT NOT NULL DEFAULT ''").run();
  if (!subtaskColumns.results.some((column) => column.name === "schedule_change_reason")) await db.prepare("ALTER TABLE subtasks ADD COLUMN schedule_change_reason TEXT NOT NULL DEFAULT ''").run();
  await db.batch([
    db.prepare("CREATE INDEX IF NOT EXISTS idx_tasks_assignee_account ON tasks(assignee_account_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_tasks_owner_department ON tasks(owner_department_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_subtasks_assignee_account ON subtasks(assignee_account_id)"),
  ]);
  await db.prepare(`UPDATE tasks SET assignee_account_id = (
    SELECT CASE WHEN COUNT(*) = 1 THEN MAX(id) ELSE NULL END FROM app_accounts
    WHERE active = 1 AND name = tasks.person AND department = tasks.department
  ) WHERE assignee_account_id IS NULL`).run();
  await db.prepare(`UPDATE subtasks SET assignee_account_id = (
    SELECT CASE WHEN COUNT(*) = 1 THEN MAX(app_accounts.id) ELSE NULL END
    FROM app_accounts JOIN tasks ON tasks.id = subtasks.parent_task_id
    WHERE app_accounts.active = 1 AND app_accounts.name = subtasks.assignee
      AND app_accounts.department = tasks.department
  ) WHERE assignee_account_id IS NULL`).run();
  try {
    await db.prepare(`UPDATE tasks SET owner_department_id = (
      SELECT CASE WHEN COUNT(*) = 1 THEN MAX(id) ELSE NULL END FROM departments
      WHERE name = tasks.department
    ) WHERE owner_department_id IS NULL`).run();
  } catch {
    // 旧库组织目录尚未初始化时稍后再次迁移。
  }
  // 只补齐仓库自带的十佳歌手演示任务；用户后来创建的历史任务仍保持“日期未完善”。
  await db.prepare(`UPDATE tasks SET activity_id = 'top-singer', activity_name = '计算学院十佳歌手比赛'
    WHERE activity_id = '' AND COALESCE(activity_name, '') = '' AND id BETWEEN 1 AND 9`).run();
  await db.prepare(`UPDATE tasks SET
    planned_start_at = CASE id
      WHEN 1 THEN '2026-09-16T09:00:00+08:00' WHEN 2 THEN '2026-09-17T09:00:00+08:00' WHEN 3 THEN '2026-09-18T09:00:00+08:00'
      WHEN 4 THEN '2026-09-25T20:30:00+08:00' WHEN 5 THEN '2026-09-25T15:30:00+08:00' WHEN 6 THEN '2026-09-17T09:00:00+08:00'
      WHEN 7 THEN '2026-09-25T16:00:00+08:00' WHEN 8 THEN '2026-09-25T20:00:00+08:00' WHEN 9 THEN '2026-09-25T20:00:00+08:00' ELSE planned_start_at END,
    planned_end_at = CASE id
      WHEN 1 THEN '2026-09-20T18:00:00+08:00' WHEN 2 THEN '2026-09-21T12:00:00+08:00' WHEN 3 THEN '2026-09-23T21:30:00+08:00'
      WHEN 4 THEN '2026-09-25T22:00:00+08:00' WHEN 5 THEN '2026-09-25T17:30:00+08:00' WHEN 6 THEN '2026-09-19T20:00:00+08:00'
      WHEN 7 THEN '2026-09-26T12:00:00+08:00' WHEN 8 THEN '2026-09-26T20:00:00+08:00' WHEN 9 THEN '2026-09-28T18:00:00+08:00' ELSE planned_end_at END
    WHERE id BETWEEN 1 AND 9 AND planned_start_at = '' AND planned_end_at = ''`).run();
  await db.prepare(`UPDATE subtasks SET planned_start_at = '2026-09-20T09:00:00+08:00', planned_end_at = '2026-09-22T20:00:00+08:00'
    WHERE id = 'seed-light-console' AND planned_start_at = '' AND planned_end_at = ''`).run();
}

export function ensureTaskSchema() {
  if (!taskSchemaPromise) {
    taskSchemaPromise = prepareTaskSchema().catch((error) => {
      taskSchemaPromise = null;
      throw error;
    });
  }
  return taskSchemaPromise;
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
    activityId: row.activity_id,
    assigneeAccountId: row.assignee_account_id ?? undefined,
    ownerDepartmentId: row.owner_department_id ?? undefined,
    plannedStartAt: row.planned_start_at,
    plannedEndAt: row.planned_end_at,
    blocked: Boolean(row.blocked),
    blockedReason: row.blocked_reason,
    reassignmentReason: row.reassignment_reason,
    scheduleChangeReason: row.schedule_change_reason,
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
    plannedStartAt: row.planned_start_at,
    plannedEndAt: row.planned_end_at,
    assigneeAccountId: row.assignee_account_id ?? undefined,
    blocked: Boolean(row.blocked),
    blockedReason: row.blocked_reason,
    reassignmentReason: row.reassignment_reason,
    scheduleChangeReason: row.schedule_change_reason,
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
  const ownership = await resolveOwnership(tasks, []);
  const statements = ownership.tasks.map((task) => {
    const fieldsJson = JSON.stringify(task.fields ?? []);
    const attachmentsJson = JSON.stringify(task.attachments ?? []);
    return db.prepare(`INSERT INTO tasks (id, title, department, person, deadline, status, risk, kind, description, fields_json, activity_id, assignee_account_id, owner_department_id, activity_name, planned_start_at, planned_end_at, activity_time, activity_location, liaison_teacher, attachments_json, control_mode, last_action, blocked, blocked_reason, reassignment_reason, schedule_change_reason, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET title=excluded.title, department=excluded.department, person=excluded.person, deadline=excluded.deadline, status=excluded.status, risk=excluded.risk, kind=excluded.kind, description=excluded.description, fields_json=excluded.fields_json, activity_id=excluded.activity_id, assignee_account_id=excluded.assignee_account_id, owner_department_id=excluded.owner_department_id, activity_name=excluded.activity_name, planned_start_at=excluded.planned_start_at, planned_end_at=excluded.planned_end_at, activity_time=excluded.activity_time, activity_location=excluded.activity_location, liaison_teacher=excluded.liaison_teacher, attachments_json=excluded.attachments_json, control_mode=excluded.control_mode, last_action=excluded.last_action, blocked=excluded.blocked, blocked_reason=excluded.blocked_reason, reassignment_reason=excluded.reassignment_reason, schedule_change_reason=excluded.schedule_change_reason, updated_at=CURRENT_TIMESTAMP`)
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
        String(task.activityId ?? ""),
        task.assigneeAccountId != null ? Number(task.assigneeAccountId) : null,
        task.ownerDepartmentId != null ? Number(task.ownerDepartmentId) : null,
        task.activityName != null ? String(task.activityName) : null,
        String(task.plannedStartAt ?? ""),
        String(task.plannedEndAt ?? ""),
        task.activityTime != null ? String(task.activityTime) : null,
        task.activityLocation != null ? String(task.activityLocation) : null,
        task.liaisonTeacher != null ? String(task.liaisonTeacher) : null,
        attachmentsJson,
        task.controlMode != null ? String(task.controlMode) : null,
        task.lastAction != null ? String(task.lastAction) : null,
        task.blocked ? 1 : 0,
        String(task.blockedReason ?? ""),
        String(task.reassignmentReason ?? ""),
        String(task.scheduleChangeReason ?? ""),
      );
  });
  await db.batch(statements);
}

export async function upsertSubtasks(subtasks: SubtaskEntity[]): Promise<void> {
  if (!subtasks.length) return;
  await ensureTaskSchema();
  const ownership = await resolveOwnership([], subtasks);
  const statements = ownership.subtasks.map((subtask) => {
    const attachmentsJson = JSON.stringify(subtask.attachments ?? []);
    return db.prepare(`INSERT INTO subtasks (id, parent_task_id, parent, title, assignee, assignee_account_id, deadline, planned_start_at, planned_end_at, evidence, status, completed_by, completion_note, attachments_json, last_action, blocked, blocked_reason, reassignment_reason, schedule_change_reason, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET parent_task_id=excluded.parent_task_id, parent=excluded.parent, title=excluded.title, assignee=excluded.assignee, assignee_account_id=excluded.assignee_account_id, deadline=excluded.deadline, planned_start_at=excluded.planned_start_at, planned_end_at=excluded.planned_end_at, evidence=excluded.evidence, status=excluded.status, completed_by=excluded.completed_by, completion_note=excluded.completion_note, attachments_json=excluded.attachments_json, last_action=excluded.last_action, blocked=excluded.blocked, blocked_reason=excluded.blocked_reason, reassignment_reason=excluded.reassignment_reason, schedule_change_reason=excluded.schedule_change_reason, updated_at=CURRENT_TIMESTAMP`)
      .bind(
        subtask.id,
        subtask.parentTaskId != null ? Number(subtask.parentTaskId) : null,
        String(subtask.parent ?? ""),
        String(subtask.title ?? ""),
        String(subtask.assignee ?? ""),
        subtask.assigneeAccountId != null ? Number(subtask.assigneeAccountId) : null,
        String(subtask.deadline ?? ""),
        String(subtask.plannedStartAt ?? ""),
        String(subtask.plannedEndAt ?? ""),
        String(subtask.evidence ?? ""),
        String(subtask.status ?? ""),
        subtask.completedBy != null ? String(subtask.completedBy) : null,
        subtask.completionNote != null ? String(subtask.completionNote) : null,
        attachmentsJson,
        subtask.lastAction != null ? String(subtask.lastAction) : null,
        subtask.blocked ? 1 : 0,
        String(subtask.blockedReason ?? ""),
        String(subtask.reassignmentReason ?? ""),
        String(subtask.scheduleChangeReason ?? ""),
      );
  });
  await db.batch(statements);
}

type OwnershipAccount = { id: number; name: string; department: string };
type OwnershipDepartment = { id: number; name: string };

async function resolveOwnership(tasks: TaskEntity[], subtasks: SubtaskEntity[]) {
  const accountRows = await db.prepare("SELECT id, name, department FROM app_accounts WHERE active = 1").all<OwnershipAccount>();
  let departments: OwnershipDepartment[] = [];
  try {
    const departmentRows = await db.prepare("SELECT id, name FROM departments").all<OwnershipDepartment>();
    departments = departmentRows.results || [];
  } catch {
    // 旧库可能尚未初始化组织目录；姓名快照仍可工作，后续迁移可再次回填。
  }
  const accounts = accountRows.results || [];
  const persistedTasks = tasks.map((task) => ({ ...task }));
  const existingTasks = subtasks.length ? await listAllTasks() : [];
  const taskById = new Map([...existingTasks, ...persistedTasks].map((task) => [Number(task.id), task]));

  for (const task of persistedTasks) {
    if (task.assigneeAccountId == null) {
      const matches = accounts.filter((account) => account.name === String(task.person || "") && account.department === String(task.department || ""));
      if (matches.length === 1) task.assigneeAccountId = matches[0].id;
    }
    if (task.ownerDepartmentId == null) {
      const matches = departments.filter((department) => department.name === String(task.department || ""));
      if (matches.length === 1) task.ownerDepartmentId = matches[0].id;
    }
  }

  const persistedSubtasks = subtasks.map((subtask) => ({ ...subtask }));
  for (const subtask of persistedSubtasks) {
    if (subtask.assigneeAccountId != null) continue;
    const parent = taskById.get(Number(subtask.parentTaskId));
    const matches = accounts.filter((account) => account.name === String(subtask.assignee || "") && (!parent || account.department === String(parent.department || "")));
    if (matches.length === 1) subtask.assigneeAccountId = matches[0].id;
  }
  return { tasks: persistedTasks, subtasks: persistedSubtasks };
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
