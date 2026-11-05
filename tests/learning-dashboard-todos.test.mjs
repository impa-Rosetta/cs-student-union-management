import { test } from "node:test";
import assert from "node:assert/strict";
import { whiteCardDashboardTodos, whiteCardTodoLabel } from "../app/learning-department/dashboard-todos.ts";

const records = [
  {id:"waiting",title:"待领取",status:"待新媒体领取",submitterName:"学习部",handlerUsername:"",handlerName:"",reviewerUsername:"",returnReason:"",updatedAt:"2026-11-04"},
  {id:"mine",title:"我的制作",status:"新媒体制作中",submitterName:"学习部",handlerUsername:"media-a",handlerName:"甲",reviewerUsername:"",returnReason:"",updatedAt:"2026-11-04"},
  {id:"other",title:"他人制作",status:"新媒体制作中",submitterName:"学习部",handlerUsername:"media-b",handlerName:"乙",reviewerUsername:"",returnReason:"",updatedAt:"2026-11-04"},
  {id:"review",title:"我的审核",status:"待主席审核",submitterName:"学习部",handlerUsername:"media-a",handlerName:"甲",reviewerUsername:"chair-a",returnReason:"",updatedAt:"2026-11-04"},
  {id:"learn",title:"附件修改",status:"待学习部修改",submitterName:"学习部",handlerUsername:"media-a",handlerName:"甲",reviewerUsername:"chair-a",returnReason:"名单错误",updatedAt:"2026-11-04"},
  {id:"done",title:"已归档",status:"已通过归档",submitterName:"学习部",handlerUsername:"media-a",handlerName:"甲",reviewerUsername:"chair-a",returnReason:"",updatedAt:"2026-11-04"},
];

test("新媒体首页显示待领取和本人处理中白卡", () => {
  assert.deepEqual(whiteCardDashboardTodos(records,{username:"media-a",role:"staff",department:"新媒体中心"}).map(item=>item.id),["waiting","mine"]);
});

test("指定主席首页只显示分配给本人的待审核白卡", () => {
  assert.deepEqual(whiteCardDashboardTodos(records,{username:"chair-a",role:"chair",department:"主席团"}).map(item=>item.id),["review"]);
  assert.equal(whiteCardDashboardTodos(records,{username:"chair-b",role:"chair",department:"主席团"}).length,0);
});

test("学习部首页显示退回修改且完成项不再成为待办", () => {
  const todos=whiteCardDashboardTodos(records,{username:"learning",role:"staff",department:"学习部"});
  assert.deepEqual(todos.map(item=>item.id),["learn"]);
  assert.equal(whiteCardTodoLabel(todos[0]),"修改白卡附件");
});
