export type LifeActor = { role: "admin" | "chair" | "leader" | "staff" | "teacher"; department: string; username: string };
export const isLifeManager = (actor: Pick<LifeActor, "role" | "department">) => actor.role === "admin" || actor.role === "chair" || actor.department === "生活部";

type Result<T extends string> = { ok: true; next: T } | { ok: false; reason: string };
const denied = <T extends string>(reason: string): Result<T> => ({ ok: false, reason });

export const PURCHASE_STATUSES = ["草稿", "待生活部审核", "待补充材料", "待采购", "已采购", "待办公室报销", "已完成", "已驳回"] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];
export type PurchaseAction = "submit" | "approve" | "return" | "reject" | "purchased" | "transfer" | "reopen";

export function purchaseTransition(current: PurchaseStatus, action: PurchaseAction, actor: LifeActor, requesterUsername: string): Result<PurchaseStatus> {
  const manager = isLifeManager(actor); const owner = actor.username === requesterUsername;
  if (action === "submit") return owner && (current === "草稿" || current === "待补充材料") ? { ok: true, next: "待生活部审核" } : denied("只有申请人可以提交草稿或补充后的采购申请");
  if (!manager) return denied("只有生活部成员、主席或管理员可以处理采购申请");
  if (action === "approve") return current === "待生活部审核" ? { ok: true, next: "待采购" } : denied(`当前状态为“${current}”，不能通过审核`);
  if (action === "return") return current === "待生活部审核" ? { ok: true, next: "待补充材料" } : denied(`当前状态为“${current}”，不能退回`);
  if (action === "reject") return current === "待生活部审核" ? { ok: true, next: "已驳回" } : denied(`当前状态为“${current}”，不能驳回`);
  if (action === "purchased") return current === "待采购" ? { ok: true, next: "已采购" } : denied(`当前状态为“${current}”，不能登记采购完成`);
  if (action === "transfer") return current === "已采购" ? { ok: true, next: "待办公室报销" } : denied(`当前状态为“${current}”，不能转交报销`);
  if (action === "reopen") return actor.role === "admin" || actor.role === "chair" ? (current === "已完成" || current === "已驳回" ? { ok: true, next: "待生活部审核" } : denied(`当前状态为“${current}”，不能重新打开`)) : denied("只有主席或管理员可以重新打开采购申请");
  return denied("未知采购操作");
}

export const INSPECTION_STATUSES = ["草稿", "进行中", "待整改", "待复查", "已归档"] as const;
export type InspectionStatus = (typeof INSPECTION_STATUSES)[number];
export type InspectionAction = "start" | "rectify" | "recheck" | "archive" | "reopen";

export function inspectionTransition(current: InspectionStatus, action: InspectionAction, actor: LifeActor): Result<InspectionStatus> {
  if (!isLifeManager(actor)) return denied("只有生活部成员、主席或管理员可以处理查寝批次");
  if (action === "start") return current === "草稿" ? { ok: true, next: "进行中" } : denied(`当前状态为“${current}”，不能开始`);
  if (action === "rectify") return current === "进行中" ? { ok: true, next: "待整改" } : denied(`当前状态为“${current}”，不能进入整改`);
  if (action === "recheck") return current === "待整改" ? { ok: true, next: "待复查" } : denied(`当前状态为“${current}”，不能进入复查`);
  if (action === "archive") return current === "进行中" || current === "待复查" ? { ok: true, next: "已归档" } : denied(`当前状态为“${current}”，不能归档`);
  if (action === "reopen") return (actor.role === "admin" || actor.role === "chair") && current === "已归档" ? { ok: true, next: "进行中" } : denied("只有主席或管理员可以重新打开已归档批次");
  return denied("未知查寝操作");
}

export const LOST_FOUND_STATUSES = ["待整理", "待新媒体发布", "招领中", "待核验", "已归还", "无人认领归档"] as const;
export type LostFoundStatus = (typeof LOST_FOUND_STATUSES)[number];
export type LostFoundAction = "submitPublish" | "publish" | "claim" | "return" | "archive" | "reopen";

export function lostFoundTransition(current: LostFoundStatus, action: LostFoundAction, actor: LifeActor): Result<LostFoundStatus> {
  if (!isLifeManager(actor)) return denied("只有生活部成员、主席或管理员可以处理失物招领");
  if (action === "submitPublish") return current === "待整理" ? { ok: true, next: "待新媒体发布" } : denied(`当前状态为“${current}”，不能提交发布`);
  if (action === "publish") return current === "待新媒体发布" ? { ok: true, next: "招领中" } : denied(`当前状态为“${current}”，不能登记发布`);
  if (action === "claim") return current === "招领中" ? { ok: true, next: "待核验" } : denied(`当前状态为“${current}”，不能登记认领`);
  if (action === "return") return current === "待核验" ? { ok: true, next: "已归还" } : denied(`当前状态为“${current}”，不能确认归还`);
  if (action === "archive") return current === "招领中" ? { ok: true, next: "无人认领归档" } : denied(`当前状态为“${current}”，不能归档`);
  if (action === "reopen") return (actor.role === "admin" || actor.role === "chair") && (current === "已归还" || current === "无人认领归档") ? { ok: true, next: "招领中" } : denied("只有主席或管理员可以重新打开已结束失物记录");
  return denied("未知失物招领操作");
}
