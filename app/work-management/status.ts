export type UnifiedWorkStatus =
  | "pending"
  | "in_progress"
  | "waiting"
  | "review"
  | "done"
  | "canceled"
  | "unknown";

const STATUS_GROUPS: Record<Exclude<UnifiedWorkStatus, "unknown">, ReadonlySet<string>> = {
  pending: new Set([
    "草稿", "待开始", "待启动", "待处理", "待领取", "待新媒体领取", "待办公室审核",
    "待组织部审核", "待主席团确认", "待组织部复核", "待学习部修改", "待补充材料",
    "待生活部审核", "待采购", "待整理", "未填写", "待修改", "待申请人修改",
  ]),
  in_progress: new Set([
    "进行中", "执行中", "筹备中", "策划中", "新媒体制作中", "外部办理中", "办理中",
    "整改中", "总结中", "收集中", "招领中", "使用中",
  ]),
  waiting: new Set([
    "等待他人", "等待外部办理", "待外部办理", "待申请人补充", "待部门提交", "待复查",
    "待整改", "待新媒体发布", "待办公室报销", "待使用",
  ]),
  review: new Set([
    "待验收", "待审核", "待审批", "待主席审核", "待归档", "待确认", "待复核", "待发布",
    "待汇总", "已提交", "待核验", "待结果确认",
  ]),
  done: new Set([
    "已完成", "已通过归档", "已归档", "已生效", "已领取", "已确认", "已发布", "已办结",
    "借用成功", "已生成", "已采购", "已归还", "无人认领归档", "已结束",
  ]),
  canceled: new Set([
    "已取消", "已撤回", "已驳回", "已作废", "已终止", "已关闭", "借用失败",
  ]),
};

export function toUnifiedWorkStatus(nativeStatus: string | null | undefined): UnifiedWorkStatus {
  const status = String(nativeStatus || "").trim();
  if (!status) return "unknown";
  for (const [group, statuses] of Object.entries(STATUS_GROUPS)) {
    if (statuses.has(status)) return group as Exclude<UnifiedWorkStatus, "unknown">;
  }
  return "unknown";
}

export function isUnifiedTerminal(status: UnifiedWorkStatus) {
  return status === "done" || status === "canceled";
}

