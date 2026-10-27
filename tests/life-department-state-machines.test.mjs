import test from "node:test";
import assert from "node:assert/strict";
import { inspectionTransition, lostFoundTransition, purchaseTransition } from "../app/life-department/state-machines.ts";

const applicant = { role: "leader", department: "文艺部", username: "leader" };
const life = { role: "staff", department: "生活部", username: "life" };
const chair = { role: "chair", department: "主席团", username: "chair" };

test("采购完整流转", () => {
  assert.deepEqual(purchaseTransition("草稿", "submit", applicant, "leader"), { ok: true, next: "待生活部审核" });
  assert.deepEqual(purchaseTransition("待生活部审核", "approve", life, "leader"), { ok: true, next: "待采购" });
  assert.deepEqual(purchaseTransition("待采购", "purchased", life, "leader"), { ok: true, next: "已采购" });
  assert.deepEqual(purchaseTransition("已采购", "transfer", life, "leader"), { ok: true, next: "待办公室报销" });
});

test("普通成员不能处理采购", () => assert.equal(purchaseTransition("待生活部审核", "approve", applicant, "leader").ok, false));

test("查寝整改与归档流转", () => {
  assert.deepEqual(inspectionTransition("草稿", "start", life), { ok: true, next: "进行中" });
  assert.deepEqual(inspectionTransition("进行中", "rectify", life), { ok: true, next: "待整改" });
  assert.deepEqual(inspectionTransition("待整改", "recheck", life), { ok: true, next: "待复查" });
  assert.deepEqual(inspectionTransition("待复查", "archive", life), { ok: true, next: "已归档" });
  assert.deepEqual(inspectionTransition("已归档", "reopen", chair), { ok: true, next: "进行中" });
});

test("失物发布、核验、归还流转", () => {
  assert.deepEqual(lostFoundTransition("待整理", "submitPublish", life), { ok: true, next: "待新媒体发布" });
  assert.deepEqual(lostFoundTransition("待新媒体发布", "publish", life), { ok: true, next: "招领中" });
  assert.deepEqual(lostFoundTransition("招领中", "claim", life), { ok: true, next: "待核验" });
  assert.deepEqual(lostFoundTransition("待核验", "return", life), { ok: true, next: "已归还" });
});
