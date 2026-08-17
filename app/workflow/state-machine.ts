// 任务状态机：主任务与子任务的合法状态流转、角色守卫与父子聚合。
//
// 纯函数、无 Worker/D1 依赖，是服务端事务与前端展示共用的唯一规则来源。
// 状态取值沿用现有 shared_state 中的中文字面量，避免数据迁移。

export type Role = "admin" | "chair" | "leader" | "staff" | "teacher";

export type TaskStatus = "待开始" | "进行中" | "待验收" | "已完成";
export type SubtaskStatus =
  | "待开始"
  | "进行中"
  | "待验收"
  | "需修改"
  | "已完成"
  | "已取消";

export type ControlMode = "快捷办结" | "凭据留痕" | "负责人确认";

export const TASK_STATUSES: TaskStatus[] = ["待开始", "进行中", "待验收", "已完成"];
export const SUBTASK_STATUSES: SubtaskStatus[] = [
  "待开始",
  "进行中",
  "待验收",
  "需修改",
  "已完成",
  "已取消",
];

/** 执行一次操作所需的上下文：角色 + 与任务实体的关系。 */
export interface Actor {
  role: Role;
  /** 是否是当前任务/子任务的执行人（被直接指派的人）。 */
  isAssignee: boolean;
  /** 是否是当前任务/子任务所属部门的负责人。 */
  isDepartmentLeader: boolean;
}

export type SubtaskAction =
  | "start"
  | "submit"
  | "withdraw"
  | "approve"
  | "reject"
  | "completeDirect"
  | "cancel"
  | "reopen";

export type TaskAction =
  | "start"
  | "submit"
  | "withdraw"
  | "approve"
  | "reject"
  | "completeDirect"
  | "reopen";

export type TransitionResult<T> =
  | { ok: true; next: T }
  | { ok: false; reason: string };

function fail<T>(reason: string): TransitionResult<T> {
  return { ok: false, reason };
}

/**
 * 子任务状态机。
 *
 * 规则要点（与提示词 §五/§七.5 一致）：
 * - 执行人（干事或负责人本人）开始、提交、撤回；
 * - 部门负责人验收通过 / 退回修改 / 直接办结 / 撤销；
 * - 已提交未审核（待验收）可撤回；退回（需修改）可重新提交；
 * - 已完成 / 已取消 为终态，只能通过「重新打开」从已完成恢复。
 */
export function subtaskTransition(
  current: SubtaskStatus,
  action: SubtaskAction,
  actor: Actor,
): TransitionResult<SubtaskStatus> {
  const executor =
    actor.isAssignee && (actor.role === "staff" || actor.role === "leader");
  const manager = actor.isDepartmentLeader && actor.role === "leader";
  const supervisor = actor.role === "chair";

  switch (action) {
    case "start":
      if (!executor) return fail("只有执行人本人可以开始子任务");
      if (current !== "待开始") return fail(`子任务当前为“${current}”，不能开始`);
      return { ok: true, next: "进行中" };

    case "submit":
      if (!executor) return fail("只有执行人本人可以提交验收");
      if (current !== "进行中" && current !== "需修改") {
        return fail(`子任务当前为“${current}”，不能提交验收`);
      }
      return { ok: true, next: "待验收" };

    case "withdraw":
      if (!executor) return fail("只有执行人本人可以撤回提交");
      if (current !== "待验收") return fail(`子任务当前为“${current}”，不能撤回提交`);
      return { ok: true, next: "进行中" };

    case "approve":
      if (!manager) return fail("只有本部门负责人可以验收子任务");
      if (current !== "待验收") return fail(`子任务当前为“${current}”，不能验收`);
      return { ok: true, next: "已完成" };

    case "reject":
      if (!manager) return fail("只有本部门负责人可以退回子任务");
      if (current !== "待验收") return fail(`子任务当前为“${current}”，不能退回`);
      return { ok: true, next: "需修改" };

    case "completeDirect":
      if (!manager && !supervisor) {
        return fail("只有本部门负责人或主席可以直接办结子任务");
      }
      if (current === "已完成" || current === "已取消") {
        return fail(`子任务已处于“${current}”，不能直接办结`);
      }
      return { ok: true, next: "已完成" };

    case "cancel":
      if (!manager) return fail("只有本部门负责人可以撤销子任务");
      if (current === "已完成" || current === "已取消") {
        return fail(`子任务已处于“${current}”，不能撤销`);
      }
      return { ok: true, next: "已取消" };

    case "reopen":
      if (!manager && !supervisor) {
        return fail("只有本部门负责人或主席可以重新打开子任务");
      }
      if (current !== "已完成") return fail(`子任务当前为“${current}”，不能重新打开`);
      return { ok: true, next: "进行中" };

    default:
      return fail("未知的子任务操作");
  }
}

/**
 * 主任务状态机。
 *
 * 规则要点：
 * - 主席可标记开始、直接办结、审核通过、退回、重新打开；
 * - 被直接交办的执行人（负责人或干事）可开始、提交结办、撤回；
 * - 部门负责人可提交本部门结办、撤回结办、直接办结；
 * - 快捷办结模式下执行人可直接办结；负责人确认模式仍须主席终审。
 */
export function taskTransition(
  current: TaskStatus,
  action: TaskAction,
  actor: Actor,
  controlMode?: ControlMode,
): TransitionResult<TaskStatus> {
  const chair = actor.role === "chair";
  const manager = actor.isDepartmentLeader && actor.role === "leader";
  const executor =
    actor.isAssignee && (actor.role === "leader" || actor.role === "staff");

  switch (action) {
    case "start":
      if (!chair && !executor) return fail("只有主席或被直接交办的执行人可以开始主任务");
      if (current !== "待开始") return fail(`主任务当前为“${current}”，不能开始`);
      return { ok: true, next: "进行中" };

    case "submit":
      if (!manager && !executor) return fail("只有部门负责人或直接执行人可以提交结办");
      if (current !== "进行中") return fail(`主任务当前为“${current}”，不能提交结办`);
      return { ok: true, next: "待验收" };

    case "withdraw":
      if (!manager && !executor) return fail("只有部门负责人或直接执行人可以撤回结办申请");
      if (current !== "待验收") return fail(`主任务当前为“${current}”，不能撤回结办`);
      return { ok: true, next: "进行中" };

    case "approve":
      if (!chair) return fail("只有主席可以审核通过主任务");
      if (current !== "待验收") return fail(`主任务当前为“${current}”，不能审核通过`);
      return { ok: true, next: "已完成" };

    case "reject":
      if (!chair) return fail("只有主席可以退回主任务");
      if (current !== "待验收") return fail(`主任务当前为“${current}”，不能退回`);
      return { ok: true, next: "进行中" };

    case "completeDirect": {
      const canDirectComplete =
        chair ||
        manager ||
        (executor && controlMode === "快捷办结");
      if (!canDirectComplete) {
        return fail("当前角色或管理方式不允许直接办结主任务");
      }
      if (current === "已完成") return fail("主任务已完成，不能重复办结");
      return { ok: true, next: "已完成" };
    }

    case "reopen":
      if (!chair) return fail("只有主席可以重新打开主任务");
      if (current !== "已完成") return fail(`主任务当前为“${current}”，不能重新打开`);
      return { ok: true, next: "进行中" };

    default:
      return fail("未知的主任务操作");
  }
}

/**
 * 父子状态聚合：任一子任务进入执行（非待开始、非已取消），
 * 待开始的主任务自动转为进行中。待验收 / 已完成 不再被子任务反向驱动。
 */
export function aggregateMainTaskStatus(
  main: TaskStatus,
  subtasks: readonly SubtaskStatus[],
): TaskStatus {
  if (main === "待验收" || main === "已完成") return main;
  if (main === "待开始" && subtasks.some((s) => s !== "待开始" && s !== "已取消")) {
    return "进行中";
  }
  return main;
}

/**
 * 负责人能否提交主任务结办：主任务须在进行中，且所有未取消的子任务均已完成
 * （直接交办、没有子任务时视为满足）。
 */
export function canSubmitMainTask(
  main: TaskStatus,
  subtasks: readonly SubtaskStatus[],
): boolean {
  if (main !== "进行中") return false;
  return subtasks.every((s) => s === "已完成" || s === "已取消");
}
