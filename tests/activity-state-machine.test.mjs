import assert from "node:assert/strict";
import test from "node:test";

import {
  activityTransition,
  normalizeActivityStage,
} from "../app/activity-workflow/state-machine.ts";

const chair = { role: "chair", isActivityLeader: false, isGuidingTeacher: false };
const leader = { role: "leader", isActivityLeader: true, isGuidingTeacher: false };
const unrelatedLeader = { role: "leader", isActivityLeader: false, isGuidingTeacher: false };
const teacher = { role: "teacher", isActivityLeader: false, isGuidingTeacher: true };

test("活动阶段：完整生命周期", () => {
  assert.deepEqual(activityTransition("草稿", "submit", leader), { ok: true, next: "待审批" });
  assert.deepEqual(activityTransition("待审批", "approve", teacher), { ok: true, next: "筹备中" });
  assert.deepEqual(activityTransition("筹备中", "start", leader), { ok: true, next: "执行中" });
  assert.deepEqual(activityTransition("执行中", "finish", leader), { ok: true, next: "总结中" });
  assert.deepEqual(activityTransition("总结中", "submitArchive", leader), { ok: true, next: "待归档" });
  assert.deepEqual(activityTransition("待归档", "archive", chair), { ok: true, next: "已归档" });
});

test("活动阶段：退回和重新打开", () => {
  assert.deepEqual(activityTransition("待审批", "reject", chair), { ok: true, next: "草稿" });
  assert.deepEqual(activityTransition("已归档", "reopen", chair), { ok: true, next: "总结中" });
});

test("活动阶段：越权和非法流转被拒绝", () => {
  assert.equal(activityTransition("草稿", "submit", unrelatedLeader).ok, false);
  assert.equal(activityTransition("待审批", "approve", leader).ok, false);
  assert.equal(activityTransition("草稿", "archive", chair).ok, false);
});

test("活动阶段：兼容旧状态但拒绝未知值", () => {
  assert.equal(normalizeActivityStage("策划中"), "草稿");
  assert.equal(normalizeActivityStage("待启动"), "待审批");
  assert.equal(normalizeActivityStage("筹备中"), "筹备中");
  assert.equal(normalizeActivityStage("已结束"), "已归档");
  assert.equal(normalizeActivityStage("随便填写"), null);
});
