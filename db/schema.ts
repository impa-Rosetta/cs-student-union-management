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
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_app_accounts_email").on(table.email),
  uniqueIndex("idx_app_accounts_username").on(table.username),
]);

export const sharedState = sqliteTable("shared_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  revision: integer("revision").notNull().default(1),
  updatedBy: text("updated_by").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
