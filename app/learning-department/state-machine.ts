export type WhiteCardStatus = "待新媒体领取" | "新媒体制作中" | "待主席审核" | "待学习部修改" | "已撤回" | "已通过归档";
export type WhiteCardAction = "withdraw" | "claim" | "release" | "returnLearning" | "submitReview" | "approve" | "returnMedia" | "resubmit";

const transitions: Record<WhiteCardStatus, Partial<Record<WhiteCardAction, WhiteCardStatus>>> = {
  待新媒体领取: { withdraw: "已撤回", claim: "新媒体制作中" },
  新媒体制作中: { release: "待新媒体领取", returnLearning: "待学习部修改", submitReview: "待主席审核" },
  待主席审核: { approve: "已通过归档", returnMedia: "新媒体制作中", returnLearning: "待学习部修改" },
  待学习部修改: { resubmit: "待新媒体领取" },
  已撤回: { resubmit: "待新媒体领取" },
  已通过归档: {},
};

export function whiteCardTransition(status: WhiteCardStatus, action: WhiteCardAction) {
  const next = transitions[status]?.[action];
  if (!next) throw new Error(`状态“${status}”不能执行该操作`);
  return next;
}

export function isLearningMember(user: { role: string; department: string }) {
  return user.role === "admin" || user.department === "学习部";
}

export function isMediaMember(user: { role: string; department: string }) {
  return user.role === "admin" || user.department === "新媒体中心";
}
