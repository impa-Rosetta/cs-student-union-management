import test from "node:test";
import assert from "node:assert/strict";
import { scopeSharedState } from "../app/work-management/scope.ts";

const state = {
  tasks: [
    { id: 1, department: "办公室", person: "办事员", activityId: "a1" },
    { id: 2, department: "科创中心", person: "小科", activityId: "a1" },
    { id: 3, department: "生活部", person: "小生", activityId: "a2" },
  ],
  subtasks: [
    { id: "s1", parentTaskId: 2, assignee: "科创干事" },
    { id: "s2", parentTaskId: 3, assignee: "生活干事" },
  ],
  activities: [
    { id: "a1", name: "活动一", organizer: "办公室", departments: ["科创中心"] },
    { id: "a2", name: "活动二", organizer: "生活部", departments: [] },
  ],
  archive: [
    { owner: "科创中心", activity: "活动一" },
    { owner: "生活部", activity: "活动二" },
  ],
  notifications: [
    { id: "n1", recipientUsernames: ["science"] },
    { id: "n2", recipientUsernames: ["life"] },
  ],
};

const baseUser = { id: 1, externalUserId: "", email: "", username: "science", name: "科创负责人", role: "leader", department: "科创中心", title: "", scope: "", active: true };

test("department leader only receives department work and own notifications", () => {
  const scoped = scopeSharedState(state, baseUser);
  assert.deepEqual(scoped.tasks.map((item) => item.id), [2]);
  assert.deepEqual(scoped.subtasks.map((item) => item.id), ["s1"]);
  assert.deepEqual(scoped.activities.map((item) => item.id), ["a1"]);
  assert.deepEqual(scoped.notifications.map((item) => item.id), ["n1"]);
});

test("staff receives assigned subtasks and the required parent task", () => {
  const scoped = scopeSharedState(state, { ...baseUser, role: "staff", username: "worker", name: "科创干事" });
  assert.deepEqual(scoped.tasks.map((item) => item.id), [2]);
  assert.deepEqual(scoped.subtasks.map((item) => item.id), ["s1"]);
  assert.deepEqual(scoped.activities.map((item) => item.id), ["a1"]);
  assert.deepEqual(scoped.notifications, []);
});

test("teacher sees all business records but only personal notifications", () => {
  const scoped = scopeSharedState(state, { ...baseUser, role: "teacher", username: "teacher", department: "计算学院" });
  assert.equal(scoped.tasks.length, 3);
  assert.equal(scoped.activities.length, 2);
  assert.deepEqual(scoped.notifications, []);
});

