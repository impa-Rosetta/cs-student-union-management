import test from "node:test";
import assert from "node:assert/strict";
import { applySubtaskAction } from "../app/workflow/apply-subtask-action.ts";
import { resolveNotification } from "../app/workflow/notifications.ts";

const task = { id: 3, title: "灯光控制方案与彩排", department: "运维部", person: "周子轩", status: "待开始" };
const subtask = { id: "sub-1", parentTaskId: 3, title: "核对灯光控台接口", assignee: "周子轩", status: "待开始" };

const staffAssignee = { role: "staff", name: "周子轩", department: "运维部" };
const otherStaff = { role: "staff", name: "王辰", department: "运维部" };
const deptLeader = { role: "leader", name: "陈雨桐", department: "运维部" };
const otherLeader = { role: "leader", name: "林浩然", department: "PC部" };
const chair = { role: "chair", name: "徐介翰", department: "主席团" };
const teacher = { role: "teacher", name: "王明远", department: "计算学院" };
const admin = { role: "admin", name: "系统管理员", department: "系统管理" };

function apply(tasks, subtasks, action, actor, payload) {
  return applySubtaskAction(tasks, subtasks, "sub-1", action, actor, payload);
}

test("start: 干事开始子任务，主任务自动转进行中", () => {
  const r = apply([task], [subtask], "start", staffAssignee);
  assert.equal(r.ok, true);
  assert.equal(r.subtasks[0].status, "进行中");
  assert.equal(r.tasks[0].status, "进行中");
  assert.equal(r.notifications.length, 1);
  assert.deepEqual(r.notifications[0].recipientRoles, ["leader"]);
  assert.equal(r.notifications[0].recipientDepartment, "运维部");
});

test("submit: 提交验收并写入完成说明，通知负责人", () => {
  const r = apply([{ ...task, status: "进行中" }], [{ ...subtask, status: "进行中" }], "submit", staffAssignee, { note: "已完成，附照片" });
  assert.equal(r.ok, true);
  assert.equal(r.subtasks[0].status, "待验收");
  assert.equal(r.subtasks[0].completionNote, "已完成，附照片");
  assert.equal(r.notifications[0].title, "子任务等待验收");
});

test("withdraw: 已提交可撤回", () => {
  const awaiting = [{ ...task, status: "进行中" }, { ...subtask, status: "待验收" }];
  const r = apply(awaiting, [awaiting[1]], "withdraw", staffAssignee);
  assert.equal(r.ok, true);
  assert.equal(r.subtasks[0].status, "进行中");
});

test("approve/reject: 负责人验收与退回", () => {
  const awaiting = [{ ...task, status: "进行中" }, { ...subtask, status: "待验收" }];
  const approved = apply(awaiting, [awaiting[1]], "approve", deptLeader);
  assert.equal(approved.ok, true);
  assert.equal(approved.subtasks[0].status, "已完成");
  assert.deepEqual(approved.notifications[0].recipientNames, ["周子轩"]);

  const rejected = apply(awaiting, [awaiting[1]], "reject", deptLeader, { reason: "照片不清晰" });
  assert.equal(rejected.ok, true);
  assert.equal(rejected.subtasks[0].status, "需修改");
  assert.equal(rejected.subtasks[0].lastAction.includes("照片不清晰"), true);
});

test("completeDirect/cancel: 负责人直接办结与撤销", () => {
  const pending = [task, subtask];
  assert.equal(apply(pending, [subtask], "completeDirect", deptLeader).subtasks[0].status, "已完成");
  assert.equal(apply(pending, [subtask], "completeDirect", chair).subtasks[0].status, "已完成");

  const cancelled = apply(pending, [subtask], "cancel", deptLeader, { reason: "任务重复" });
  assert.equal(cancelled.ok, true);
  assert.equal(cancelled.subtasks.length, 1, "已取消的子任务应保留记录而非删除");
  assert.equal(cancelled.subtasks[0].status, "已取消");
  assert.equal(cancelled.tasks[0].status, "待开始", "仅已取消不驱动主任务进行中");
});

test("addAttachment: 上传凭据自动开始待开始子任务", () => {
  const r = apply([task], [subtask], "addAttachment", staffAssignee, {
    attachment: { key: "k1", name: "照片.png", size: 1024 },
  });
  assert.equal(r.ok, true);
  assert.equal(r.subtasks[0].attachments.length, 1);
  assert.equal(r.subtasks[0].status, "进行中");
});

test("removeAttachment: 只有执行人本人可删除凭据", () => {
  const withFile = [{ ...task, status: "进行中" }, { ...subtask, status: "进行中", attachments: [{ key: "k1", name: "a.png", size: 1 }] }];
  assert.equal(apply(withFile, [withFile[1]], "removeAttachment", otherStaff, { key: "k1" }).ok, false);
  const r = apply(withFile, [withFile[1]], "removeAttachment", staffAssignee, { key: "k1" });
  assert.equal(r.ok, true);
  assert.equal(r.subtasks[0].attachments.length, 0);
});

test("越权被拒绝", () => {
  assert.equal(apply([task], [subtask], "start", otherStaff).ok, false);
  assert.equal(apply([task], [{ ...subtask, status: "待验收" }], "approve", otherLeader).ok, false);
  assert.equal(apply([task], [{ ...subtask, status: "待验收" }], "approve", teacher).ok, false);
  assert.equal(apply([task], [{ ...subtask, status: "待验收" }], "approve", admin).ok, false);
  assert.equal(apply([task], [{ ...subtask, status: "待验收" }], "approve", staffAssignee).ok, false);
});

test("通知解析：按角色+部门与姓名解析、过滤停用与本人", () => {
  const accounts = [
    { username: "leader", name: "陈雨桐", role: "leader", department: "运维部", active: true },
    { username: "staff", name: "周子轩", role: "staff", department: "运维部", active: true },
    { username: "other-leader", name: "林浩然", role: "leader", department: "PC部", active: true },
    { username: "inactive", name: "离职人", role: "leader", department: "运维部", active: false },
  ];
  const byDept = resolveNotification(
    { recipientRoles: ["leader"], recipientDepartment: "运维部", title: "t", detail: "d", level: "info", entity: { type: "subtask", id: "x" } },
    accounts,
    "someone-else",
  );
  assert.deepEqual(byDept.recipientUsernames, ["leader"]);

  const byName = resolveNotification(
    { recipientNames: ["周子轩"], title: "t", detail: "d", level: "success", entity: { type: "subtask", id: "x" } },
    accounts,
    "leader",
  );
  assert.deepEqual(byName.recipientUsernames, ["staff"]);

  const selfFiltered = resolveNotification(
    { recipientNames: ["周子轩"], title: "t", detail: "d", level: "success", entity: { type: "subtask", id: "x" } },
    accounts,
    "staff",
  );
  assert.equal(selfFiltered, null);
});
