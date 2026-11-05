import { toUnifiedWorkStatus } from "./status.ts";

type TaskLike = { id: number; activityId?: unknown; status?: unknown };
type SubtaskLike = { id?: unknown; parentTaskId?: unknown; status?: unknown };
type ServiceLike = { activityId?: unknown; status?: unknown; statusGroup?: unknown };

export type ActivityExecutionProgress = {
  progress: number;
  leafCount: number;
  completedLeafCount: number;
  pending: number;
};

function normalizeStatusGroup(status: unknown) {
  const raw = String(status || "");
  return ["pending", "in_progress", "waiting", "review", "done", "canceled", "unknown"].includes(raw)
    ? raw
    : toUnifiedWorkStatus(raw);
}

export function workProgressScore(status: unknown) {
  const group = normalizeStatusGroup(status);
  if (group === "done") return 100;
  if (group === "in_progress") return 50;
  return 0;
}

export function calculateActivityExecutionProgress(
  tasks: readonly TaskLike[],
  subtasks: readonly SubtaskLike[],
  activityId: string,
  services: readonly ServiceLike[] = [],
): ActivityExecutionProgress {
  const activityTasks = tasks.filter((task) => String(task.activityId || "") === activityId);
  const leaves: { status?: unknown }[] = [];

  for (const task of activityTasks) {
    const children = subtasks.filter((subtask) => Number(subtask.parentTaskId) === task.id);
    const activeChildren = children.filter((subtask) => toUnifiedWorkStatus(String(subtask.status || "")) !== "canceled");
    if (activeChildren.length) leaves.push(...activeChildren);
    else leaves.push(task);
  }
  for (const service of services) {
    if (String(service.activityId || "") !== activityId) continue;
    const status = service.statusGroup || service.status;
    if (normalizeStatusGroup(status) !== "canceled") leaves.push({ status });
  }

  const completedLeafCount = leaves.filter((item) => normalizeStatusGroup(item.status) === "done").length;
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
  services: readonly ServiceLike[] = [],
): Array<T & ActivityExecutionProgress> {
  return activities.map((activity) => ({
    ...activity,
    ...calculateActivityExecutionProgress(tasks, subtasks, activity.id, services),
  }));
}

