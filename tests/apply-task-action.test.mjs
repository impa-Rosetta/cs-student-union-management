import test from "node:test";
import assert from "node:assert/strict";
import { applyTaskAction } from "../app/workflow/apply-task-action.ts";
import { createSubtask } from "../app/workflow/apply-subtask-action.ts";

const task = { id: 1, title: "舞台音响设备确认", department: "运维部", person: "陈雨桐", status: "进行中" };

const deptLeader = { role: "leader", name: "陈雨桐", department: "运维部" };
const otherLeader = { role: "leader", name: "林浩然", department: "PC部" };
const chair = { role: "chair", name: "徐介翰", department: "主席团" };
const staffAssignee = { role: "staff", name: "周子轩", department: "运维部" };
const teacher = { role: "teacher", name: "王明远", department: "计算学院" };
const admin = { role: "admin", name: "系统管理员", department: "系统管理" };

test("task submit: 负责人提交结办，通知主席", () => {
  const r = applyTaskAction([task], [], 1, "submit", deptLeader);
  assert.equal(r.ok, true);
  assert.equal(r.tasks[0].status, "待验收");
  assert.deepEqual(r.notifications[0].recipientRoles, ["chair"]);
});

test("task submit: 有未完成子任务时拒绝", () => {
  const subtasks = [{ id: "s1", parentTaskId: 1, title: "a", assignee: "周子轩", status: "进行中" }];
  const r = applyTaskAction([task], subtasks, 1, "submit", deptLeader);
  assert.equal(r.ok, false);
  assert.equal(r.status, 409);
});

test("task submit: 子任务全部完成或已取消后可提交", () => {
  const subtasks = [
    { id: "s1", parentTaskId: 1, title: "a", assignee: "周子轩", status: "已完成" },
    { id: "s2", parentTaskId: 1, title: "b", assignee: "王辰", status: "已取消" },
  ];
  assert.equal(applyTaskAction([task], subtasks, 1, "submit", deptLeader).ok, true);
});

test("task approve/reject: 主席终审", () => {
  const awaiting = [{ ...task, status: "待验收" }];
  const approved = applyTaskAction(awaiting, [], 1, "approve", chair);
  assert.equal(approved.ok, true);
  assert.equal(approved.tasks[0].status, "已完成");
  assert.equal(approved.notifications[0].title, "主任务审核通过");

  const rejected = applyTaskAction(awaiting, [], 1, "reject", chair, { reason: "凭据不足" });
  assert.equal(rejected.ok, true);
  assert.equal(rejected.tasks[0].status, "进行中");
  assert.equal(rejected.notifications[0].detail.includes("凭据不足"), true);
});

test("task completeDirect/reopen: 主席直接办结与重新打开", () => {
  assert.equal(applyTaskAction([task], [], 1, "completeDirect", chair).tasks[0].status, "已完成");
  assert.equal(applyTaskAction([{ ...task, status: "已完成" }], [], 1, "reopen", chair).tasks[0].status, "进行中");
});

test("task: 直接执行人可开始/提交", () => {
  const pending = { ...task, status: "待开始" };
  assert.equal(applyTaskAction([pending], [], 1, "start", deptLeader).ok, true);
  assert.equal(applyTaskAction([task], [], 1, "submit", deptLeader).ok, true);
});

test("task: 快捷办结允许执行人直接办结", () => {
  const executorTask = { ...task, person: "周子轩", status: "进行中", controlMode: "快捷办结" };
  assert.equal(applyTaskAction([executorTask], [], 1, "completeDirect", staffAssignee).ok, true);
  const nonQuickExecutorTask = { ...task, person: "周子轩", status: "进行中" };
  assert.equal(applyTaskAction([nonQuickExecutorTask], [], 1, "completeDirect", staffAssignee).ok, false);
});

test("task: 越权被拒绝", () => {
  assert.equal(applyTaskAction([{ ...task, status: "待验收" }], [], 1, "approve", deptLeader).ok, false);
  assert.equal(applyTaskAction([task], [], 1, "submit", otherLeader).ok, false);
  assert.equal(applyTaskAction([task], [], 1, "submit", teacher).ok, false);
  assert.equal(applyTaskAction([{ ...task, status: "待验收" }], [], 1, "approve", admin).ok, false);
});

test("createSubtask: 负责人拆解分派", () => {
  const r = createSubtask([task], [], 1, deptLeader, { title: "核对设备清单", assignee: "周子轩" });
  assert.equal(r.ok, true);
  assert.equal(r.subtasks.length, 1);
  assert.equal(r.subtasks[0].status, "待开始");
  assert.equal(r.subtasks[0].assignee, "周子轩");
  assert.equal(r.notifications[0].title, "收到新的执行任务");
});

test("createSubtask: 主席可拆解，跨部门负责人与干事被拒", () => {
  assert.equal(createSubtask([task], [], 1, chair, { title: "x", assignee: "周子轩" }).ok, true);
  assert.equal(createSubtask([task], [], 1, otherLeader, { title: "x", assignee: "周子轩" }).ok, false);
  assert.equal(createSubtask([task], [], 1, staffAssignee, { title: "x", assignee: "周子轩" }).ok, false);
  assert.equal(createSubtask([task], [], 1, deptLeader, { title: "", assignee: "周子轩" }).ok, false);
});

test("task 附件增删：主席与负责人可操作，跨部门/干事被拒", () => {
  const added = applyTaskAction([task], [], 1, "addAttachment", deptLeader, { attachment: { key: "k2", name: "b.png", size: 2 } });
  assert.equal(added.ok, true);
  assert.equal(added.tasks[0].attachments.length, 1);
  assert.equal(added.notifications[0].title, "任务新增参考附件");

  const withFile = { ...task, attachments: [{ key: "k1", name: "a.png", size: 1 }] };
  const removed = applyTaskAction([withFile], [], 1, "removeAttachment", chair, { key: "k1" });
  assert.equal(removed.ok, true);
  assert.equal(removed.tasks[0].attachments.length, 0);

  assert.equal(applyTaskAction([task], [], 1, "addAttachment", otherLeader, { attachment: { key: "k2", name: "b.png", size: 2 } }).ok, false);
  assert.equal(applyTaskAction([task], [], 1, "addAttachment", staffAssignee, { attachment: { key: "k2", name: "b.png", size: 2 } }).ok, false);
});
