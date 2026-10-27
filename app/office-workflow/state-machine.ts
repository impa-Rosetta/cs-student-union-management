export const OFFICE_REQUEST_STATUSES = [
  "草稿",
  "待办公室审核",
  "待补充材料",
  "外部办理中",
  "已完成",
  "已驳回",
] as const;

export type OfficeRequestStatus = (typeof OFFICE_REQUEST_STATUSES)[number];
export type OfficeRequestAction = "submit" | "return" | "reject" | "process" | "complete" | "reopen";

export type OfficeActor = {
  role: "admin" | "chair" | "leader" | "staff" | "teacher";
  department: string;
  username: string;
  requesterUsername: string;
};

type TransitionResult = { ok: true; next: OfficeRequestStatus } | { ok: false; reason: string };

export function isOfficeManager(actor: Pick<OfficeActor, "role" | "department">) {
  return actor.role === "admin" || actor.role === "chair" || actor.department === "办公室";
}

export function officeRequestTransition(
  current: OfficeRequestStatus,
  action: OfficeRequestAction,
  actor: OfficeActor,
): TransitionResult {
  const manager = isOfficeManager(actor);
  const owner = actor.username === actor.requesterUsername;

  if (action === "submit") {
    if (!owner && !manager) return { ok: false, reason: "只有申请人或办公室管理人员可以提交申请" };
    if (current !== "草稿" && current !== "待补充材料") return { ok: false, reason: `当前状态为“${current}”，不能提交` };
    return { ok: true, next: "待办公室审核" };
  }
  if (!manager) return { ok: false, reason: "只有办公室成员、主席或管理员可以办理申请" };
  if (action === "return") {
    if (current !== "待办公室审核") return { ok: false, reason: `当前状态为“${current}”，不能退回补充` };
    return { ok: true, next: "待补充材料" };
  }
  if (action === "reject") {
    if (current !== "待办公室审核") return { ok: false, reason: `当前状态为“${current}”，不能驳回` };
    return { ok: true, next: "已驳回" };
  }
  if (action === "process") {
    if (current !== "待办公室审核") return { ok: false, reason: `当前状态为“${current}”，不能开始外部办理` };
    return { ok: true, next: "外部办理中" };
  }
  if (action === "complete") {
    if (current !== "外部办理中") return { ok: false, reason: `当前状态为“${current}”，不能办结` };
    return { ok: true, next: "已完成" };
  }
  if (action === "reopen") {
    if (current !== "已驳回" && current !== "已完成") return { ok: false, reason: `当前状态为“${current}”，不能重新打开` };
    return { ok: true, next: "待办公室审核" };
  }
  return { ok: false, reason: "未知的办公室申请操作" };
}
