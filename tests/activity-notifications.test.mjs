import { test } from "node:test";
import assert from "node:assert/strict";
import { activityNotificationDrafts } from "../app/activity-workflow/notifications.ts";

const activity = {
  id: "activity-1",
  name: "迎新晚会",
  organizer: "文艺部",
  teacher: "王老师",
  departments: ["文艺部", "新媒体中心"],
};

test("活动通知：提交审批通知主席和指导教师", () => {
  const drafts = activityNotificationDrafts(activity, "submit", "待审批");
  assert.equal(drafts.length, 1);
  assert.deepEqual(drafts[0].recipientRoles, ["chair"]);
  assert.deepEqual(drafts[0].recipientNames, ["王老师"]);
  assert.equal(drafts[0].entity.type, "activity");
});

test("活动通知：批准与退回通知主办部门负责人", () => {
  for (const action of ["approve", "reject"]) {
    const drafts = activityNotificationDrafts(activity, action, action === "approve" ? "筹备中" : "草稿");
    assert.equal(drafts.length, 1);
    assert.deepEqual(drafts[0].recipientRoles, ["leader"]);
    assert.equal(drafts[0].recipientDepartment, "文艺部");
  }
});

test("活动通知：执行和归档阶段覆盖所有参与部门且去重", () => {
  const drafts = activityNotificationDrafts(activity, "archive", "已归档");
  assert.deepEqual(
    drafts.filter((draft) => draft.recipientDepartment).map((draft) => draft.recipientDepartment),
    ["文艺部", "新媒体中心"],
  );
  assert.ok(drafts.some((draft) => draft.recipientNames?.includes("王老师")));
});
