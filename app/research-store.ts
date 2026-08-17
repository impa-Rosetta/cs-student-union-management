// 功能调研存储：research_items 表，一行一条调研需求。
// 由 /api/research 读写；admin/chair 可新增编辑，其余角色只读。

import { getDb } from "./db.ts";

const db = getDb();

export interface ResearchItemRecord {
  id: string;
  name: string;
  requester: string;
  status: string;
  detail: string;
}

const SEED_RESEARCH: ResearchItemRecord[] = [
  { id: "venue", name: "场地申请与审批", requester: "办公室", status: "待调研", detail: "梳理场地借用、时间冲突和审批记录。" },
  { id: "expense", name: "经费报销与凭证", requester: "运维部", status: "待调研", detail: "记录预算、票据和报销进度。" },
  { id: "duty", name: "值班与排班管理", requester: "主席团", status: "评估中", detail: "按活动安排值班人员和签到。" },
  { id: "signup", name: "活动报名与签到", requester: "实践部", status: "评估中", detail: "统一报名名单和现场签到。" },
];

interface ResearchRow {
  id: string;
  name: string;
  requester: string;
  status: string;
  detail: string;
}

export async function ensureResearchItemsSchema() {
  await db.prepare(`CREATE TABLE IF NOT EXISTS research_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    requester TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT '待调研',
    detail TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
}

export async function seedResearchItems(): Promise<void> {
  await ensureResearchItemsSchema();
  const count = await db.prepare("SELECT COUNT(*) AS c FROM research_items").first<{ c: number }>();
  if ((count?.c ?? 0) > 0) return;
  const statements = SEED_RESEARCH.map((item, index) =>
    db.prepare("INSERT INTO research_items (id, name, requester, status, detail, sort_order) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(item.id, item.name, item.requester, item.status, item.detail, index),
  );
  await db.batch(statements);
}

export async function listResearchItems(): Promise<ResearchItemRecord[]> {
  await ensureResearchItemsSchema();
  await migrateLegacyResearchOnce();
  await seedResearchItems();
  const rows = await db.prepare("SELECT id, name, requester, status, detail FROM research_items ORDER BY sort_order, id")
    .all<ResearchRow>();
  return (rows.results || []).map((row) => ({
    id: row.id,
    name: row.name,
    requester: row.requester,
    status: row.status,
    detail: row.detail,
  }));
}

export async function upsertResearchItem(item: ResearchItemRecord): Promise<void> {
  await ensureResearchItemsSchema();
  const order = await db.prepare("SELECT COUNT(*) AS c FROM research_items").first<{ c: number }>();
  await db.prepare(`INSERT INTO research_items (id, name, requester, status, detail, sort_order, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, requester = excluded.requester,
      status = excluded.status, detail = excluded.detail, updated_at = CURRENT_TIMESTAMP`)
    .bind(item.id, item.name, item.requester, item.status, item.detail, order?.c ?? 0).run();
}

/** 一次性数据迁移：若调研表为空，则把 shared_state 中的历史调研需求迁入。 */
export async function migrateLegacyResearchOnce(): Promise<void> {
  const count = await db.prepare("SELECT COUNT(*) AS c FROM research_items").first<{ c: number }>();
  if ((count?.c ?? 0) > 0) return;
  const legacy = await db.prepare("SELECT value FROM shared_state WHERE key = 'research'").first<{ value: string }>();
  if (!legacy?.value) return;
  try {
    const parsed = JSON.parse(legacy.value);
    if (Array.isArray(parsed)) {
      for (const item of parsed) await upsertResearchItem(item as ResearchItemRecord);
    }
  } catch { /* 忽略损坏的历史数据 */ }
}
