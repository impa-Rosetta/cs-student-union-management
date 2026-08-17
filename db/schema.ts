import { sql } from "drizzle-orm";
import { type AnySQLiteColumn, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const terms = sqliteTable("terms", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  startYear: integer("start_year").notNull(),
  endYear: integer("end_year").notNull(),
  isCurrent: integer("is_current", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("idx_terms_name").on(table.name)]);

export const departments = sqliteTable("departments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  groupName: text("group_name").notNull().default("主席团直属"),
  parentId: integer("parent_id").references((): AnySQLiteColumn => departments.id, { onDelete: "set null" }),
  description: text("description").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
}, (table) => [
  uniqueIndex("idx_departments_name").on(table.name),
  index("idx_departments_parent_id").on(table.parentId),
]);

export const members = sqliteTable("members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  termId: integer("term_id").notNull().references(() => terms.id, { onDelete: "cascade" }),
  departmentId: integer("department_id").references(() => departments.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  studentNo: text("student_no").notNull().default(""),
  className: text("class_name").notNull().default(""),
  grade: text("grade").notNull().default(""),
  major: text("major").notNull().default(""),
  phone: text("phone").notNull().default(""),
  position: text("position").notNull(),
  roleLevel: text("role_level").notNull().default("staff"),
  status: text("status").notNull().default("active"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_members_term_department").on(table.termId, table.departmentId),
  index("idx_members_role_level").on(table.roleLevel),
]);

export const appAccounts = sqliteTable("app_accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  externalUserId: text("external_user_id"),
  email: text("email").notNull(),
  username: text("username").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  department: text("department").notNull().default(""),
  title: text("title").notNull().default(""),
  scope: text("scope").notNull().default("本人任务"),
  passwordHash: text("password_hash"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_app_accounts_email").on(table.email),
  uniqueIndex("idx_app_accounts_username").on(table.username),
]);

export const sessions = sqliteTable("sessions", {
  token: text("token").primaryKey(),
  userId: integer("user_id").notNull().references(() => appAccounts.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_sessions_user").on(table.userId)]);

export const sharedState = sqliteTable("shared_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  revision: integer("revision").notNull().default(1),
  updatedBy: text("updated_by").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const workflowEvents = sqliteTable("workflow_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(),
  fromStatus: text("from_status").notNull(),
  toStatus: text("to_status").notNull(),
  actorName: text("actor_name").notNull(),
  actorRole: text("actor_role").notNull(),
  reason: text("reason"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_workflow_events_entity").on(table.entityType, table.entityId)]);

export const notificationReceipts = sqliteTable("notification_receipts", {
  notificationId: text("notification_id").notNull(),
  username: text("username").notNull(),
  readAt: text("read_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_notification_receipts_pk").on(table.notificationId, table.username),
  index("idx_notification_receipts_user").on(table.username),
]);

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  recipientUsernamesJson: text("recipient_usernames_json").notNull().default("[]"),
  title: text("title").notNull(),
  detail: text("detail").notNull(),
  level: text("level"),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  parentTaskId: integer("parent_task_id"),
  createdAt: text("created_at").notNull(),
}, (table) => [index("idx_notifications_created").on(table.createdAt)]);

export const activities = sqliteTable("activities", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull().default(""),
  state: text("state").notNull(),
  date: text("date").notNull().default(""),
  day: text("day").notNull().default(""),
  month: text("month").notNull().default(""),
  time: text("time").notNull().default(""),
  location: text("location").notNull().default(""),
  organizer: text("organizer").notNull().default(""),
  teacher: text("teacher").notNull().default(""),
  progress: integer("progress").notNull().default(0),
  pending: integer("pending").notNull().default(0),
  departmentsJson: text("departments_json").notNull().default("[]"),
  description: text("description").notNull().default(""),
  nextMilestone: text("next_milestone").notNull().default(""),
  milestonesJson: text("milestones_json").notNull().default("[]"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const archiveRecords = sqliteTable("archive_records", {
  id: text("id").primaryKey(),
  academicYear: text("academic_year").notNull().default(""),
  semester: text("semester").notNull().default(""),
  activity: text("activity").notNull().default(""),
  category: text("category").notNull().default(""),
  name: text("name").notNull(),
  owner: text("owner").notNull().default(""),
  time: text("time").notNull().default(""),
  size: text("size").notNull().default(""),
  objectKey: text("object_key"),
  description: text("description"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_archive_academic").on(table.academicYear, table.semester)]);

export const taskTypeSchemas = sqliteTable("task_type_schemas", {
  name: text("name").primaryKey(),
  note: text("note").notNull().default(""),
  icon: text("icon").notNull().default(""),
  fieldsJson: text("fields_json").notNull().default("[]"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const systemConfig = sqliteTable("system_config", {
  id: integer("id").primaryKey(),
  attachmentLimit: text("attachment_limit").notNull().default("20"),
  academicYearMonth: text("academic_year_month").notNull().default("8"),
  semesterBoundary: text("semester_boundary").notNull().default("按学院校历"),
  notificationDays: text("notification_days").notNull().default("180"),
  backupTime: text("backup_time").notNull().default("23:30"),
  updatedBy: text("updated_by").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const researchItems = sqliteTable("research_items", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  requester: text("requester").notNull().default(""),
  status: text("status").notNull().default("待调研"),
  detail: text("detail").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const workflowRecords = sqliteTable("workflow_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kind: text("kind").notNull().default(""),
  payloadJson: text("payload_json").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_workflow_records_created").on(table.createdAt)]);

export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey(),
  title: text("title").notNull(),
  department: text("department").notNull(),
  person: text("person").notNull(),
  deadline: text("deadline").notNull().default(""),
  status: text("status").notNull(),
  risk: integer("risk", { mode: "boolean" }).notNull().default(false),
  kind: text("kind").notNull().default(""),
  description: text("description").notNull().default(""),
  fieldsJson: text("fields_json").notNull().default("[]"),
  activityName: text("activity_name"),
  activityTime: text("activity_time"),
  activityLocation: text("activity_location"),
  liaisonTeacher: text("liaison_teacher"),
  attachmentsJson: text("attachments_json").notNull().default("[]"),
  controlMode: text("control_mode"),
  lastAction: text("last_action"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const subtasks = sqliteTable("subtasks", {
  id: text("id").primaryKey(),
  parentTaskId: integer("parent_task_id"),
  parent: text("parent").notNull().default(""),
  title: text("title").notNull(),
  assignee: text("assignee").notNull(),
  deadline: text("deadline").notNull().default(""),
  evidence: text("evidence").notNull().default(""),
  status: text("status").notNull(),
  completedBy: text("completed_by"),
  completionNote: text("completion_note"),
  attachmentsJson: text("attachments_json").notNull().default("[]"),
  lastAction: text("last_action"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_subtasks_parent").on(table.parentTaskId)]);
