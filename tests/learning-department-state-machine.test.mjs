import { test } from "node:test";
import assert from "node:assert/strict";
import { isLearningMember, isMediaMember, whiteCardTransition } from "../app/learning-department/state-machine.ts";

test("白卡主流程可从提交推进到归档", () => {
  assert.equal(whiteCardTransition("待新媒体领取", "claim"), "新媒体制作中");
  assert.equal(whiteCardTransition("新媒体制作中", "submitReview"), "待主席审核");
  assert.equal(whiteCardTransition("待主席审核", "approve"), "已通过归档");
});

test("白卡支持两类退回和学习部重新提交", () => {
  assert.equal(whiteCardTransition("待主席审核", "returnMedia"), "新媒体制作中");
  assert.equal(whiteCardTransition("待主席审核", "returnLearning"), "待学习部修改");
  assert.equal(whiteCardTransition("待学习部修改", "resubmit"), "待新媒体领取");
});

test("白卡仅能在领取前撤回且非法转换被拒绝", () => {
  assert.equal(whiteCardTransition("待新媒体领取", "withdraw"), "已撤回");
  assert.throws(() => whiteCardTransition("新媒体制作中", "withdraw"), /不能执行/);
  assert.throws(() => whiteCardTransition("已通过归档", "resubmit"), /不能执行/);
});

test("白卡部门身份判断准确", () => {
  assert.equal(isLearningMember({ role: "staff", department: "学习部" }), true);
  assert.equal(isMediaMember({ role: "leader", department: "新媒体中心" }), true);
  assert.equal(isLearningMember({ role: "staff", department: "科创中心" }), false);
  assert.equal(isMediaMember({ role: "admin", department: "系统管理" }), true);
});
