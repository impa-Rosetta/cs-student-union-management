// 系统配置存储：system_config 单行表（id=1），保存平台运行规则。
// 由 /api/config 读写；管理员可编辑，其余角色只读。

import { getDb } from "./db.ts";

const db = getDb();

export interface SystemConfigRecord {
  attachmentLimit: string;
  academicYearMonth: string;
  semesterBoundary: string;
  notificationDays: string;
  backupTime: string;
}

export const DEFAULT_SYSTEM_CONFIG: SystemConfigRecord = {
  attachmentLimit: "20",
  academicYearMonth: "8",
  semesterBoundary: "按学院校历",
  notificationDays: "180",
  backupTime: "23:30",
};

interface ConfigRow {
  attachment_limit: string;
  academic_year_month: string;
  semester_boundary: string;
  notification_days: string;
  backup_time: string;
}

export async function ensureSystemConfigSchema() {
  await db.prepare(`CREATE TABLE IF NOT EXISTS system_config (
    id INTEGER PRIMARY KEY,
    attachment_limit TEXT NOT NULL DEFAULT '20',
    academic_year_month TEXT NOT NULL DEFAULT '8',
    semester_boundary TEXT NOT NULL DEFAULT '按学院校历',
    notification_days TEXT NOT NULL DEFAULT '180',
    backup_time TEXT NOT NULL DEFAULT '23:30',
    updated_by TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
}

export async function getSystemConfig(): Promise<SystemConfigRecord> {
  await ensureSystemConfigSchema();
  await migrateLegacySystemConfigOnce();
  const row = await db.prepare(
    "SELECT attachment_limit, academic_year_month, semester_boundary, notification_days, backup_time FROM system_config WHERE id = 1",
  ).first<ConfigRow>();
  if (!row) return { ...DEFAULT_SYSTEM_CONFIG };
  return {
    attachmentLimit: row.attachment_limit,
    academicYearMonth: row.academic_year_month,
    semesterBoundary: row.semester_boundary,
    notificationDays: row.notification_days,
    backupTime: row.backup_time,
  };
}

export async function upsertSystemConfig(config: SystemConfigRecord, updatedBy: string): Promise<void> {
  await ensureSystemConfigSchema();
  await db.prepare(`INSERT INTO system_config (id, attachment_limit, academic_year_month, semester_boundary, notification_days, backup_time, updated_by, updated_at)
    VALUES (1, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET attachment_limit = excluded.attachment_limit,
      academic_year_month = excluded.academic_year_month,
      semester_boundary = excluded.semester_boundary,
      notification_days = excluded.notification_days,
      backup_time = excluded.backup_time,
      updated_by = excluded.updated_by,
      updated_at = CURRENT_TIMESTAMP`)
    .bind(
      config.attachmentLimit,
      config.academicYearMonth,
      config.semesterBoundary,
      config.notificationDays,
      config.backupTime,
      updatedBy,
    ).run();
}

/** 一次性数据迁移：若系统配置表为空，则把 shared_state 中的历史配置迁入。 */
export async function migrateLegacySystemConfigOnce(): Promise<void> {
  const count = await db.prepare("SELECT COUNT(*) AS c FROM system_config").first<{ c: number }>();
  if ((count?.c ?? 0) > 0) return;
  const legacy = await db.prepare("SELECT value FROM shared_state WHERE key = 'systemConfig'").first<{ value: string }>();
  if (!legacy?.value) return;
  try {
    const parsed = JSON.parse(legacy.value) as Partial<SystemConfigRecord>;
    await upsertSystemConfig({
      attachmentLimit: String(parsed.attachmentLimit ?? DEFAULT_SYSTEM_CONFIG.attachmentLimit),
      academicYearMonth: String(parsed.academicYearMonth ?? DEFAULT_SYSTEM_CONFIG.academicYearMonth),
      semesterBoundary: String(parsed.semesterBoundary ?? DEFAULT_SYSTEM_CONFIG.semesterBoundary),
      notificationDays: String(parsed.notificationDays ?? DEFAULT_SYSTEM_CONFIG.notificationDays),
      backupTime: String(parsed.backupTime ?? DEFAULT_SYSTEM_CONFIG.backupTime),
    }, "数据迁移");
  } catch { /* 忽略损坏的历史数据 */ }
}
