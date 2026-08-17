import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateMainTaskStatus,
  canSubmitMainTask,
  subtaskTransition,
  taskTransition,
} from "../app/workflow/state-machine.ts";

const staffAssignee = { role: "staff", isAssignee: true, isDepartmentLeader: false };
const leaderAssignee = { role: "leader", isAssignee: true, isDepartmentLeader: false };
const deptLeader = { role: "leader", isAssignee: false, isDepartmentLeader: true };
const chair = { role: "chair", isAssignee: false, isDepartmentLeader: false };
const otherLeader = { role: "leader", isAssignee: false, isDepartmentLeader: false };
const otherStaff = { role: "staff", isAssignee: false, isDepartmentLeader: false };
const teacher = { role: "teacher", isAssignee: false, isDepartmentLeader: false };
const admin = { role: "admin", isAssignee: false, isDepartmentLeader: false };

test("subtask: 干事完成一轮 开始→提交→通过", () => {
  const started = subtaskTransition("待开始", "start", staffAssignee);
  assert.deepEqual(started, { ok: true, next: "进行中" });

  const submitted = subtaskTransition(started.next, "submit", staffAssignee);
  assert.deepEqual(submitted, { ok: true, next: "待验收" });

  const approved = subtaskTransition(submitted.next, "approve", deptLeader);
  assert.deepEqual(approved, { ok: true, next: "已完成" });
});

test("subtask: 退回后修改并重新提交", () => {
  const rejected = subtaskTransition("待验收", "reject", deptLeader);
  assert.deepEqual(rejected, { ok: true, next: "需修改" });

  const resubmitted = subtaskTransition(rejected.next, "submit", staffAssignee);
  assert.deepEqual(resubmitted, { ok: true, next: "待验收" });
});

test("subtask: 已提交未审核可撤回", () => {
  assert.deepEqual(subtaskTransition("待验收", "withdraw", staffAssignee), {
    ok: true,
    next: "进行中",
  });
});

test("subtask: 负责人直接办结与撤销", () => {
  assert.deepEqual(subtaskTransition("待开始", "completeDirect", deptLeader), {
    ok: true,
    next: "已完成",
  });
  assert.deepEqual(subtaskTransition("进行中", "completeDirect", chair), {
    ok: true,
    next: "已完成",
  });
  assert.deepEqual(subtaskTransition("待开始", "cancel", deptLeader), {
    ok: true,
    next: "已取消",
  });
  assert.deepEqual(subtaskTransition("需修改", "cancel", deptLeader), {
    ok: true,
    next: "已取消",
  });
});

test("subtask: 重新打开已完成子任务", () => {
  assert.deepEqual(subtaskTransition("已完成", "reopen", deptLeader), {
    ok: true,
    next: "进行中",
  });
});

test("subtask: 越权与非法流转被拒绝", () => {
  // 干事不能验收自己或其他人的子任务
  assert.equal(subtaskTransition("待验收", "approve", staffAssignee).ok, false);
  assert.equal(subtaskTransition("待验收", "approve", otherStaff).ok, false);
  // 非本部门负责人不能验收
  assert.equal(subtaskTransition("待验收", "approve", otherLeader).ok, false);
  // 教师与管理员不能做业务操作
  assert.equal(subtaskTransition("待验收", "approve", teacher).ok, false);
  assert.equal(subtaskTransition("待验收", "approve", admin).ok, false);
  // 状态不匹配
  assert.equal(subtaskTransition("待开始", "submit", staffAssignee).ok, false);
  assert.equal(subtaskTransition("进行中", "approve", deptLeader).ok, false);
  assert.equal(subtaskTransition("已完成", "cancel", deptLeader).ok, false);
  assert.equal(subtaskTransition("已取消", "start", staffAssignee).ok, false);
});

test("main task: 负责人提交、主席终审", () => {
  // 部门主任务由主席标记开始，或由子任务开始后聚合驱动，负责人本身不「开始」主任务
  assert.equal(taskTransition("待开始", "start", deptLeader).ok, false);
  assert.deepEqual(taskTransition("待开始", "start", chair), {
    ok: true,
    next: "进行中",
  });
  assert.deepEqual(taskTransition("进行中", "submit", deptLeader), {
    ok: true,
    next: "待验收",
  });
  assert.deepEqual(taskTransition("待验收", "approve", chair), {
    ok: true,
    next: "已完成",
  });
});

test("main task: 被直接交办的执行人可开始与提交", () => {
  assert.deepEqual(taskTransition("待开始", "start", leaderAssignee), {
    ok: true,
    next: "进行中",
  });
  assert.deepEqual(taskTransition("进行中", "submit", staffAssignee), {
    ok: true,
    next: "待验收",
  });
});

test("main task: 退回与重新打开", () => {
  assert.deepEqual(taskTransition("待验收", "reject", chair), {
    ok: true,
    next: "进行中",
  });
  assert.deepEqual(taskTransition("已完成", "reopen", chair), {
    ok: true,
    next: "进行中",
  });
});

test("main task: 快捷办结允许执行人直接办结，其余模式不允许", () => {
  assert.deepEqual(
    taskTransition("进行中", "completeDirect", staffAssignee, "快捷办结"),
    { ok: true, next: "已完成" },
  );
  assert.equal(
    taskTransition("进行中", "completeDirect", staffAssignee, "负责人确认").ok,
    false,
  );
  assert.equal(
    taskTransition("进行中", "completeDirect", staffAssignee, "凭据留痕").ok,
    false,
  );
  assert.equal(taskTransition("进行中", "completeDirect", staffAssignee).ok, false);
});

test("main task: 越权被拒绝", () => {
  assert.equal(taskTransition("待验收", "approve", deptLeader).ok, false);
  assert.equal(taskTransition("待验收", "approve", staffAssignee).ok, false);
  assert.equal(taskTransition("进行中", "submit", chair).ok, false);
  assert.equal(taskTransition("已完成", "reopen", deptLeader).ok, false);
  assert.equal(taskTransition("待开始", "completeDirect", admin).ok, false);
});

test("父子聚合：任一子任务开始后主任务转为进行中", () => {
  assert.equal(aggregateMainTaskStatus("待开始", ["待开始", "待开始"]), "待开始");
  assert.equal(aggregateMainTaskStatus("待开始", ["进行中"]), "进行中");
  assert.equal(aggregateMainTaskStatus("待开始", ["已取消"]), "待开始");
  assert.equal(aggregateMainTaskStatus("待验收", ["进行中"]), "待验收");
  assert.equal(aggregateMainTaskStatus("已完成", ["进行中"]), "已完成");
});

test("提交结办：所有未取消子任务必须完成", () => {
  assert.equal(canSubmitMainTask("进行中", ["已完成", "已完成"]), true);
  assert.equal(canSubmitMainTask("进行中", ["已完成", "已取消"]), true);
  assert.equal(canSubmitMainTask("进行中", []), true);
  assert.equal(canSubmitMainTask("进行中", ["进行中"]), false);
  assert.equal(canSubmitMainTask("进行中", ["需修改"]), false);
  assert.equal(canSubmitMainTask("待开始", []), false);
});
