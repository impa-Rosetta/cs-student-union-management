import test from "node:test";
import assert from "node:assert/strict";
import {
  buildActivitySupervision,
  buildSupervisionOverview,
} from "../app/teacher-supervision/service.ts";

const activities = [
  { id: "activity-1", name: "迎新晚会", state: "执行中", date: "2026年11月10日", time: "19:00–21:00", location: "报告厅", organizer: "文艺部", departments: ["文艺部", "办公室"], description: "迎新活动" },
  { id: "activity-2", name: "摄影展", state: "策划中", date: "2026年12月1日", time: "全天", location: "大厅", organizer: "新媒体中心", departments: ["新媒体中心"] },
];

const tasks = [
  { id: 1, activityId: "activity-1", activityName: "迎新晚会", title: "节目组织", department: "文艺部", person: "张负责人", status: "进行中", plannedStartAt: "2026-11-01T08:00:00+08:00", plannedEndAt: "2026-11-08T18:00:00+08:00", deadline: "2026-11-08 18:00", risk: false, attachments: [] },
  { id: 2, activityId: "activity-1", activityName: "迎新晚会", title: "场地确认", department: "办公室", person: "李负责人", status: "待开始", plannedStartAt: "2026-11-03T08:00:00+08:00", plannedEndAt: "2026-11-04T18:00:00+08:00", deadline: "2026-11-04 18:00", risk: false, attachments: [] },
  { id: 3, activityId: "activity-2", activityName: "摄影展", title: "作品征集", department: "新媒体中心", person: "王负责人", status: "已完成", plannedStartAt: "2026-11-01T08:00:00+08:00", plannedEndAt: "2026-11-03T18:00:00+08:00", deadline: "2026-11-03 18:00", attachments: [] },
];

const subtasks = [
  { id: "sub-1", parentTaskId: 1, parent: "节目组织", title: "收集节目单", assignee: "干事甲", status: "已完成", plannedStartAt: "2026-11-01T08:00:00+08:00", plannedEndAt: "2026-11-02T18:00:00+08:00", deadline: "2026-11-02 18:00", attachments: [] },
  { id: "sub-2", parentTaskId: 1, parent: "节目组织", title: "安排彩排", assignee: "干事乙", status: "进行中", plannedStartAt: "2026-11-03T08:00:00+08:00", plannedEndAt: "2026-11-06T18:00:00+08:00", deadline: "2026-11-06 18:00", attachments: [] },
];

const events = [
  { id: 1, entity_type: "task", entity_id: "1", action: "create", from_status: "", to_status: "待开始", actor_name: "主席", actor_role: "chair", reason: null, created_at: "2026-11-01T09:00:00+08:00" },
  { id: 2, entity_type: "subtask", entity_id: "sub-2", action: "start", from_status: "待开始", to_status: "进行中", actor_name: "干事乙", actor_role: "staff", reason: null, created_at: "2026-11-03T09:00:00+08:00" },
  { id: 3, entity_type: "task", entity_id: "3", action: "approve", from_status: "待验收", to_status: "已完成", actor_name: "主席", actor_role: "chair", reason: null, created_at: "2026-11-04T09:00:00+08:00" },
];

test("activity supervision builds WBS, leaf progress, overdue state and filtered events", () => {
  const detail = buildActivitySupervision(activities[0], activities, tasks, subtasks, events, new Date("2026-11-05T12:00:00+08:00"));
  assert.equal(detail.summary.taskCount, 2);
  assert.equal(detail.summary.subtaskCount, 2);
  assert.equal(detail.summary.leafCount, 3);
  assert.equal(detail.summary.completedLeafCount, 1);
  assert.equal(detail.summary.progress, 50);
  assert.equal(detail.summary.overdueCount, 1);
  assert.equal(detail.tasks[0].children.length, 2);
  assert.equal(detail.tasks[1].scheduleState, "overdue");
  assert.deepEqual(detail.events.map((event) => event.id), [2, 1]);
  assert.equal(detail.range.start, "2026-11-01T08:00:00+08:00");
  assert.equal(detail.range.end, "2026-11-08T18:00:00+08:00");
});

test("overview includes every activity and rolls up real task progress", () => {
  const overview = buildSupervisionOverview(activities, tasks, subtasks, events, new Date("2026-11-05T12:00:00+08:00"));
  assert.equal(overview.activities.length, 2);
  assert.equal(overview.activities.find((item) => item.id === "activity-1").progress, 50);
  assert.equal(overview.activities.find((item) => item.id === "activity-2").progress, 100);
  assert.equal(overview.stats.activityCount, 2);
  assert.equal(overview.stats.overdueTaskCount, 1);
});

test("legacy task name fallback only links when activity name is unique", () => {
  const legacyTask = { id: 9, activityName: "摄影展", title: "布展", department: "实践部", person: "干事", status: "待开始", deadline: "", attachments: [] };
  const unique = buildActivitySupervision(activities[1], activities, [...tasks, legacyTask], subtasks, events, new Date("2026-11-05T12:00:00+08:00"));
  assert.equal(unique.tasks.some((item) => item.id === 9), true);
  const duplicateActivities = [...activities, { ...activities[1], id: "activity-3" }];
  const ambiguous = buildActivitySupervision(activities[1], duplicateActivities, [...tasks, legacyTask], subtasks, events, new Date("2026-11-05T12:00:00+08:00"));
  assert.equal(ambiguous.tasks.some((item) => item.id === 9), false);
});

