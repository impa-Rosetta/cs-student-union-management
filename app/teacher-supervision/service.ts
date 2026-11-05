import type {
  ActivitySupervisionDetail,
  ActivitySupervisionSummary,
  SupervisionEvent,
  SupervisionNode,
  SupervisionOverview,
  SupervisionScheduleState,
} from "./types.ts";
import { workProgressScore } from "../work-management/activity-progress.ts";
import { toUnifiedWorkStatus } from "../work-management/status.ts";

type Entity = Record<string, unknown>;
type ActivityLike = Entity & { id: string; name: string };
type TaskLike = Entity & { id: number };
type SubtaskLike = Entity & { id: string };
type WorkflowEventLike = Entity & {
  id: number;
  entity_type: string;
  entity_id: string;
  action: string;
  from_status: string;
  to_status: string;
  actor_name: string;
  actor_role: string;
  reason: string | null;
  created_at: string;
};

const doneStatuses = new Set(["已完成", "已归档", "已结束"]);
const inactiveActivityStatuses = new Set(["已归档", "已结束", "已取消"]);

function text(value: unknown): string {
  return value == null ? "" : String(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function dateMs(value: string): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isDone(status: unknown): boolean {
  return toUnifiedWorkStatus(text(status)) === "done";
}

function taskBelongsToActivity(task: TaskLike, activity: ActivityLike, allActivities: ActivityLike[]): boolean {
  const activityId = text(task.activityId);
  if (activityId) return activityId === activity.id;
  const activityName = text(task.activityName);
  if (!activityName || activityName !== activity.name) return false;
  return allActivities.filter((item) => item.name === activityName).length === 1;
}

function subtaskBelongsToTask(subtask: SubtaskLike, task: TaskLike): boolean {
  if (subtask.parentTaskId != null) return Number(subtask.parentTaskId) === task.id;
  return text(subtask.parent) === text(task.title);
}

function scheduleState(entity: Entity, now: Date): SupervisionScheduleState {
  if (isDone(entity.status)) return "done";
  if (entity.risk) return "risk";
  const end = text(entity.plannedEndAt || entity.planned_end_at);
  const endMs = dateMs(end);
  if (endMs == null) return "unscheduled";
  const difference = endMs - now.getTime();
  if (difference < 0) return "overdue";
  if (difference <= 7 * 24 * 60 * 60 * 1000) return "due-soon";
  return text(entity.status) === "待开始" ? "not-started" : "active";
}

function nodeDates(entity: Entity): { start: string; end: string } {
  return {
    start: text(entity.plannedStartAt || entity.planned_start_at),
    end: text(entity.plannedEndAt || entity.planned_end_at),
  };
}

function rangeFromNodes(nodes: SupervisionNode[]): { start: string; end: string } {
  const flattened = nodes.flatMap((node) => [node, ...node.children]);
  const starts = flattened.map((node) => node.start).filter((value) => dateMs(value) != null).sort((a, b) => (dateMs(a) || 0) - (dateMs(b) || 0));
  const ends = flattened.map((node) => node.end).filter((value) => dateMs(value) != null).sort((a, b) => (dateMs(a) || 0) - (dateMs(b) || 0));
  return { start: starts[0] || "", end: ends.at(-1) || "" };
}

function makeSubtaskNode(subtask: SubtaskLike, department: string, now: Date): SupervisionNode {
  const dates = nodeDates(subtask);
  return {
    id: subtask.id,
    entityType: "subtask",
    title: text(subtask.title),
    department,
    assignee: text(subtask.assignee),
    status: text(subtask.status),
    description: text(subtask.evidence),
    start: dates.start,
    end: dates.end,
    deadline: text(subtask.deadline),
    progress: workProgressScore(subtask.status),
    scheduleState: scheduleState(subtask, now),
    attachments: Array.isArray(subtask.attachments) ? subtask.attachments as SupervisionNode["attachments"] : [],
    completionNote: text(subtask.completionNote),
    children: [],
  };
}

function makeTaskNode(task: TaskLike, children: SupervisionNode[], now: Date): SupervisionNode {
  const ownDates = nodeDates(task);
  const childRange = rangeFromNodes(children);
  const progress = children.length
    ? Math.round(children.filter((child) => child.progress === 100).length / children.length * 100)
    : workProgressScore(task.status);
  return {
    id: task.id,
    entityType: "task",
    title: text(task.title),
    department: text(task.department),
    assignee: text(task.person),
    status: text(task.status),
    description: text(task.description),
    start: ownDates.start || childRange.start,
    end: ownDates.end || childRange.end,
    deadline: text(task.deadline),
    progress,
    scheduleState: scheduleState(task, now),
    attachments: Array.isArray(task.attachments) ? task.attachments as SupervisionNode["attachments"] : [],
    completionNote: text(task.lastAction),
    children,
  };
}

function leafNodes(nodes: SupervisionNode[]): SupervisionNode[] {
  return nodes.flatMap((node) => node.children.length ? node.children : [node]);
}

function summarize(nodes: SupervisionNode[]): ActivitySupervisionSummary {
  const leaves = leafNodes(nodes);
  const completedLeafCount = leaves.filter((node) => node.progress === 100).length;
  return {
    taskCount: nodes.length,
    subtaskCount: nodes.reduce((sum, node) => sum + node.children.length, 0),
    leafCount: leaves.length,
    completedLeafCount,
    progress: leaves.length ? Math.round(leaves.reduce((sum, node) => sum + node.progress, 0) / leaves.length) : 0,
    overdueCount: leaves.filter((node) => node.scheduleState === "overdue").length,
    dueSoonCount: leaves.filter((node) => node.scheduleState === "due-soon").length,
    unscheduledCount: leaves.filter((node) => node.scheduleState === "unscheduled").length,
  };
}

const actionLabels: Record<string, string> = {
  create: "创建",
  start: "开始执行",
  submit: "提交审核",
  withdraw: "撤回提交",
  approve: "审核通过",
  reject: "退回修改",
  completeDirect: "直接办结",
  reopen: "重新打开",
  addAttachment: "添加附件",
  removeAttachment: "删除附件",
  archive: "归档",
};

function filterEvents(activity: ActivityLike, nodes: SupervisionNode[], events: WorkflowEventLike[]): SupervisionEvent[] {
  const taskTitles = new Map(nodes.map((node) => [String(node.id), node.title]));
  const subtaskTitles = new Map(nodes.flatMap((node) => node.children.map((child) => [String(child.id), child.title] as const)));
  return events
    .filter((event) => (
      (event.entity_type === "activity" && event.entity_id === activity.id)
      || (event.entity_type === "task" && taskTitles.has(event.entity_id))
      || (event.entity_type === "subtask" && subtaskTitles.has(event.entity_id))
    ))
    .map((event) => ({
      id: event.id,
      entityType: event.entity_type,
      entityId: event.entity_id,
      entityTitle: event.entity_type === "activity" ? activity.name : taskTitles.get(event.entity_id) || subtaskTitles.get(event.entity_id) || "相关事项",
      action: event.action,
      actionLabel: actionLabels[event.action] || event.action,
      fromStatus: event.from_status,
      toStatus: event.to_status,
      actorName: event.actor_name,
      actorRole: event.actor_role,
      reason: event.reason || "",
      createdAt: event.created_at,
    }))
    .sort((a, b) => (dateMs(b.createdAt) || b.id) - (dateMs(a.createdAt) || a.id));
}

export function buildActivitySupervision(
  activity: ActivityLike,
  allActivities: ActivityLike[],
  tasks: TaskLike[],
  subtasks: SubtaskLike[],
  events: WorkflowEventLike[],
  now = new Date(),
): ActivitySupervisionDetail {
  const activityTasks = tasks.filter((task) => taskBelongsToActivity(task, activity, allActivities));
  const nodes = activityTasks.map((task) => {
    const children = subtasks
      .filter((subtask) => subtaskBelongsToTask(subtask, task) && toUnifiedWorkStatus(text(subtask.status)) !== "canceled")
      .map((subtask) => makeSubtaskNode(subtask, text(task.department), now));
    return makeTaskNode(task, children, now);
  });
  return {
    activity,
    summary: summarize(nodes),
    range: rangeFromNodes(nodes),
    tasks: nodes,
    events: filterEvents(activity, nodes, events),
  };
}

export function buildSupervisionOverview(
  activities: ActivityLike[],
  tasks: TaskLike[],
  subtasks: SubtaskLike[],
  events: WorkflowEventLike[],
  now = new Date(),
): SupervisionOverview {
  const details = activities.map((activity) => buildActivitySupervision(activity, activities, tasks, subtasks, events, now));
  const cards = details.map((detail) => {
    const futureEnds = leafNodes(detail.tasks).map((node) => node.end).filter((value) => {
      const parsed = dateMs(value);
      return parsed != null && parsed >= now.getTime() && !doneStatuses.has(nodeStatusForEnd(detail.tasks, value));
    }).sort((a, b) => (dateMs(a) || 0) - (dateMs(b) || 0));
    return {
      id: detail.activity.id,
      name: detail.activity.name,
      category: text(detail.activity.category),
      state: text(detail.activity.state),
      date: text(detail.activity.date),
      time: text(detail.activity.time),
      location: text(detail.activity.location),
      organizer: text(detail.activity.organizer),
      departments: stringArray(detail.activity.departments),
      progress: detail.summary.progress,
      taskCount: detail.summary.taskCount,
      completedLeafCount: detail.summary.completedLeafCount,
      leafCount: detail.summary.leafCount,
      overdueCount: detail.summary.overdueCount,
      dueSoonCount: detail.summary.dueSoonCount,
      unscheduledCount: detail.summary.unscheduledCount,
      nextDeadline: futureEnds[0] || "",
    };
  }).sort((a, b) => b.overdueCount - a.overdueCount || (dateMs(a.nextDeadline) || Number.MAX_SAFE_INTEGER) - (dateMs(b.nextDeadline) || Number.MAX_SAFE_INTEGER));
  return {
    stats: {
      activityCount: cards.length,
      activeActivityCount: cards.filter((card) => !inactiveActivityStatuses.has(card.state)).length,
      overdueTaskCount: cards.reduce((sum, card) => sum + card.overdueCount, 0),
      dueSoonTaskCount: cards.reduce((sum, card) => sum + card.dueSoonCount, 0),
    },
    departments: [...new Set(cards.flatMap((card) => card.departments))].sort((a, b) => a.localeCompare(b, "zh-CN")),
    activities: cards,
  };
}

function nodeStatusForEnd(nodes: SupervisionNode[], end: string): string {
  const node = nodes.flatMap((item) => item.children.length ? item.children : [item]).find((item) => item.end === end);
  return node?.status || "";
}
