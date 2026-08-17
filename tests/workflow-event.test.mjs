import test from "node:test";
import assert from "node:assert/strict";
import { applyTaskAction, createTask } from "../app/workflow/apply-task-action.ts";
import { applySubtaskAction, createSubtask } from "../app/workflow/apply-subtask-action.ts";

const task = { id: 1, title: "T", department: "运维部", person: "陈雨桐", status: "进行中" };
const subtask = { id: "s1", parentTaskId: 1, title: "a", assignee: "周子轩", status: "待开始" };
const deptLeader = { role: "leader", name: "陈雨桐", department: "运维部" };
const chair = { role: "chair", name: "徐介翰", department: "主席团" };
const staff = { role: "staff", name: "周子轩", department: "运维部" };

test("task 转换返回审计事件", () => {
  const r = applyTaskAction([{ ...task, status: "待验收" }], [], 1, "approve", chair);
  assert.equal(r.ok, true);
  assert.equal(r.event.entityType, "task");
  assert.equal(r.event.entityId, 1);
  assert.equal(r.event.action, "approve");
  assert.equal(r.event.fromStatus, "待验收");
  assert.equal(r.event.toStatus, "已完成");
});

test("subtask 转换与创建返回审计事件", () => {
  const started = applySubtaskAction([task], [subtask], "s1", "start", staff);
  assert.equal(started.ok, true);
  assert.equal(started.event.entityType, "subtask");
  assert.equal(started.event.entityId, "s1");
  assert.equal(started.event.action, "start");
  assert.equal(started.event.fromStatus, "待开始");
  assert.equal(started.event.toStatus, "进行中");

  const created = createSubtask([task], [], 1, deptLeader, { title: "x", assignee: "周子轩" });
  assert.equal(created.ok, true);
  assert.equal(created.event.entityType, "subtask");
  assert.equal(created.event.action, "create");
  assert.equal(created.event.fromStatus, "");
  assert.equal(created.event.toStatus, "待开始");
});

test("createTask: 主席发布新主任务", () => {
  const r = createTask([task], [], { id: 10, title: "新任务", department: "运维部", person: "周子轩", status: "待开始" }, chair);
  assert.equal(r.ok, true);
  assert.equal(r.tasks.length, 2);
  assert.equal(r.tasks[1].id, 10);
  assert.equal(r.tasks[1].status, "待开始");
  assert.equal(r.event.action, "create");
  assert.equal(r.notifications[0].title, "主席交办新任务");
});

test("createTask: 非主席被拒绝", () => {
  const r = createTask([task], [], { id: 11, title: "x", department: "运维部", person: "周子轩", status: "待开始" }, deptLeader);
  assert.equal(r.ok, false);
  assert.equal(r.status, 403);
});
