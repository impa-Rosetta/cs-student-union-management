export type WhiteCardTodoRecord = {
  id: string;
  title: string;
  status: string;
  submitterName: string;
  handlerUsername: string;
  handlerName: string;
  reviewerUsername: string;
  returnReason: string;
  updatedAt: string;
};

export function whiteCardDashboardTodos(records: WhiteCardTodoRecord[], user: { username: string; role: string; department: string }) {
  if (user.department === "新媒体中心") {
    return records.filter((item) => item.status === "待新媒体领取" || (item.status === "新媒体制作中" && item.handlerUsername === user.username));
  }
  if (user.department === "学习部") {
    return records.filter((item) => item.status === "待学习部修改");
  }
  if (user.role === "chair") {
    return records.filter((item) => item.status === "待主席审核" && item.reviewerUsername === user.username);
  }
  return [];
}

export function whiteCardTodoLabel(item: WhiteCardTodoRecord) {
  if (item.status === "待新媒体领取") return "领取并制作推文";
  if (item.status === "新媒体制作中") return "继续制作并提交审核";
  if (item.status === "待主席审核") return "审核公众号推文";
  if (item.status === "待学习部修改") return "修改白卡附件";
  return item.status;
}
