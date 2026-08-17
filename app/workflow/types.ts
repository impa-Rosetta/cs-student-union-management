// 工作流共享类型：主任务 / 子任务 / 附件 / 通知草稿 / 操作者上下文。
// 服务端与（后续）前端共用的最小数据契约，字段与 shared_state JSON 中的存储一致。

import type { ControlMode, Role, SubtaskStatus, TaskStatus } from "./state-machine.ts";

export interface WorkflowAttachment {
  key: string;
  name: string;
  size: number;
  type?: string;
}

export interface WorkflowTask {
  id: number;
  title: string;
  department: string;
  person: string;
  status: TaskStatus;
  controlMode?: ControlMode;
  lastAction?: string;
  attachments?: WorkflowAttachment[];
}

export interface WorkflowSubtask {
  id: string;
  parentTaskId?: number;
  parent?: string;
  title: string;
  assignee: string;
  deadline?: string;
  evidence?: string;
  status: SubtaskStatus;
  completedBy?: string;
  completionNote?: string;
  attachments?: WorkflowAttachment[];
  lastAction?: string;
}

export interface WorkflowNotificationDraft {
  recipientNames?: string[];
  recipientRoles?: Role[];
  recipientDepartment?: string;
  title: string;
  detail: string;
  level: "info" | "success" | "warning";
  entity: { type: "subtask" | "task"; id: string | number; parentTaskId?: number };
}

export interface WorkflowActor {
  role: Role;
  name: string;
  department: string;
}

export interface WorkflowTransitionEvent {
  entityType: "task" | "subtask";
  entityId: string | number;
  action: string;
  fromStatus: string;
  toStatus: string;
  reason?: string;
}

export type WorkflowMutationResult =
  | {
      ok: true;
      tasks: WorkflowTask[];
      subtasks: WorkflowSubtask[];
      notifications: WorkflowNotificationDraft[];
      event: WorkflowTransitionEvent;
    }
  | { ok: false; status: number; reason: string };
