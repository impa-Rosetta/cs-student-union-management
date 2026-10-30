import { sql } from "drizzle-orm";
import { type AnySQLiteColumn, index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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
  needsVenue: integer("needs_venue", { mode: "boolean" }).notNull().default(false),
  venueRequestJson: text("venue_request_json").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const officeRequests = sqliteTable("office_requests", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull(),
  requesterUsername: text("requester_username").notNull(),
  requesterName: text("requester_name").notNull(),
  requesterDepartment: text("requester_department").notNull(),
  activityId: text("activity_id").notNull().default(""),
  activityName: text("activity_name").notNull().default(""),
  deadline: text("deadline").notNull().default(""),
  description: text("description").notNull().default(""),
  detailsJson: text("details_json").notNull().default("{}"),
  materialsJson: text("materials_json").notNull().default("[]"),
  attachmentsJson: text("attachments_json").notNull().default("[]"),
  externalPlatform: text("external_platform").notNull().default(""),
  externalReference: text("external_reference").notNull().default(""),
  handlerName: text("handler_name").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_office_requests_status").on(table.status, table.updatedAt)]);

export const officeRequestEvents = sqliteTable("office_request_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  requestId: text("request_id").notNull(),
  action: text("action").notNull(),
  fromStatus: text("from_status").notNull(),
  toStatus: text("to_status").notNull(),
  actorName: text("actor_name").notNull(),
  note: text("note").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_office_request_events_request").on(table.requestId, table.id)]);

export const venueRequests = sqliteTable("venue_requests", {
  id: text("id").primaryKey(), status: text("status").notNull(), source: text("source").notNull().default("manual"), requesterUsername: text("requester_username").notNull(), requesterName: text("requester_name").notNull(), requesterDepartment: text("requester_department").notNull(),
  title: text("title").notNull(), purposeCategory: text("purpose_category").notNull().default(""), usageDepartmentsJson: text("usage_departments_json").notNull().default("[]"), usageDate: text("usage_date").notNull().default(""), startTime: text("start_time").notNull().default(""), endTime: text("end_time").notNull().default(""), attendeeCount: integer("attendee_count").notNull().default(0),
  roomTypesJson: text("room_types_json").notNull().default("[]"), equipmentJson: text("equipment_json").notNull().default("[]"), preferredLocation: text("preferred_location").notNull().default(""), notes: text("notes").notNull().default(""), attachmentsJson: text("attachments_json").notNull().default("[]"),
  activityId: text("activity_id").notNull().default(""), activityName: text("activity_name").notNull().default(""), confirmedRoom: text("confirmed_room").notNull().default(""), confirmedDate: text("confirmed_date").notNull().default(""), confirmedStartTime: text("confirmed_start_time").notNull().default(""), confirmedEndTime: text("confirmed_end_time").notNull().default(""),
  officeAttachmentsJson: text("office_attachments_json").notNull().default("[]"), handlingNote: text("handling_note").notNull().default(""), handlerName: text("handler_name").notNull().default(""), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`), updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_venue_requests_status").on(table.status, table.updatedAt)]);
export const venueRequestEvents = sqliteTable("venue_request_events", { id: integer("id").primaryKey({ autoIncrement: true }), requestId: text("request_id").notNull(), action: text("action").notNull(), fromStatus: text("from_status").notNull(), toStatus: text("to_status").notNull(), actorName: text("actor_name").notNull(), note: text("note").notNull().default(""), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`) }, (table) => [index("idx_venue_request_events_request").on(table.requestId, table.id)]);
export const meetingRounds = sqliteTable("meeting_rounds", { id: text("id").primaryKey(), title: text("title").notNull(), meetingDate: text("meeting_date").notNull().default(""), deadline: text("deadline").notNull().default(""), status: text("status").notNull(), departmentNamesJson: text("department_names_json").notNull().default("[]"), createdByName: text("created_by_name").notNull().default(""), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`), updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`) }, (table) => [index("idx_meeting_rounds_status").on(table.status, table.updatedAt)]);
export const meetingReports = sqliteTable("meeting_reports", { id: text("id").primaryKey(), roundId: text("round_id").notNull(), department: text("department").notNull(), status: text("status").notNull(), lastWeek: text("last_week").notNull().default(""), thisWeek: text("this_week").notNull().default(""), noticeCount: integer("notice_count").notNull().default(0), mediaCount: integer("media_count").notNull().default(0), emailReceived: integer("email_received").notNull().default(0), emailSent: integer("email_sent").notNull().default(0), meetingAttendance: integer("meeting_attendance").notNull().default(0), meetingDuration: text("meeting_duration").notNull().default(""), unplannedWorkload: text("unplanned_workload").notNull().default(""), submittedBy: text("submitted_by").notNull().default(""), reviewedBy: text("reviewed_by").notNull().default(""), reviewNote: text("review_note").notNull().default(""), submittedAt: text("submitted_at").notNull().default(""), updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`) }, (table) => [uniqueIndex("idx_meeting_reports_unique").on(table.roundId, table.department), index("idx_meeting_reports_round").on(table.roundId, table.status)]);
export const meetingReportEvents = sqliteTable("meeting_report_events", { id: integer("id").primaryKey({ autoIncrement: true }), reportId: text("report_id").notNull(), action: text("action").notNull(), fromStatus: text("from_status").notNull(), toStatus: text("to_status").notNull(), actorName: text("actor_name").notNull(), note: text("note").notNull().default(""), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`) }, (table) => [index("idx_meeting_report_events_report").on(table.reportId, table.id)]);
export const meetingExports = sqliteTable("meeting_exports", { id: text("id").primaryKey(), roundId: text("round_id").notNull(), objectKey: text("object_key").notNull(), fileName: text("file_name").notNull(), missingMode: text("missing_mode").notNull().default("omit"), generatedBy: text("generated_by").notNull().default(""), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`) }, (table) => [index("idx_meeting_exports_round").on(table.roundId, table.createdAt)]);

export const purchaseRequests = sqliteTable("purchase_requests", {
  id:text("id").primaryKey(),title:text("title").notNull(),status:text("status").notNull(),requesterUsername:text("requester_username").notNull(),requesterName:text("requester_name").notNull(),requesterDepartment:text("requester_department").notNull(),activityId:text("activity_id").notNull().default(""),activityName:text("activity_name").notNull().default(""),purpose:text("purpose").notNull().default(""),expectedAt:text("expected_at").notNull().default(""),estimatedTotal:real("estimated_total").notNull().default(0),actualTotal:real("actual_total").notNull().default(0),payee:text("payee").notNull().default(""),supplier:text("supplier").notNull().default(""),orderNumber:text("order_number").notNull().default(""),handlerName:text("handler_name").notNull().default(""),officeRequestId:text("office_request_id").unique(),attachmentsJson:text("attachments_json").notNull().default("[]"),createdAt:text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),updatedAt:text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table)=>[index("idx_purchase_requests_status").on(table.status,table.updatedAt)]);
export const purchaseItems = sqliteTable("purchase_items", {id:integer("id").primaryKey({autoIncrement:true}),purchaseId:text("purchase_id").notNull(),name:text("name").notNull(),imageUrl:text("image_url").notNull().default(""),productUrl:text("product_url").notNull().default(""),quantity:integer("quantity").notNull().default(1),estimatedUnitPrice:real("estimated_unit_price").notNull().default(0),note:text("note").notNull().default("")},(table)=>[index("idx_purchase_items_purchase").on(table.purchaseId)]);
export const purchaseEvents = sqliteTable("purchase_events", {id:integer("id").primaryKey({autoIncrement:true}),purchaseId:text("purchase_id").notNull(),action:text("action").notNull(),fromStatus:text("from_status").notNull(),toStatus:text("to_status").notNull(),actorName:text("actor_name").notNull(),note:text("note").notNull().default(""),createdAt:text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)},(table)=>[index("idx_purchase_events_purchase").on(table.purchaseId,table.id)]);
export const dormRooms = sqliteTable("dorm_rooms", {id:integer("id").primaryKey({autoIncrement:true}),building:text("building").notNull(),floor:text("floor").notNull().default(""),roomNumber:text("room_number").notNull(),leaderName:text("leader_name").notNull().default(""),contact:text("contact").notNull().default(""),residentCount:integer("resident_count").notNull().default(0),note:text("note").notNull().default(""),active:integer("active",{mode:"boolean"}).notNull().default(true),createdAt:text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),updatedAt:text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)},(table)=>[uniqueIndex("idx_dorm_rooms_unique").on(table.building,table.roomNumber)]);
export const dormInspectionBatches = sqliteTable("dorm_inspection_batches", {id:text("id").primaryKey(),name:text("name").notNull(),status:text("status").notNull(),plannedDate:text("planned_date").notNull().default(""),leaderName:text("leader_name").notNull().default(""),inspectorsJson:text("inspectors_json").notNull().default("[]"),roomIdsJson:text("room_ids_json").notNull().default("[]"),scoringNote:text("scoring_note").notNull().default(""),createdAt:text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),updatedAt:text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)},(table)=>[index("idx_inspection_batches_status").on(table.status,table.updatedAt)]);
export const dormInspectionRecords = sqliteTable("dorm_inspection_records", {id:integer("id").primaryKey({autoIncrement:true}),batchId:text("batch_id").notNull(),roomId:integer("room_id").notNull(),hygieneScore:integer("hygiene_score").notNull().default(0),tidinessScore:integer("tidiness_score").notNull().default(0),safetyScore:integer("safety_score").notNull().default(0),issueNote:text("issue_note").notNull().default(""),photosJson:text("photos_json").notNull().default("[]"),needsRectification:integer("needs_rectification",{mode:"boolean"}).notNull().default(false),rectificationDeadline:text("rectification_deadline").notNull().default(""),rectificationNote:text("rectification_note").notNull().default(""),reviewResult:text("review_result").notNull().default(""),reviewPhotosJson:text("review_photos_json").notNull().default("[]"),inspectorName:text("inspector_name").notNull().default(""),inspectedAt:text("inspected_at").notNull().default(""),reviewerName:text("reviewer_name").notNull().default(""),reviewedAt:text("reviewed_at").notNull().default("")},(table)=>[uniqueIndex("idx_inspection_record_unique").on(table.batchId,table.roomId),index("idx_inspection_records_batch").on(table.batchId,table.roomId)]);
export const lostFoundItems = sqliteTable("lost_found_items", {id:text("id").primaryKey(),name:text("name").notNull(),category:text("category").notNull().default(""),status:text("status").notNull(),foundLocation:text("found_location").notNull().default(""),foundAt:text("found_at").notNull().default(""),storageLocation:text("storage_location").notNull().default(""),publicDescription:text("public_description").notNull().default(""),secretFeature:text("secret_feature").notNull().default(""),photosJson:text("photos_json").notNull().default("[]"),registrantUsername:text("registrant_username").notNull(),registrantName:text("registrant_name").notNull(),publishUrl:text("publish_url").notNull().default(""),claimantName:text("claimant_name").notNull().default(""),claimantStudentNo:text("claimant_student_no").notNull().default(""),claimantContact:text("claimant_contact").notNull().default(""),verificationNote:text("verification_note").notNull().default(""),handlerName:text("handler_name").notNull().default(""),claimedAt:text("claimed_at").notNull().default(""),createdAt:text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),updatedAt:text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)},(table)=>[index("idx_lost_found_status").on(table.status,table.updatedAt)]);
export const lostFoundEvents = sqliteTable("lost_found_events", {id:integer("id").primaryKey({autoIncrement:true}),itemId:text("item_id").notNull(),action:text("action").notNull(),fromStatus:text("from_status").notNull(),toStatus:text("to_status").notNull(),actorName:text("actor_name").notNull(),note:text("note").notNull().default(""),createdAt:text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)},(table)=>[index("idx_lost_found_events_item").on(table.itemId,table.id)]);

export const organizationChangeRequests=sqliteTable("organization_change_requests",{id:text("id").primaryKey(),type:text("type").notNull(),status:text("status").notNull(),requesterUsername:text("requester_username").notNull(),requesterName:text("requester_name").notNull(),memberId:integer("member_id"),memberName:text("member_name").notNull().default(""),studentNo:text("student_no").notNull().default(""),phone:text("phone").notNull().default(""),currentDepartment:text("current_department").notNull().default(""),currentPosition:text("current_position").notNull().default(""),targetDepartment:text("target_department").notNull().default(""),targetPosition:text("target_position").notNull().default(""),effectiveDate:text("effective_date").notNull().default(""),reason:text("reason").notNull().default(""),handover:text("handover").notNull().default(""),attachmentsJson:text("attachments_json").notNull().default("[]"),organizationOpinion:text("organization_opinion").notNull().default(""),presidiumOpinion:text("presidium_opinion").notNull().default(""),syncedMemberId:integer("synced_member_id"),createdAt:text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),updatedAt:text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),effectiveAt:text("effective_at").notNull().default("")},t=>[index("idx_organization_changes_status").on(t.status,t.updatedAt)]);
export const organizationChangeEvents=sqliteTable("organization_change_events",{id:integer("id").primaryKey({autoIncrement:true}),entityType:text("entity_type").notNull(),entityId:text("entity_id").notNull(),action:text("action").notNull(),fromStatus:text("from_status").notNull(),toStatus:text("to_status").notNull(),actorName:text("actor_name").notNull(),note:text("note").notNull().default(""),createdAt:text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)},t=>[index("idx_organization_change_events_entity").on(t.entityType,t.entityId,t.id)]);
export const organizationAssessmentCycles=sqliteTable("organization_assessment_cycles",{id:text("id").primaryKey(),name:text("name").notNull(),type:text("type").notNull().default(""),status:text("status").notNull(),startDate:text("start_date").notNull().default(""),endDate:text("end_date").notNull().default(""),scope:text("scope").notNull().default(""),instructions:text("instructions").notNull().default(""),ownerName:text("owner_name").notNull().default(""),createdAt:text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),updatedAt:text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)});
export const organizationAssessmentRecords=sqliteTable("organization_assessment_records",{id:integer("id").primaryKey({autoIncrement:true}),cycleId:text("cycle_id").notNull(),memberId:integer("member_id").notNull(),memberName:text("member_name").notNull(),score:real("score").notNull().default(0),grade:text("grade").notNull().default(""),comment:text("comment").notNull().default(""),improvement:text("improvement").notNull().default(""),enteredBy:text("entered_by").notNull().default(""),updatedAt:text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)},t=>[uniqueIndex("idx_organization_assessment_record_unique").on(t.cycleId,t.memberId)]);
export const organizationAffairs=sqliteTable("organization_affairs",{id:text("id").primaryKey(),category:text("category").notNull().default(""),title:text("title").notNull(),status:text("status").notNull(),ownerName:text("owner_name").notNull().default(""),participantNames:text("participant_names").notNull().default(""),deadline:text("deadline").notNull().default(""),externalPlatform:text("external_platform").notNull().default(""),externalReference:text("external_reference").notNull().default(""),materials:text("materials").notNull().default(""),result:text("result").notNull().default(""),attachmentsJson:text("attachments_json").notNull().default("[]"),createdAt:text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),updatedAt:text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),archivedAt:text("archived_at").notNull().default("")},t=>[index("idx_organization_affairs_status").on(t.status,t.deadline)]);

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
