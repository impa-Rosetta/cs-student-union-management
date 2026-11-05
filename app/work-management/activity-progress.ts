import { toUnifiedWorkStatus } from "./status.ts";

type TaskLike = { id: number; activityId?: unknown; status?: unknown };
type SubtaskLike = { id?: unknown; parentTaskId?: unknown; status?: unknown };

export type ActivityExecutionProgress = {
  progress: number;
  leafCount: number;
  completedLeafCount: number;
  pending: number;
};

export function workProgressScore(status: unknown) {
  const group = toUnifiedWorkStatus(String(status || ""));
  if (group === "done") return 100;
  if (group === "in_progress") return 50;
  return 0;
}

export function calculateActivityExecutionProgress(
  tasks: readonly TaskLike[],
  subtasks: readonly SubtaskLike[],
  activityId: string,
): ActivityExecutionProgress {
  const activityTasks = tasks.filter((task) => String(task.activityId || "") === activityId);
  const leaves: { status?: unknown }[] = [];

  for (const task of activityTasks) {
    const children = subtasks.filter((subtask) => Number(subtask.parentTaskId) === task.id);
    const activeChildren = children.filter((subtask) => toUnifiedWorkStatus(String(subtask.status || "")) !== "canceled");
    if (activeChildren.length) leaves.push(...activeChildren);
    else leaves.push(task);
  }

  const completedLeafCount = leaves.filter((item) => toUnifiedWorkStatus(String(item.status || "")) === "done").length;
  const totalScore = leaves.reduce((sum, item) => sum + workProgressScore(item.status), 0);
  return {
    progress: leaves.length ? Math.round(totalScore / leaves.length) : 0,
    leafCount: leaves.length,
    completedLeafCount,
    pending: leaves.length - completedLeafCount,
  };
}

export function applyCalculatedActivityProgress<T extends { id: string }>(
  activities: readonly T[],
  tasks: readonly TaskLike[],
  subtasks: readonly SubtaskLike[],
): Array<T & ActivityExecutionProgress> {
  return activities.map((activity) => ({
    ...activity,
    ...calculateActivityExecutionProgress(tasks, subtasks, activity.id),
  }));
}

