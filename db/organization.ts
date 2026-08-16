import { env } from "cloudflare:workers";

const departments = [
  ["办公室", "蒋祝琪分管"], ["实践部", "蒋祝琪分管"], ["生活部", "蒋祝琪分管"],
  ["党员之家", "张嘉辉分管"], ["组织部", "张嘉辉分管"], ["心理部", "张嘉辉分管"],
  ["科创中心", "徐介翰分管"], ["PC部", "徐介翰分管"], ["运维部", "徐介翰分管"], ["职规部", "徐介翰分管"],
  ["学习部", "柏开飞分管"], ["体育部", "柏开飞分管"], ["文艺部", "柏开飞分管"],
  ["新媒体中心", "孙亮杰分管"], ["校友部", "孙亮杰分管"],
];

export async function ensureOrganizationSchema() {
  const d1 = env.DB;
  await d1.batch([
    d1.prepare("CREATE TABLE IF NOT EXISTS terms (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, start_year INTEGER NOT NULL, end_year INTEGER NOT NULL, is_current INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    d1.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_terms_name ON terms(name)"),
    d1.prepare("CREATE TABLE IF NOT EXISTS departments (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, group_name TEXT NOT NULL DEFAULT '主席团直属', parent_id INTEGER REFERENCES departments(id) ON DELETE SET NULL, description TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0)"),
    d1.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_departments_name ON departments(name)"),
    d1.prepare("CREATE TABLE IF NOT EXISTS members (id INTEGER PRIMARY KEY AUTOINCREMENT, term_id INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE, department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL, name TEXT NOT NULL, student_no TEXT NOT NULL DEFAULT '', class_name TEXT NOT NULL DEFAULT '', grade TEXT NOT NULL DEFAULT '', major TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', position TEXT NOT NULL, role_level TEXT NOT NULL DEFAULT 'staff', status TEXT NOT NULL DEFAULT 'active', sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_members_term_department ON members(term_id, department_id)"),
    d1.prepare("CREATE INDEX IF NOT EXISTS idx_members_role_level ON members(role_level)"),
  ]);

  const departmentColumns = await d1.prepare("PRAGMA table_info(departments)").all<{ name: string }>();
  if (!departmentColumns.results.some((column) => column.name === "parent_id")) {
    await d1.prepare("ALTER TABLE departments ADD COLUMN parent_id INTEGER REFERENCES departments(id) ON DELETE SET NULL").run();
  }
  await d1.prepare("CREATE INDEX IF NOT EXISTS idx_departments_parent_id ON departments(parent_id)").run();

  const memberColumns = await d1.prepare("PRAGMA table_info(members)").all<{ name: string }>();
  if (!memberColumns.results.some((column) => column.name === "class_name")) {
    await d1.prepare("ALTER TABLE members ADD COLUMN class_name TEXT NOT NULL DEFAULT ''").run();
  }
  await d1.prepare("UPDATE members SET class_name = grade WHERE class_name = '' AND grade <> ''").run();

  const count = await d1.prepare("SELECT COUNT(*) AS count FROM terms").first<{ count: number }>();
  if ((count?.count ?? 0) === 0) {
    await d1.prepare("INSERT INTO terms (name, start_year, end_year, is_current) VALUES (?, ?, ?, 1)").bind("2026-2027届", 2026, 2027).run();
    for (let i = 0; i < departments.length; i++) {
      await d1.prepare("INSERT INTO departments (name, group_name, sort_order) VALUES (?, ?, ?)").bind(departments[i][0], departments[i][1], i + 1).run();
    }
  }

  await d1.prepare("UPDATE departments SET parent_id = (SELECT id FROM departments WHERE name = '科创中心') WHERE name IN ('PC部', '运维部')").run();
  if ((count?.count ?? 0) > 0) return;

  const term = await d1.prepare("SELECT id FROM terms WHERE is_current = 1 LIMIT 1").first<{ id: number }>();
  const departmentRows = await d1.prepare("SELECT id, name FROM departments").all<{ id: number; name: string }>();
  const dept = new Map(departmentRows.results.map((row) => [row.name, row.id]));
  const seeds: Array<[string, string, string | null, string, string]> = [
    ["蒋祝琪", "主席", null, "chair", "2023级"], ["张嘉辉", "主席", null, "chair", "2023级"],
    ["徐介翰", "主席", null, "chair", "2023级"], ["柏开飞", "主席", null, "chair", "2023级"], ["孙亮杰", "主席", null, "chair", "2023级"],
    ["陈雨桐", "负责人", "运维部", "leader", "2024级"], ["林浩然", "负责人", "PC部", "leader", "2024级"],
    ["赵可欣", "负责人", "心理部", "leader", "2024级"], ["宋佳宁", "负责人", "文艺部", "leader", "2024级"], ["许言", "负责人", "新媒体中心", "leader", "2024级"],
    ["周子轩", "干事", "运维部", "staff", "2025级"], ["王辰", "干事", "运维部", "staff", "2025级"], ["刘洋", "干事", "PC部", "staff", "2025级"],
    ["林悦", "干事", "心理部", "staff", "2025级"], ["郑欣", "干事", "文艺部", "staff", "2025级"],
    ["苏禾", "摄影干事", "新媒体中心", "staff", "2025级"], ["方可", "新闻稿干事", "新媒体中心", "staff", "2025级"], ["顾言", "视频干事", "新媒体中心", "staff", "2025级"],
  ];
  for (let i = 0; i < seeds.length; i++) {
    const [name, position, department, level, grade] = seeds[i];
    await d1.prepare("INSERT INTO members (term_id, department_id, name, grade, position, role_level, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(term!.id, department ? dept.get(department) ?? null : null, name, grade, position, level, i + 1).run();
  }
}
