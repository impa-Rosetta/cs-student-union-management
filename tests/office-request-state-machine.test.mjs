import test from "node:test";
import assert from "node:assert/strict";
import { isOfficeManager, officeRequestTransition } from "../app/office-workflow/state-machine.ts";

const applicant = { role: "leader", department: "运维部", username: "leader", requesterUsername: "leader" };
const chair = { role: "chair", department: "主席团", username: "chair", requesterUsername: "leader" };
const office = { role: "staff", department: "办公室", username: "office", requesterUsername: "leader" };

test("办公室申请：申请人提交，办公室办理并完成", () => {
  assert.deepEqual(officeRequestTransition("草稿", "submit", applicant), { ok: true, next: "待办公室审核" });
  assert.deepEqual(officeRequestTransition("待办公室审核", "process", office), { ok: true, next: "外部办理中" });
  assert.deepEqual(officeRequestTransition("外部办理中", "complete", chair), { ok: true, next: "已完成" });
});

test("办公室申请：退回后申请人可以再次提交", () => {
  assert.deepEqual(officeRequestTransition("待办公室审核", "return", chair), { ok: true, next: "待补充材料" });
  assert.deepEqual(officeRequestTransition("待补充材料", "submit", applicant), { ok: true, next: "待办公室审核" });
});

test("办公室申请：普通申请人不能代替办公室受理", () => {
  const result = officeRequestTransition("待办公室审核", "process", applicant);
  assert.equal(result.ok, false);
  assert.match(result.reason, /只有办公室成员/);
  assert.equal(isOfficeManager(office), true);
});
