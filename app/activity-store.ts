// 活动关系存储：从 shared_state JSON 迁移到关系表 activities。
// 部门列表与里程碑以 JSON 列保存（后续可拆为 activity_departments 等表）。

import { getDb } from "./db.ts";

const db = getDb();

export type ActivityEntity = Record<string, unknown> & { id: string };

interface ActivityRow {
  id: string;
  name: string;
  category: string;
  state: string;
  date: string;
  day: string;
  month: string;
  time: string;
  location: string;
  organizer: string;
  teacher: string;
  progress: number;
  pending: number;
  departments_json: string;
  description: string;
  next_milestone: string;
  milestones_json: string;
}

function safeParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export async function ensureActivitySchema() {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '',
      state TEXT NOT NULL,
      date TEXT NOT NULL DEFAULT '',
      day TEXT NOT NULL DEFAULT '',
      month TEXT NOT NULL DEFAULT '',
      time TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      organizer TEXT NOT NULL DEFAULT '',
      teacher TEXT NOT NULL DEFAULT '',
      progress INTEGER NOT NULL DEFAULT 0,
      pending INTEGER NOT NULL DEFAULT 0,
      departments_json TEXT NOT NULL DEFAULT '[]',
      description TEXT NOT NULL DEFAULT '',
      next_milestone TEXT NOT NULL DEFAULT '',
      milestones_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
  ]);
}

function rowToActivity(row: ActivityRow): ActivityEntity {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    state: row.state,
    date: row.date,
    day: row.day,
    month: row.month,
    time: row.time,
    location: row.location,
    organizer: row.organizer,
    teacher: row.teacher,
    progress: row.progress,
    pending: row.pending,
    departments: safeParse(row.departments_json, []),
    description: row.description,
    nextMilestone: row.next_milestone,
    milestones: safeParse(row.milestones_json, []),
  };
}

export async function listActivities(): Promise<ActivityEntity[]> {
  await ensureActivitySchema();
  await migrateLegacyActivitiesOnce();
  const result = await db.prepare("SELECT * FROM activities ORDER BY created_at DESC").all<ActivityRow>();
  return (result.results || []).map(rowToActivity);
}

export async function upsertActivities(activities: ActivityEntity[]): Promise<void> {
  if (!activities.length) return;
  await ensureActivitySchema();
  const statements = activities.map((activity) =>
    db.prepare(`INSERT INTO activities (id, name, category, state, date, day, month, time, location, organizer, teacher, progress, pending, departments_json, description, next_milestone, milestones_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, category=excluded.category, state=excluded.state, date=excluded.date, day=excluded.day, month=excluded.month, time=excluded.time, location=excluded.location, organizer=excluded.organizer, teacher=excluded.teacher, progress=excluded.progress, pending=excluded.pending, departments_json=excluded.departments_json, description=excluded.description, next_milestone=excluded.next_milestone, milestones_json=excluded.milestones_json, updated_at=CURRENT_TIMESTAMP`)
      .bind(
        activity.id,
        String(activity.name ?? ""),
        String(activity.category ?? ""),
        String(activity.state ?? ""),
        String(activity.date ?? ""),
        String(activity.day ?? ""),
        String(activity.month ?? ""),
        String(activity.time ?? ""),
        String(activity.location ?? ""),
        String(activity.organizer ?? ""),
        String(activity.teacher ?? ""),
        Number(activity.progress ?? 0),
        Number(activity.pending ?? 0),
        JSON.stringify(activity.departments ?? []),
        String(activity.description ?? ""),
        String(activity.nextMilestone ?? ""),
        JSON.stringify(activity.milestones ?? []),
      ),
  );
  await db.batch(statements);
}

/** 一次性数据迁移：若活动表为空，则把 shared_state 中的历史 activities JSON 迁入。 */
export async function migrateLegacyActivitiesOnce(): Promise<void> {
  const count = await db.prepare("SELECT COUNT(*) AS c FROM activities").first<{ c: number }>();
  if ((count?.c ?? 0) > 0) return;
  const legacy = await db.prepare("SELECT value FROM shared_state WHERE key = 'activities'").first<{ value: string }>();
  if (!legacy?.value) return;
  try {
    const parsed = JSON.parse(legacy.value);
    if (Array.isArray(parsed) && parsed.length) await upsertActivities(parsed as ActivityEntity[]);
  } catch { /* 忽略损坏的历史数据 */ }
}
