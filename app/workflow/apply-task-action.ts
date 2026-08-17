// 服务端主任务操作：把主任务状态转换 + 提交守卫 + 通知草稿集中到纯函数。
// 无 Worker/D1 依赖，可单元测试。

import { canSubmitMainTask, taskTransition, type Role } from "./state-machine.ts";
import type {
  WorkflowActor,
  WorkflowAttachment,
  WorkflowMutationResult,
  WorkflowNotificationDraft,
  WorkflowSubtask,
  WorkflowTask,
  WorkflowTransitionEvent,
} from "./types.ts";

export type TaskActionName =
  | "start"
  | "submit"
  | "withdraw"
  | "approve"
  | "reject"
  | "completeDirect"
  | "reopen"
  | "addAttachment"
  | "removeAttachment";

export interface TaskActionPayload {
  note?: string;
  reason?: string;
  attachment?: WorkflowAttachment;
  key?: string;
}

export type TaskActionResult =
  | {
      ok: true;
      tasks: WorkflowTask[];
      subtasks: WorkflowSubtask[];
      notifications: WorkflowNotificationDraft[];
      event: WorkflowTransitionEvent;
    }
  | { ok: false; status: number; reason: string };

function isSubtaskOfParent(subtask: WorkflowSubtask, parent: WorkflowTask): boolean {
  return subtask.parentTaskId
    ? subtask.parentTaskId === parent.id
    : subtask.parent === parent.title;
}

function lastActionText(
  action: TaskActionName,
  actorName: string,
  reason?: string,
): string {
  switch (action) {
    case "start": return `${actorName}刚刚标记开始`;
    case "submit": return `${actorName}于刚刚提交主席审核`;
    case "withdraw": return `${actorName}于刚刚撤回主席审核申请`;
    case "approve": return `${actorName}刚刚审核通过`;
    case "reject": return `${actorName}刚刚退回：${reason || ""}`;
    case "completeDirect": return `${actorName}刚刚直接办结`;
    case "reopen": return `${actorName}刚刚重新打开`;
    default: return `${actorName}更新了任务状态`;
  }
}

function notificationsFor(
  action: TaskActionName,
  task: WorkflowTask,
  actor: WorkflowActor,
  reason?: string,
): WorkflowNotificationDraft[] {
  const entity = { type: "task" as const, id: task.id };
  const toChair: Omit<WorkflowNotificationDraft, "title" | "detail" | "level" | "entity"> = {
    recipientRoles: ["chair"] as Role[],
  };
  const toExecutors: Omit<WorkflowNotificationDraft, "title" | "detail" | "level" | "entity"> = {
    recipientNames: [task.person],
    recipientRoles: ["leader"] as Role[],
    recipientDepartment: task.department,
  };

  switch (action) {
    case "start":
      return [{ ...toExecutors, title: "主任务已开始", detail: `“${task.title}”已开始执行。`, level: "info", entity }];
    case "submit":
      return [{ ...toChair, title: "部门结办等待审核", detail: `${task.department}已提交“${task.title}”，请审核结果与凭据。`, level: "warning", entity }];
    case "withdraw":
      return [{ ...toChair, title: "负责人已撤回结办申请", detail: `${task.department}撤回了“${task.title}”的审核申请，将修改后再次提交。`, level: "info", entity }];
    case "approve":
      return [{ ...toExecutors, title: "主任务审核通过", detail: `主席已审核通过“${task.title}”。`, level: "success", entity }];
    case "reject":
      return [{ ...toExecutors, title: "主任务被退回修改", detail: `主席退回“${task.title}”：${reason || ""}`, level: "warning", entity }];
    case "completeDirect":
      return [{ ...toExecutors, title: "主任务已办结", detail: `“${task.title}”已直接标记为完成。`, level: "success", entity }];
    case "reopen":
      return [{ ...toExecutors, title: "主任务已重新打开", detail: `“${task.title}”已重新打开，请继续推进。`, level: "info", entity }];
    default:
      return [];
  }
}

export function applyTaskAction(
  tasks: WorkflowTask[],
  subtasks: WorkflowSubtask[],
  taskId: number,
  action: TaskActionName,
  actor: WorkflowActor,
  payload: TaskActionPayload = {},
): TaskActionResult {
  const index = tasks.findIndex((task) => task.id === taskId);
  if (index < 0) return { ok: false, status: 404, reason: "主任务不存在" };
  const task = tasks[index];
  const siblings = subtasks.filter((subtask) => isSubtaskOfParent(subtask, task));

  const isAssignee = task.person === actor.name;
  const isDepartmentLeader = actor.role === "leader" && task.department === actor.department;
  const smActor = { role: actor.role, isAssignee, isDepartmentLeader };

  if (action === "addAttachment") {
    const canAdd = actor.role === "chair" || isDepartmentLeader;
    if (!canAdd) return { ok: false, status: 403, reason: "只有主席或本部门负责人可以添加任务附件" };
    const attachment = payload.attachment;
    if (!attachment || !attachment.key) return { ok: false, status: 400, reason: "缺少附件信息" };
    const updated: WorkflowTask = {
      ...task,
      attachments: [...(task.attachments || []), attachment],
      lastAction: `${actor.name}刚刚添加附件“${attachment.name}”`,
    };
    const notifications: WorkflowNotificationDraft[] = [
      {
        recipientNames: [task.person],
        recipientRoles: ["leader"] as Role[],
        recipientDepartment: task.department,
        title: "任务新增参考附件",
        detail: `“${task.title}”新增附件“${attachment.name}”。`,
        level: "info",
        entity: { type: "task", id: task.id },
      },
    ];
    return { ok: true, tasks: tasks.map((task) => (task.id === taskId ? updated : task)), subtasks, notifications, event: { entityType: "task", entityId: taskId, action: "addAttachment", fromStatus: task.status, toStatus: task.status } };
  }

  if (action === "removeAttachment") {
    const canRemove = actor.role === "chair" || isDepartmentLeader;
    if (!canRemove) return { ok: false, status: 403, reason: "只有主席或本部门负责人可以删除任务附件" };
    const key = payload.key;
    if (!key) return { ok: false, status: 400, reason: "缺少附件标识" };
    const updated: WorkflowTask = {
      ...task,
      attachments: (task.attachments || []).filter((attachment) => attachment.key !== key),
      lastAction: `${actor.name}刚刚删除一个附件`,
    };
    return { ok: true, tasks: tasks.map((task) => (task.id === taskId ? updated : task)), subtasks, notifications: [], event: { entityType: "task", entityId: taskId, action: "removeAttachment", fromStatus: task.status, toStatus: task.status } };
  }

  if (action === "submit" && !canSubmitMainTask(task.status, siblings.map((subtask) => subtask.status))) {
    return { ok: false, status: 409, reason: "还有子任务未完成，暂不能提交结办" };
  }

  const transition = taskTransition(task.status, action, smActor, task.controlMode);
  if (!transition.ok) return { ok: false, status: 403, reason: transition.reason };

  const updated: WorkflowTask = {
    ...task,
    status: transition.next,
    lastAction: lastActionText(action, actor.name, payload.reason),
  };
  const nextTasks = tasks.map((task) => (task.id === taskId ? updated : task));
  const notifications = notificationsFor(action, task, actor, payload.reason);

  return { ok: true, tasks: nextTasks, subtasks, notifications, event: { entityType: "task", entityId: taskId, action, fromStatus: task.status, toStatus: transition.next, reason: payload.reason } };
}

export interface CreateTaskInput extends WorkflowTask {
  deadline?: string;
  kind?: string;
  description?: string;
  risk?: boolean;
  fields?: unknown[];
  activityName?: string;
  activityTime?: string;
  activityLocation?: string;
  liaisonTeacher?: string;
}

/** 主席发布新主任务。 */
export function createTask(
  tasks: WorkflowTask[],
  subtasks: WorkflowSubtask[],
  input: CreateTaskInput,
  actor: WorkflowActor,
): WorkflowMutationResult {
  if (actor.role !== "chair") return { ok: false, status: 403, reason: "只有主席可以发布主任务" };
  if (!input.title?.trim() || !input.department?.trim()) {
    return { ok: false, status: 400, reason: "请填写任务名称和负责部门" };
  }
  const task = { ...input, person: input.person || "待指派", status: "待开始" as const, lastAction: `${actor.name}刚刚发布` };
  const nextTasks = [...tasks, task];
  const notifications: WorkflowNotificationDraft[] = [
    {
      recipientNames: [task.person],
      recipientRoles: ["leader"] as Role[],
      recipientDepartment: task.department,
      title: "主席交办新任务",
      detail: `“${task.title}”已发布，截止${task.deadline || "未设置"}。`,
      level: "warning",
      entity: { type: "task", id: task.id },
    },
  ];
  return {
    ok: true,
    tasks: nextTasks,
    subtasks,
    notifications,
    event: { entityType: "task", entityId: task.id, action: "create", fromStatus: "", toStatus: "待开始" },
  };
}
