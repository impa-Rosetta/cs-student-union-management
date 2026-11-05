import test from "node:test";
import assert from "node:assert/strict";
import { applyCalculatedActivityProgress, calculateActivityExecutionProgress } from "../app/work-management/activity-progress.ts";

const tasks = [
  { id: 1, activityId: "a1", status: "已完成" },
  { id: 2, activityId: "a1", status: "已完成" },
  { id: 3, activityId: "a1", status: "进行中" },
  { id: 4, activityId: "a2", status: "已完成" },
];

const subtasks = [
  { id: "s1", parentTaskId: 2, status: "已完成" },
  { id: "s2", parentTaskId: 2, status: "进行中" },
  { id: "s3", parentTaskId: 2, status: "已取消" },
];

test("calculates progress from leaf execution items without double-counting parents", () => {
  assert.deepEqual(calculateActivityExecutionProgress(tasks, subtasks, "a1"), {
    progress: 75,
    leafCount: 4,
    completedLeafCount: 2,
    pending: 2,
  });
});

test("overrides manual activity progress with calculated execution progress", () => {
  const [activity] = applyCalculatedActivityProgress([{ id: "a1", progress: 99, pending: 9 }], tasks, subtasks);
  assert.equal(activity.progress, 75);
  assert.equal(activity.pending, 2);
  assert.equal(activity.leafCount, 4);
});

test("includes linked department services but excludes services from other activities", () => {
  const result = calculateActivityExecutionProgress(tasks, subtasks, "a1", [
    { activityId: "a1", statusGroup: "done" },
    { activityId: "a2", statusGroup: "done" },
  ]);
  assert.deepEqual(result, { progress: 80, leafCount: 5, completedLeafCount: 3, pending: 2 });
});

