// 归档资料关系存储：从 shared_state JSON 迁移到关系表 archive_records。

import { getDb } from "./db.ts";

const db = getDb();

export type ArchiveEntity = Record<string, unknown> & { id: string };

interface ArchiveRow {
  id: string;
  academic_year: string;
  semester: string;
  activity: string;
  category: string;
  name: string;
  owner: string;
  time: string;
  size: string;
  object_key: string | null;
  description: string | null;
}

export async function ensureArchiveSchema() {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS archive_records (
      id TEXT PRIMARY KEY,
      academic_year TEXT NOT NULL DEFAULT '',
      semester TEXT NOT NULL DEFAULT '',
      activity TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      owner TEXT NOT NULL DEFAULT '',
      time TEXT NOT NULL DEFAULT '',
      size TEXT NOT NULL DEFAULT '',
      object_key TEXT,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_archive_academic ON archive_records(academic_year, semester)"),
  ]);
}

function rowToArchive(row: ArchiveRow): ArchiveEntity {
  const record: ArchiveEntity = {
    id: row.id,
    academicYear: row.academic_year,
    semester: row.semester,
    activity: row.activity,
    category: row.category,
    name: row.name,
    owner: row.owner,
    time: row.time,
    size: row.size,
  };
  if (row.object_key !== null) record.key = row.object_key;
  if (row.description !== null) record.description = row.description;
  return record;
}

export async function listArchiveRecords(): Promise<ArchiveEntity[]> {
  await ensureArchiveSchema();
  await migrateLegacyArchiveOnce();
  const result = await db.prepare("SELECT * FROM archive_records ORDER BY created_at DESC").all<ArchiveRow>();
  return (result.results || []).map(rowToArchive);
}

export async function upsertArchiveRecords(records: ArchiveEntity[]): Promise<void> {
  if (!records.length) return;
  await ensureArchiveSchema();
  const statements = records.map((record) =>
    db.prepare(`INSERT INTO archive_records (id, academic_year, semester, activity, category, name, owner, time, size, object_key, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET academic_year=excluded.academic_year, semester=excluded.semester, activity=excluded.activity, category=excluded.category, name=excluded.name, owner=excluded.owner, time=excluded.time, size=excluded.size, object_key=excluded.object_key, description=excluded.description`)
      .bind(
        record.id,
        String(record.academicYear ?? ""),
        String(record.semester ?? ""),
        String(record.activity ?? ""),
        String(record.category ?? ""),
        String(record.name ?? ""),
        String(record.owner ?? ""),
        String(record.time ?? ""),
        String(record.size ?? ""),
        record.key != null ? String(record.key) : null,
        record.description != null ? String(record.description) : null,
      ),
  );
  await db.batch(statements);
}

/** 一次性数据迁移：若归档表为空，则把 shared_state 中的历史 archive JSON 迁入。 */
export async function migrateLegacyArchiveOnce(): Promise<void> {
  const count = await db.prepare("SELECT COUNT(*) AS c FROM archive_records").first<{ c: number }>();
  if ((count?.c ?? 0) > 0) return;
  const legacy = await db.prepare("SELECT value FROM shared_state WHERE key = 'archive'").first<{ value: string }>();
  if (!legacy?.value) return;
  try {
    const parsed = JSON.parse(legacy.value);
    if (Array.isArray(parsed) && parsed.length) await upsertArchiveRecords(parsed as ArchiveEntity[]);
  } catch { /* 忽略损坏的历史数据 */ }
}
