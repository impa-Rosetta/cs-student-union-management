// 迁移一致性校验：确认 drizzle/*.sql 迁移链能生成与 db/schema.ts 一致的最终表结构。
//
// 这是可上线前的数据层门禁：任何「加了表/列但忘记写迁移」的漂移都会在这里暴露。
// 同样的预期结构也将用于校验未来的 PostgreSQL 迁移（platform/pg-schema.sql）。

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = join(root, "drizzle");

// 期望的最终表结构（列名取数据库 snake_case，与 db/schema.ts 一致）。
const EXPECTED = {
  terms: ["id", "name", "start_year", "end_year", "is_current", "created_at"],
  departments: ["id", "name", "group_name", "parent_id", "description", "sort_order"],
  members: ["id", "term_id", "department_id", "name", "student_no", "class_name", "grade", "major", "phone", "position", "role_level", "status", "sort_order", "created_at", "updated_at"],
  app_accounts: ["id", "external_user_id", "email", "username", "name", "role", "department", "title", "scope", "password_hash", "active", "created_at", "updated_at"],
  sessions: ["token", "user_id", "expires_at", "created_at"],
  shared_state: ["key", "value", "revision", "updated_by", "updated_at"],
  workflow_events: ["id", "entity_type", "entity_id", "action", "from_status", "to_status", "actor_name", "actor_role", "reason", "created_at"],
  notification_receipts: ["notification_id", "username", "read_at"],
  notifications: ["id", "recipient_usernames_json", "title", "detail", "level", "entity_type", "entity_id", "parent_task_id", "created_at"],
  activities: ["id", "name", "category", "state", "date", "day", "month", "time", "location", "organizer", "teacher", "progress", "pending", "departments_json", "description", "next_milestone", "milestones_json", "needs_venue", "venue_request_json", "created_at", "updated_at"],
  office_requests: ["id", "type", "title", "status", "requester_username", "requester_name", "requester_department", "activity_id", "activity_name", "deadline", "description", "details_json", "materials_json", "attachments_json", "external_platform", "external_reference", "handler_name", "created_at", "updated_at"],
  office_request_events: ["id", "request_id", "action", "from_status", "to_status", "actor_name", "note", "created_at"],
  venue_requests: ["id","status","source","requester_username","requester_name","requester_department","title","purpose_category","usage_departments_json","usage_date","start_time","end_time","attendee_count","room_types_json","equipment_json","preferred_location","notes","attachments_json","activity_id","activity_name","confirmed_room","confirmed_date","confirmed_start_time","confirmed_end_time","office_attachments_json","handling_note","handler_name","created_at","updated_at"],
  venue_request_events: ["id","request_id","action","from_status","to_status","actor_name","note","created_at"],
  meeting_rounds: ["id","title","meeting_date","deadline","status","department_names_json","created_by_name","created_at","updated_at"],
  meeting_reports: ["id","round_id","department","status","last_week","this_week","notice_count","media_count","email_received","email_sent","meeting_attendance","meeting_duration","unplanned_workload","submitted_by","reviewed_by","review_note","submitted_at","updated_at"],
  meeting_report_events: ["id","report_id","action","from_status","to_status","actor_name","note","created_at"],
  meeting_exports: ["id","round_id","object_key","file_name","missing_mode","generated_by","created_at"],
  purchase_requests: ["id","title","status","requester_username","requester_name","requester_department","activity_id","activity_name","purpose","expected_at","estimated_total","actual_total","payee","supplier","order_number","handler_name","office_request_id","attachments_json","created_at","updated_at"],
  purchase_items: ["id","purchase_id","name","image_url","product_url","quantity","estimated_unit_price","note"],
  purchase_events: ["id","purchase_id","action","from_status","to_status","actor_name","note","created_at"],
  dorm_rooms: ["id","building","floor","room_number","leader_name","contact","resident_count","note","active","created_at","updated_at"],
  dorm_inspection_batches: ["id","name","status","planned_date","leader_name","inspectors_json","room_ids_json","scoring_note","created_at","updated_at"],
  dorm_inspection_records: ["id","batch_id","room_id","hygiene_score","tidiness_score","safety_score","issue_note","photos_json","needs_rectification","rectification_deadline","rectification_note","review_result","review_photos_json","inspector_name","inspected_at","reviewer_name","reviewed_at"],
  lost_found_items: ["id","name","category","status","found_location","found_at","storage_location","public_description","secret_feature","photos_json","registrant_username","registrant_name","publish_url","claimant_name","claimant_student_no","claimant_contact","verification_note","handler_name","claimed_at","created_at","updated_at"],
  lost_found_events: ["id","item_id","action","from_status","to_status","actor_name","note","created_at"],
  organization_change_requests:["id","type","status","requester_username","requester_name","member_id","member_name","student_no","phone","current_department","current_position","target_department","target_position","effective_date","reason","handover","attachments_json","organization_opinion","presidium_opinion","synced_member_id","created_at","updated_at","effective_at"],
  organization_change_events:["id","entity_type","entity_id","action","from_status","to_status","actor_name","note","created_at"],
  organization_assessment_cycles:["id","name","type","status","start_date","end_date","scope","instructions","owner_name","created_at","updated_at"],
  organization_assessment_records:["id","cycle_id","member_id","member_name","score","grade","comment","improvement","entered_by","updated_at"],
  organization_affairs:["id","category","title","status","owner_name","participant_names","deadline","external_platform","external_reference","materials","result","attachments_json","created_at","updated_at","archived_at"],
  archive_records: ["id", "academic_year", "semester", "activity", "category", "name", "owner", "time", "size", "object_key", "description", "created_at"],
  task_type_schemas: ["name", "note", "icon", "fields_json", "sort_order"],
  system_config: ["id", "attachment_limit", "academic_year_month", "semester_boundary", "notification_days", "backup_time", "updated_by", "updated_at"],
  research_items: ["id", "name", "requester", "status", "detail", "sort_order", "created_at", "updated_at"],
  workflow_records: ["id", "kind", "payload_json", "created_at"],
  tasks: ["id", "title", "department", "person", "deadline", "status", "risk", "kind", "description", "fields_json", "activity_name", "activity_time", "activity_location", "liaison_teacher", "attachments_json", "control_mode", "last_action", "created_at", "updated_at"],
  subtasks: ["id", "parent_task_id", "parent", "title", "assignee", "deadline", "evidence", "status", "completed_by", "completion_note", "attachments_json", "last_action", "created_at", "updated_at"],
};

function stripBackticks(name) {
  return name.trim().replace(/`/g, "");
}

// 提取 CREATE TABLE 内第一层逗号分隔的列名（含 `ADD COLUMN`）。
function parseCreateColumns(body) {
  const columns = [];
  let depth = 0;
  let current = "";
  for (const ch of body) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      columns.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) columns.push(current);
  return columns
    .map((def) => def.trim())
    .filter((def) => def && !/^(PRIMARY|UNIQUE|FOREIGN|CONSTRAINT|CHECK)/i.test(def))
    .map((def) => stripBackticks(def.split(/\s+/)[0]))
    .filter((col) => col && col !== "");
}

async function computeFinalSchema() {
  const files = (await readdir(migrationsDir)).filter((f) => /^\d+_.*\.sql$/.test(f)).sort();
  const schema = {};
  for (const file of files) {
    const sql = await readFile(join(migrationsDir, file), "utf8");
    // CREATE TABLE
    for (const m of sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?(\w+)`?\s*\(([\s\S]*?)\)\s*;/gi)) {
      const table = stripBackticks(m[1]);
      const columns = parseCreateColumns(m[2]);
      if (!schema[table]) schema[table] = [];
      for (const col of columns) if (!schema[table].includes(col)) schema[table].push(col);
    }
    // ALTER TABLE ADD COLUMN（SQLite 允许省略 COLUMN 关键字）
    for (const m of sql.matchAll(/ALTER\s+TABLE\s+`?(\w+)`?\s+ADD\s+(?:COLUMN\s+)?`?(\w+)`?/gi)) {
      const table = stripBackticks(m[1]);
      const col = stripBackticks(m[2]);
      if (!schema[table]) schema[table] = [];
      if (!schema[table].includes(col)) schema[table].push(col);
    }
    // ALTER TABLE RENAME TO（SQLite 重建表：__new_x → x）
    for (const m of sql.matchAll(/ALTER\s+TABLE\s+`?(\w+)`?\s+RENAME\s+TO\s+`?(\w+)`?/gi)) {
      const from = stripBackticks(m[1]);
      const to = stripBackticks(m[2]);
      if (schema[from]) {
        schema[to] = schema[from];
        delete schema[from];
      }
    }
  }
  return schema;
}

test("迁移链：drizzle/*.sql 生成的表结构与 db/schema.ts 一致", async () => {
  const actual = await computeFinalSchema();
  const actualTables = Object.keys(actual).sort();
  const expectedTables = Object.keys(EXPECTED).sort();
  assert.deepEqual(actualTables, expectedTables, "表集合应一致");

  for (const [table, expectedCols] of Object.entries(EXPECTED)) {
    const actualCols = (actual[table] || []).slice().sort();
    assert.deepEqual(actualCols, [...expectedCols].sort(), `表 ${table} 的列应一致`);
  }
});

async function computePgSchema() {
  const sql = await readFile(join(root, "platform", "pg-schema.sql"), "utf8");
  const schema = {};
  for (const m of sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?(\w+)`?\s*\(([\s\S]*?)\)\s*;/gi)) {
    const table = stripBackticks(m[1]);
    schema[table] = parseCreateColumns(m[2]);
  }
  return schema;
}

test("PostgreSQL 迁移：platform/pg-schema.sql 表/列与 db/schema.ts 一致且无 SQLite 语法", async () => {
  const sql = await readFile(join(root, "platform", "pg-schema.sql"), "utf8");
  assert.doesNotMatch(sql, /AUTOINCREMENT/i, "不应含 SQLite 的 AUTOINCREMENT");
  assert.doesNotMatch(sql, /PRAGMA/i, "不应含 SQLite 的 PRAGMA");
  assert.doesNotMatch(sql, /INSERT\s+OR\s+IGNORE/i, "不应含 SQLite 的 INSERT OR IGNORE");

  const actual = await computePgSchema();
  const actualTables = Object.keys(actual).sort();
  assert.deepEqual(actualTables, Object.keys(EXPECTED).sort(), "PostgreSQL 迁移的表集合应一致");

  for (const [table, expectedCols] of Object.entries(EXPECTED)) {
    const actualCols = (actual[table] || []).slice().sort();
    assert.deepEqual(actualCols, [...expectedCols].sort(), `PostgreSQL 迁移表 ${table} 的列应一致`);
  }
});
