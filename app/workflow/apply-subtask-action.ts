// 服务端子任务操作：把「状态转换 + 附件增删 + 父子聚合 + 通知草稿」集中到一个
// 纯函数中，作为细粒度 API 的规则核心。无 Worker/D1 依赖，可单元测试。

import {
  aggregateMainTaskStatus,
  subtaskTransition,
  type Role,
  type SubtaskStatus,
} from "./state-machine.ts";
import type {
  WorkflowActor,
  WorkflowAttachment,
  WorkflowMutationResult,
  WorkflowNotificationDraft,
  WorkflowSubtask,
  WorkflowTask,
  WorkflowTransitionEvent,
} from "./types.ts";

export type SubtaskActionName =
  | "start"
  | "submit"
  | "withdraw"
  | "approve"
  | "reject"
  | "completeDirect"
  | "cancel"
  | "reopen"
  | "addAttachment"
  | "removeAttachment";

export interface SubtaskActionPayload {
  note?: string;
  reason?: string;
  attachment?: WorkflowAttachment;
  key?: string;
}

export type SubtaskActionResult =
  | {
      ok: true;
      tasks: WorkflowTask[];
      subtasks: WorkflowSubtask[];
      notifications: WorkflowNotificationDraft[];
      updated: WorkflowSubtask;
      event: WorkflowTransitionEvent;
    }
  | { ok: false; status: number; reason: string };

function isSubtaskOfParent(subtask: WorkflowSubtask, parent: WorkflowTask): boolean {
  return subtask.parentTaskId
    ? subtask.parentTaskId === parent.id
    : subtask.parent === parent.title;
}

function findParentTask(tasks: WorkflowTask[], subtask: WorkflowSubtask): WorkflowTask | undefined {
  return tasks.find((task) => isSubtaskOfParent(subtask, task));
}

function replaceAt<T>(list: T[], index: number, next: T): T[] {
  const copy = list.slice();
  copy[index] = next;
  return copy;
}

function lastActionText(
  action: SubtaskActionName,
  nextStatus: SubtaskStatus,
  actorName: string,
  reason?: string,
): string {
  switch (action) {
    case "start": return `${actorName}刚刚开始执行`;
    case "submit": return `${actorName}刚刚提交负责人验收`;
    case "withdraw": return `${actorName}刚刚撤回验收申请，继续修改`;
    case "approve": return `${actorName}刚刚验收通过`;
    case "reject": return `${actorName}退回：${reason || ""}`;
    case "completeDirect": return `${actorName}刚刚直接办结`;
    case "cancel": return `${actorName}撤销${reason ? `：${reason}` : ""}`;
    case "reopen": return `${actorName}重新打开`;
    case "addAttachment": return `${actorName}刚刚补充凭据`;
    case "removeAttachment": return `${actorName}刚刚删除一个凭据`;
    default: return `${actorName}更新状态为${nextStatus}`;
  }
}

function notificationsFor(
  action: SubtaskActionName,
  subtask: WorkflowSubtask,
  parent: WorkflowTask,
  actor: WorkflowActor,
  reason?: string,
): WorkflowNotificationDraft[] {
  const entity = { type: "subtask" as const, id: subtask.id, parentTaskId: subtask.parentTaskId };
  const toLeader: Omit<WorkflowNotificationDraft, "title" | "detail" | "level" | "entity"> = {
    recipientRoles: ["leader"] as Role[],
    recipientDepartment: parent.department,
  };
  const toAssignee: Omit<WorkflowNotificationDraft, "title" | "detail" | "level" | "entity"> = {
    recipientNames: [subtask.assignee],
  };

  switch (action) {
    case "start":
      return [{ ...toLeader, title: "子任务已开始", detail: `${actor.name}已开始执行“${subtask.title}”。`, level: "info", entity }];
    case "submit":
      return [{ ...toLeader, title: "子任务等待验收", detail: `${actor.name}已提交“${subtask.title}”，请检查完成说明和凭据。`, level: "warning", entity }];
    case "withdraw":
      return [{ ...toLeader, title: "执行人已撤回提交", detail: `${actor.name}撤回了“${subtask.title}”的验收申请，将修改后再次提交。`, level: "info", entity }];
    case "approve":
      return [{ ...toAssignee, title: "子任务验收通过", detail: `“${subtask.title}”已由负责人验收通过。`, level: "success", entity }];
    case "reject":
      return [{ ...toAssignee, title: "子任务被退回修改", detail: `“${subtask.title}”需要修改：${reason || ""}`, level: "warning", entity }];
    case "completeDirect":
      return [{ ...toAssignee, title: "子任务已由负责人办结", detail: `“${subtask.title}”已直接标记为完成。`, level: "success", entity }];
    case "cancel":
      return [{ ...toAssignee, title: "子任务已撤销", detail: `负责人已撤销“${subtask.title}”${reason ? `：${reason}` : ""}`, level: "warning", entity }];
    case "reopen":
      return [{ ...toAssignee, title: "子任务已重新打开", detail: `“${subtask.title}”已重新打开，请继续执行。`, level: "info", entity }];
    default:
      return [];
  }
}

export function applySubtaskAction(
  tasks: WorkflowTask[],
  subtasks: WorkflowSubtask[],
  subtaskId: string,
  action: SubtaskActionName,
  actor: WorkflowActor,
  payload: SubtaskActionPayload = {},
): SubtaskActionResult {
  const index = subtasks.findIndex((subtask) => subtask.id === subtaskId);
  if (index < 0) return { ok: false, status: 404, reason: "子任务不存在" };
  const subtask = subtasks[index];
  const parent = findParentTask(tasks, subtask);
  if (!parent) return { ok: false, status: 409, reason: "子任务所属的主任务不存在" };

  const isAssignee = subtask.assignee === actor.name;
  const isDepartmentLeader = actor.role === "leader" && parent.department === actor.department;

  let updated: WorkflowSubtask;
  let notifications: WorkflowNotificationDraft[] = [];

  if (action === "addAttachment") {
    if (!isAssignee && !isDepartmentLeader) {
      return { ok: false, status: 403, reason: "只有执行人或本部门负责人可以补充凭据" };
    }
    const attachment = payload.attachment;
    if (!attachment || !attachment.key) return { ok: false, status: 400, reason: "缺少附件信息" };
    const autoStart = subtask.status === "待开始";
    updated = {
      ...subtask,
      attachments: [...(subtask.attachments || []), attachment],
      status: autoStart ? "进行中" : subtask.status,
      lastAction: `${actor.name}刚刚上传凭据“${attachment.name}”`,
    };
  } else if (action === "removeAttachment") {
    if (!isAssignee) return { ok: false, status: 403, reason: "只有执行人本人可以删除凭据" };
    const key = payload.key;
    if (!key) return { ok: false, status: 400, reason: "缺少附件标识" };
    updated = {
      ...subtask,
      attachments: (subtask.attachments || []).filter((attachment) => attachment.key !== key),
      lastAction: `${actor.name}刚刚删除一个凭据`,
    };
  } else {
    const smActor = { role: actor.role, isAssignee, isDepartmentLeader };
    const transition = subtaskTransition(subtask.status, action, smActor);
    if (!transition.ok) return { ok: false, status: 403, reason: transition.reason };
    updated = {
      ...subtask,
      status: transition.next,
      ...(payload.note ? { completionNote: payload.note } : {}),
      lastAction: lastActionText(action, transition.next, actor.name, payload.reason),
    };
    notifications = notificationsFor(action, subtask, parent, actor, payload.reason);
  }

  const nextSubtasks = replaceAt(subtasks, index, updated);
  const siblings = nextSubtasks.filter((subtask) => isSubtaskOfParent(subtask, parent));
  const parentStatus = aggregateMainTaskStatus(parent.status, siblings.map((subtask) => subtask.status));
  const nextTasks =
    parentStatus !== parent.status
      ? tasks.map((task) =>
          task.id === parent.id
            ? { ...task, status: parentStatus, lastAction: "子任务状态变化，主任务自动更新" }
            : task,
        )
      : tasks;

  return {
    ok: true,
    tasks: nextTasks,
    subtasks: nextSubtasks,
    notifications,
    updated,
    event: {
      entityType: "subtask",
      entityId: subtaskId,
      action,
      fromStatus: subtask.status,
      toStatus: updated.status,
      reason: payload.reason,
    },
  };
}

export interface CreateSubtaskInput {
  title: string;
  assignee: string;
  deadline?: string;
  evidence?: string;
}

/** 负责人（或主席）在主任务内拆解并分派一个新子任务。 */
export function createSubtask(
  tasks: WorkflowTask[],
  subtasks: WorkflowSubtask[],
  parentTaskId: number,
  actor: WorkflowActor,
  input: CreateSubtaskInput,
): WorkflowMutationResult {
  const parent = tasks.find((task) => task.id === parentTaskId);
  if (!parent) return { ok: false, status: 404, reason: "主任务不存在" };
  const isDepartmentLeader = actor.role === "leader" && parent.department === actor.department;
  const isChair = actor.role === "chair";
  if (!isDepartmentLeader && !isChair) {
    return { ok: false, status: 403, reason: "只有本部门负责人或主席可以拆分子任务" };
  }
  const title = input.title?.trim();
  const assignee = input.assignee?.trim();
  if (!title || !assignee) return { ok: false, status: 400, reason: "请填写子任务名称和执行人" };

  const id = `subtask-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const subtask: WorkflowSubtask = {
    id,
    parentTaskId: parent.id,
    parent: parent.title,
    title,
    assignee,
    deadline: input.deadline,
    evidence: input.evidence,
    status: "待开始",
    lastAction: `${actor.name}已分派给${assignee}`,
  };
  const nextSubtasks = [...subtasks, subtask];
  const notifications: WorkflowNotificationDraft[] = [
    {
      recipientNames: [assignee],
      title: "收到新的执行任务",
      detail: `${actor.name}将“${title}”分派给你。`,
      level: "warning",
      entity: { type: "subtask", id, parentTaskId: parent.id },
    },
  ];
  return {
    ok: true,
    tasks,
    subtasks: nextSubtasks,
    notifications,
    event: { entityType: "subtask", entityId: id, action: "create", fromStatus: "", toStatus: "待开始" },
  };
}
