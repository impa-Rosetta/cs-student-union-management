import type { AppRole } from "../server-auth.ts";

export const ACTIVITY_STAGES = [
  "草稿",
  "待审批",
  "筹备中",
  "执行中",
  "总结中",
  "待归档",
  "已归档",
] as const;

export type ActivityStage = (typeof ACTIVITY_STAGES)[number];

export type ActivityAction =
  | "submit"
  | "approve"
  | "reject"
  | "start"
  | "finish"
  | "submitArchive"
  | "archive"
  | "reopen";

export interface ActivityActor {
  role: AppRole;
  isActivityLeader: boolean;
  isGuidingTeacher: boolean;
}

export type ActivityTransitionResult =
  | { ok: true; next: ActivityStage }
  | { ok: false; reason: string };

const legacyStageMap: Record<string, ActivityStage> = {
  策划中: "草稿",
  待启动: "待审批",
  筹备中: "筹备中",
  已结束: "已归档",
};

export function normalizeActivityStage(value: unknown): ActivityStage | null {
  if (typeof value !== "string") return null;
  if ((ACTIVITY_STAGES as readonly string[]).includes(value)) return value as ActivityStage;
  return legacyStageMap[value] ?? null;
}

function denied(reason: string): ActivityTransitionResult {
  return { ok: false, reason };
}

export function activityTransition(
  current: ActivityStage,
  action: ActivityAction,
  actor: ActivityActor,
): ActivityTransitionResult {
  const administrator = actor.role === "admin";
  const chair = actor.role === "chair";
  const manager = administrator || chair || (actor.role === "leader" && actor.isActivityLeader);
  const reviewer = administrator || chair || (actor.role === "teacher" && actor.isGuidingTeacher);

  switch (action) {
    case "submit":
      if (!manager) return denied("只有活动负责人、主席或管理员可以提交活动审批");
      if (current !== "草稿") return denied(`活动当前为“${current}”，不能提交审批`);
      return { ok: true, next: "待审批" };
    case "approve":
      if (!reviewer) return denied("只有主席、管理员或本活动指导教师可以批准活动");
      if (current !== "待审批") return denied(`活动当前为“${current}”，不能批准`);
      return { ok: true, next: "筹备中" };
    case "reject":
      if (!reviewer) return denied("只有主席、管理员或本活动指导教师可以退回活动");
      if (current !== "待审批") return denied(`活动当前为“${current}”，不能退回`);
      return { ok: true, next: "草稿" };
    case "start":
      if (!manager) return denied("只有活动负责人、主席或管理员可以开始执行活动");
      if (current !== "筹备中") return denied(`活动当前为“${current}”，不能开始执行`);
      return { ok: true, next: "执行中" };
    case "finish":
      if (!manager) return denied("只有活动负责人、主席或管理员可以结束现场执行");
      if (current !== "执行中") return denied(`活动当前为“${current}”，不能进入总结`);
      return { ok: true, next: "总结中" };
    case "submitArchive":
      if (!manager) return denied("只有活动负责人、主席或管理员可以提交归档");
      if (current !== "总结中") return denied(`活动当前为“${current}”，不能提交归档`);
      return { ok: true, next: "待归档" };
    case "archive":
      if (!administrator && !chair) return denied("只有主席或管理员可以确认归档");
      if (current !== "待归档") return denied(`活动当前为“${current}”，不能归档`);
      return { ok: true, next: "已归档" };
    case "reopen":
      if (!administrator && !chair) return denied("只有主席或管理员可以重新打开活动");
      if (current !== "已归档") return denied(`活动当前为“${current}”，不能重新打开`);
      return { ok: true, next: "总结中" };
    default:
      return denied("未知的活动阶段操作");
  }
}
