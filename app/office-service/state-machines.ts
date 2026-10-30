import type { AppRole } from "../server-auth.ts";

export const venueStatuses = ["草稿", "待办公室审核", "待补充材料", "办理中", "借用成功", "借用失败", "已取消", "已归档"] as const;
export type VenueStatus = typeof venueStatuses[number];
export type VenueAction = "submit" | "return" | "resubmit" | "process" | "success" | "fail" | "cancel" | "archive";

export const meetingRoundStatuses = ["草稿", "收集中", "待汇总", "已生成", "已归档"] as const;
export type MeetingRoundStatus = typeof meetingRoundStatuses[number];
export type MeetingRoundAction = "publish" | "close" | "reopen" | "generated" | "archive";

export const meetingReportStatuses = ["未填写", "草稿", "已提交", "待修改", "已确认"] as const;
export type MeetingReportStatus = typeof meetingReportStatuses[number];
export type MeetingReportAction = "save" | "submit" | "return" | "confirm";

export type OfficeActor = { role: AppRole; department: string; username: string };

export function isOfficeManager(actor: OfficeActor) {
  return actor.role === "admin" || actor.role === "chair" || actor.department === "办公室";
}

export function venueTransition(status: VenueStatus, action: VenueAction, actor: OfficeActor, ownerUsername: string): VenueStatus {
  const owner = actor.username === ownerUsername;
  const manager = isOfficeManager(actor);
  const allowed: Partial<Record<VenueStatus, Partial<Record<VenueAction, VenueStatus>>>> = {
    草稿: { submit: "待办公室审核", cancel: "已取消" },
    待办公室审核: { return: "待补充材料", process: "办理中", cancel: "已取消" },
    待补充材料: { resubmit: "待办公室审核", cancel: "已取消" },
    办理中: { success: "借用成功", fail: "借用失败", return: "待补充材料" },
    借用成功: { archive: "已归档" },
    借用失败: { resubmit: "待办公室审核", archive: "已归档" },
    已取消: { archive: "已归档" },
  };
  const next = allowed[status]?.[action];
  if (!next) throw new Error(`当前状态“${status}”不能执行该操作`);
  if (["return", "process", "success", "fail", "archive"].includes(action) && !manager) throw new Error("只有办公室相关人员可以执行该操作");
  if (["submit", "resubmit", "cancel"].includes(action) && !owner && !manager) throw new Error("只有申请人或办公室相关人员可以执行该操作");
  return next;
}

export function meetingRoundTransition(status: MeetingRoundStatus, action: MeetingRoundAction, actor: OfficeActor): MeetingRoundStatus {
  if (!isOfficeManager(actor)) throw new Error("只有办公室相关人员可以管理例会通报");
  const allowed: Partial<Record<MeetingRoundStatus, Partial<Record<MeetingRoundAction, MeetingRoundStatus>>>> = {
    草稿: { publish: "收集中" },
    收集中: { close: "待汇总" },
    待汇总: { reopen: "收集中", generated: "已生成" },
    已生成: { reopen: "收集中", archive: "已归档" },
  };
  const next = allowed[status]?.[action];
  if (!next) throw new Error(`当前状态“${status}”不能执行该操作`);
  return next;
}

export function meetingReportTransition(status: MeetingReportStatus, action: MeetingReportAction, actor: OfficeActor, department: string): MeetingReportStatus {
  const manager = isOfficeManager(actor);
  const sameDepartment = actor.department === department || actor.role === "admin" || actor.role === "chair";
  if ((action === "save" || action === "submit") && !sameDepartment && !manager) throw new Error("只能填写本部门的例会通报");
  if (action === "submit" && actor.role === "staff" && !manager) throw new Error("部门成员可保存草稿，需由部门负责人提交");
  if ((action === "return" || action === "confirm") && !manager) throw new Error("只有办公室相关人员可以审核例会通报");
  if (action === "save" && ["未填写", "草稿", "待修改"].includes(status)) return "草稿";
  if (action === "submit" && ["未填写", "草稿", "待修改"].includes(status)) return "已提交";
  if (action === "return" && status === "已提交") return "待修改";
  if (action === "confirm" && status === "已提交") return "已确认";
  throw new Error(`当前状态“${status}”不能执行该操作`);
}

export function venueTimeLabel(confirmedDate: string, confirmedStart: string, confirmedEnd: string, now = new Date()) {
  if (!confirmedDate || !confirmedStart || !confirmedEnd) return "待确认";
  const start = new Date(`${confirmedDate}T${confirmedStart}`);
  const end = new Date(`${confirmedDate}T${confirmedEnd}`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "待确认";
  if (now < start) return "待使用";
  if (now <= end) return "使用中";
  return "已结束";
}
