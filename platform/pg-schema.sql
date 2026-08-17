-- PostgreSQL 表结构（自托管 / 国内部署用）。
--
-- 由 db/schema.ts 的权威结构手工翻译而来；tests/migration-consistency.test.mjs 会校验
-- 本文件的表/列与 db/schema.ts 一致，防止漂移。
--
-- 类型策略（与 SQLite 版本对齐，便于业务层最小改动）：
--   - 自增主键          → SERIAL PRIMARY KEY
--   - 显式赋值的整型主键 → INTEGER PRIMARY KEY（tasks.id / system_config.id）
--   - 布尔列            → BOOLEAN（active / risk / is_current）
--   - 时间戳列          → TIMESTAMPTZ（created_at / updated_at / expires_at / read_at）
--   - *_json 列         → TEXT（业务层仍 JSON.parse，避免 pg 自动解析带来的行为差异）
--
-- 已知剩余工作（真实 PostgreSQL 联调时处理）：
--   - 存储模块里的 D1 时代运行时 ensure*Schema（CREATE TABLE IF NOT EXISTS）在 PG 下
--     不适用，应改为「部署时执行本迁移 + 运行时跳过建表」；
--   - 时间戳列从 TEXT 改为 TIMESTAMPTZ 后，读取端由「字符串」变为「Date」，个别
--     字符串拼接需适配。

CREATE TABLE terms (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  start_year INTEGER NOT NULL,
  end_year INTEGER NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_terms_name ON terms (name);

CREATE TABLE departments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  group_name TEXT NOT NULL DEFAULT '主席团直属',
  parent_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX idx_departments_name ON departments (name);
CREATE INDEX idx_departments_parent_id ON departments (parent_id);

CREATE TABLE members (
  id SERIAL PRIMARY KEY,
  term_id INTEGER NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  student_no TEXT NOT NULL DEFAULT '',
  class_name TEXT NOT NULL DEFAULT '',
  grade TEXT NOT NULL DEFAULT '',
  major TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  position TEXT NOT NULL,
  role_level TEXT NOT NULL DEFAULT 'staff',
  status TEXT NOT NULL DEFAULT 'active',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_members_term_department ON members (term_id, department_id);
CREATE INDEX idx_members_role_level ON members (role_level);

CREATE TABLE app_accounts (
  id SERIAL PRIMARY KEY,
  external_user_id TEXT,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','chair','leader','staff','teacher')),
  department TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  scope TEXT NOT NULL DEFAULT '本人任务',
  password_hash TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES app_accounts(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sessions_user ON sessions (user_id);

CREATE TABLE shared_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE workflow_events (
  id SERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_workflow_events_entity ON workflow_events (entity_type, entity_id);

CREATE TABLE notification_receipts (
  notification_id TEXT NOT NULL,
  username TEXT NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (notification_id, username)
);
CREATE INDEX idx_notification_receipts_user ON notification_receipts (username);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  recipient_usernames_json TEXT NOT NULL DEFAULT '[]',
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  level TEXT,
  entity_type TEXT,
  entity_id TEXT,
  parent_task_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_notifications_created ON notifications (created_at);

CREATE TABLE activities (
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE archive_records (
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_archive_academic ON archive_records (academic_year, semester);

CREATE TABLE task_type_schemas (
  name TEXT PRIMARY KEY,
  note TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '',
  fields_json TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE system_config (
  id INTEGER PRIMARY KEY,
  attachment_limit TEXT NOT NULL DEFAULT '20',
  academic_year_month TEXT NOT NULL DEFAULT '8',
  semester_boundary TEXT NOT NULL DEFAULT '按学院校历',
  notification_days TEXT NOT NULL DEFAULT '180',
  backup_time TEXT NOT NULL DEFAULT '23:30',
  updated_by TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE research_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  requester TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '待调研',
  detail TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE workflow_records (
  id SERIAL PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT '',
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_workflow_records_created ON workflow_records (created_at);

CREATE TABLE tasks (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  department TEXT NOT NULL,
  person TEXT NOT NULL,
  deadline TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  risk BOOLEAN NOT NULL DEFAULT FALSE,
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE subtasks (
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_subtasks_parent ON subtasks (parent_task_id);
