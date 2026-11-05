import { getActivity } from "./activity-store.ts";
import { getDb } from "./db.ts";
import { listAllSubtasks, listAllTasks, upsertSubtasks, upsertTasks, type SubtaskEntity, type TaskEntity } from "./task-store.ts";

const db = getDb();

type TemplateTask = {
  title: string; department: string; kind: string; description: string; deadlineOffsetDays: number | null;
  startOffsetDays: number | null; endOffsetDays: number | null; controlMode: string; fields: unknown[];
  subtasks: Array<{ title: string; evidence: string; deadlineOffsetDays: number | null; startOffsetDays: number | null; endOffsetDays: number | null }>;
};

export type ActivityTemplate = {
  id: number; name: string; category: string; description: string; organizer: string; departments: string[];
  needsVenue: boolean; venueRequest: Record<string, unknown>; tasks: TemplateTask[]; createdBy: string; createdAt: string;
};

type Row = { id: number; name: string; category: string; description: string; organizer: string; departments_json: string; needs_venue: number; venue_request_json: string; tasks_json: string; created_by: string; created_at: string };

export async function ensureActivityTemplateSchema() {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS activity_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, category TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '', organizer TEXT NOT NULL DEFAULT '', departments_json TEXT NOT NULL DEFAULT '[]',
      needs_venue INTEGER NOT NULL DEFAULT 0, venue_request_json TEXT NOT NULL DEFAULT '{}', tasks_json TEXT NOT NULL DEFAULT '[]',
      created_by TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
  ]);
}

function parse<T>(value: string, fallback: T): T { try { return JSON.parse(value) as T; } catch { return fallback; } }
function entity(row: Row): ActivityTemplate { return { id: row.id, name: row.name, category: row.category, description: row.description, organizer: row.organizer, departments: parse(row.departments_json, []), needsVenue: Boolean(row.needs_venue), venueRequest: parse(row.venue_request_json, {}), tasks: parse(row.tasks_json, []), createdBy: row.created_by, createdAt: row.created_at }; }
function activityDateMs(value: unknown) { const match = String(value || "").match(/(\d{4})年(\d{1,2})月(\d{1,2})日/); return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime() : null; }
function offsetDays(value: unknown, base: number | null) { const parsed = Date.parse(String(value || "")); return base != null && Number.isFinite(parsed) ? Math.round((parsed - base) / 86400000) : null; }
function shifted(base: number, offset: number | null, fallback = "") { if (offset == null) return fallback; const date = new Date(base + offset * 86400000); return date.toISOString().slice(0, 16); }

export async function listActivityTemplates() { await ensureActivityTemplateSchema(); const rows = await db.prepare("SELECT * FROM activity_templates ORDER BY id DESC").all<Row>(); return (rows.results || []).map(entity); }

export async function captureActivityTemplate(activityId: string, name: string, createdBy: string) {
  await ensureActivityTemplateSchema();
  const activity = await getActivity(activityId); if (!activity) throw new Error("活动不存在");
  const allTasks = await listAllTasks(); const allSubtasks = await listAllSubtasks(); const base = activityDateMs(activity.date);
  const tasks: TemplateTask[] = allTasks.filter((task) => String(task.activityId || "") === activityId).map((task) => ({
    title: String(task.title || ""), department: String(task.department || ""), kind: String(task.kind || ""), description: String(task.description || ""),
    deadlineOffsetDays: offsetDays(task.deadline, base), startOffsetDays: offsetDays(task.plannedStartAt, base), endOffsetDays: offsetDays(task.plannedEndAt, base),
    controlMode: String(task.controlMode || ""), fields: Array.isArray(task.fields) ? task.fields : [],
    subtasks: allSubtasks.filter((subtask) => Number(subtask.parentTaskId) === task.id).map((subtask) => ({ title: String(subtask.title || ""), evidence: String(subtask.evidence || ""), deadlineOffsetDays: offsetDays(subtask.deadline, base), startOffsetDays: offsetDays(subtask.plannedStartAt, base), endOffsetDays: offsetDays(subtask.plannedEndAt, base) })),
  }));
  await db.prepare(`INSERT INTO activity_templates (name,category,description,organizer,departments_json,needs_venue,venue_request_json,tasks_json,created_by) VALUES (?,?,?,?,?,?,?,?,?)`)
    .bind(name, String(activity.category || ""), String(activity.description || ""), String(activity.organizer || ""), JSON.stringify(activity.departments || []), activity.needsVenue ? 1 : 0, JSON.stringify(activity.venueRequest || {}), JSON.stringify(tasks), createdBy).run();
  return (await listActivityTemplates())[0];
}

export async function instantiateActivityTemplate(templateId: number, activityId: string) {
  const template = (await listActivityTemplates()).find((item) => item.id === templateId); if (!template) throw new Error("活动模板不存在");
  const activity = await getActivity(activityId); if (!activity) throw new Error("活动不存在");
  const base = activityDateMs(activity.date) ?? Date.now(); const existing = await listAllTasks(); let nextId = Math.max(0, ...existing.map((item) => item.id)) + 1;
  const accounts = await db.prepare("SELECT id,name,role,department,active FROM app_accounts WHERE active = 1").all<{ id: number; name: string; role: string; department: string; active: number }>();
  const tasks: TaskEntity[] = []; const subtasks: SubtaskEntity[] = [];
  for (const source of template.tasks) {
    const owner = (accounts.results || []).find((item) => item.department === source.department && item.role === "leader");
    const taskId = nextId++;
    tasks.push({ id: taskId, title: source.title, department: source.department, person: owner?.name || "待分配", assigneeAccountId: owner?.id, deadline: shifted(base, source.deadlineOffsetDays), status: "待开始", risk: false, kind: source.kind, description: source.description, fields: source.fields, activityId, activityName: String(activity.name || ""), plannedStartAt: shifted(base, source.startOffsetDays), plannedEndAt: shifted(base, source.endOffsetDays), controlMode: source.controlMode, attachments: [] });
    const staff = (accounts.results || []).find((item) => item.department === source.department && item.role === "staff");
    source.subtasks.forEach((subtask, index) => subtasks.push({ id: `${taskId}-template-${index + 1}`, parentTaskId: taskId, parent: source.title, title: subtask.title, assignee: staff?.name || owner?.name || "待分配", assigneeAccountId: staff?.id || owner?.id, deadline: shifted(base, subtask.deadlineOffsetDays), plannedStartAt: shifted(base, subtask.startOffsetDays), plannedEndAt: shifted(base, subtask.endOffsetDays), evidence: subtask.evidence, status: "待开始", attachments: [] }));
  }
  await upsertTasks(tasks); await upsertSubtasks(subtasks);
  return { taskCount: tasks.length, subtaskCount: subtasks.length };
}

