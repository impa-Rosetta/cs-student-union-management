// 任务类型模板存储：task_type_schemas 表，保存任务类型及动态字段定义。
// 前端读取此表渲染任务向导，管理员可新增/编辑任务类型。

import { getDb } from "./db.ts";

const db = getDb();

export interface TaskTypeField {
  key: string;
  label: string;
  placeholder: string;
  type?: string;
}

export interface TaskTypeSchema {
  name: string;
  note: string;
  icon: string;
  fields: TaskTypeField[];
}

const SEED_TYPES: TaskTypeSchema[] = [
  {
    name: "物资制作", note: "横幅、海报、采购与制作", icon: "package-check",
    fields: [
      { key: "content", label: "制作内容", placeholder: "例如：计算学院十佳歌手比赛" },
      { key: "size", label: "规格 / 尺寸", placeholder: "例如：8米 × 0.8米" },
      { key: "budget", label: "预算金额（元）", placeholder: "例如：120", type: "number" },
      { key: "supplier", label: "供应商", placeholder: "例如：校园图文中心" },
      { key: "location", label: "使用 / 悬挂地点", placeholder: "例如：计算机楼一楼入口" },
    ],
  },
  {
    name: "技术保障", note: "音响、灯光、网络与设备", icon: "settings",
    fields: [
      { key: "equipment", label: "设备清单", placeholder: "例如：无线麦 × 6、调音台 × 1" },
      { key: "rehearsal", label: "联调 / 彩排时间", placeholder: "例如：9月23日 19:00" },
      { key: "people", label: "现场值守人数", placeholder: "例如：2", type: "number" },
      { key: "backup", label: "备用方案", placeholder: "例如：备用有线麦 × 2" },
    ],
  },
  {
    name: "现场服务", note: "签到、清场、秩序与引导", icon: "users",
    fields: [
      { key: "scope", label: "工作范围", placeholder: "例如：观众席、后台、舞台周边" },
      { key: "people", label: "参与人数", placeholder: "例如：6", type: "number" },
      { key: "standard", label: "完成标准", placeholder: "例如：座椅归位、地面无垃圾" },
      { key: "supplies", label: "所需物资", placeholder: "例如：垃圾袋、手套、扫帚" },
    ],
  },
  {
    name: "宣传发布", note: "推文、海报、摄影与新闻", icon: "file-text",
    fields: [
      { key: "platform", label: "发布平台", placeholder: "例如：学院微信公众号" },
      { key: "publishTime", label: "计划发布时间", placeholder: "例如：9月20日 20:00" },
      { key: "reviewer", label: "内容审核人", placeholder: "例如：新媒体中心负责人" },
      { key: "assets", label: "素材要求", placeholder: "例如：主视觉、选手照片、报名二维码" },
    ],
  },
  {
    name: "新媒体制作", note: "活动拍摄、新闻稿、推送与视频", icon: "activity",
    fields: [
      { key: "deliverable", label: "交付类型", placeholder: "活动照片 / 新闻稿 / 推送 / 视频" },
      { key: "shotList", label: "拍摄清单", placeholder: "例如：签到、领导致辞、舞台全景、获奖合影" },
      { key: "newsFocus", label: "新闻稿重点", placeholder: "活动背景、过程亮点、获奖名单、育人成效" },
      { key: "deadline", label: "成稿 / 推送时间", placeholder: "例如：活动结束后24小时内" },
      { key: "platform", label: "发布平台", placeholder: "学院公众号、视频号、官网" },
      { key: "videoBrief", label: "视频脚本要求", placeholder: "如需视频，填写时长、画幅、节奏和字幕要求" },
    ],
  },
];

function safeParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export async function ensureTaskTypeSchema() {
  await db.prepare(`CREATE TABLE IF NOT EXISTS task_type_schemas (
    name TEXT PRIMARY KEY,
    note TEXT NOT NULL DEFAULT '',
    icon TEXT NOT NULL DEFAULT '',
    fields_json TEXT NOT NULL DEFAULT '[]',
    sort_order INTEGER NOT NULL DEFAULT 0
  )`).run();
}

export async function seedTaskTypes(): Promise<void> {
  await ensureTaskTypeSchema();
  const count = await db.prepare("SELECT COUNT(*) AS c FROM task_type_schemas").first<{ c: number }>();
  if ((count?.c ?? 0) > 0) return;
  const statements = SEED_TYPES.map((type, index) =>
    db.prepare("INSERT INTO task_type_schemas (name, note, icon, fields_json, sort_order) VALUES (?, ?, ?, ?, ?)")
      .bind(type.name, type.note, type.icon, JSON.stringify(type.fields), index),
  );
  await db.batch(statements);
}

export async function listTaskTypes(): Promise<TaskTypeSchema[]> {
  await ensureTaskTypeSchema();
  await seedTaskTypes();
  const rows = await db.prepare("SELECT * FROM task_type_schemas ORDER BY sort_order, name")
    .all<{ name: string; note: string; icon: string; fields_json: string }>();
  return (rows.results || []).map((row) => ({
    name: row.name,
    note: row.note,
    icon: row.icon,
    fields: safeParse(row.fields_json, []),
  }));
}

export async function upsertTaskType(type: TaskTypeSchema): Promise<void> {
  await ensureTaskTypeSchema();
  const order = await db.prepare("SELECT COUNT(*) AS c FROM task_type_schemas").first<{ c: number }>();
  await db.prepare(`INSERT INTO task_type_schemas (name, note, icon, fields_json, sort_order)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET note=excluded.note, icon=excluded.icon, fields_json=excluded.fields_json`)
    .bind(type.name, type.note, type.icon, JSON.stringify(type.fields), order?.c ?? 0).run();
}
