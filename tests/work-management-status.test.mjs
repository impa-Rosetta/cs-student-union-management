import test from "node:test";
import assert from "node:assert/strict";
import { isUnifiedTerminal, toUnifiedWorkStatus } from "../app/work-management/status.ts";

test("maps native workflow statuses to unified management groups", () => {
  assert.equal(toUnifiedWorkStatus("待开始"), "pending");
  assert.equal(toUnifiedWorkStatus("新媒体制作中"), "in_progress");
  assert.equal(toUnifiedWorkStatus("等待外部办理"), "waiting");
  assert.equal(toUnifiedWorkStatus("待主席审核"), "review");
  assert.equal(toUnifiedWorkStatus("已通过归档"), "done");
  assert.equal(toUnifiedWorkStatus("已撤回"), "canceled");
  assert.equal(toUnifiedWorkStatus("从未登记的状态"), "unknown");
});

test("only completed and canceled groups are terminal", () => {
  assert.equal(isUnifiedTerminal("done"), true);
  assert.equal(isUnifiedTerminal("canceled"), true);
  assert.equal(isUnifiedTerminal("review"), false);
  assert.equal(isUnifiedTerminal("unknown"), false);
});

test("covers statuses currently used by department workflows", () => {
  const statuses = [
    "草稿", "待办公室审核", "待补充材料", "办理中", "借用成功", "借用失败", "已取消", "已归档",
    "收集中", "待汇总", "已生成", "未填写", "已提交", "待修改", "已确认",
    "待生活部审核", "待采购", "已采购", "待办公室报销", "待整改", "待复查",
    "待整理", "待新媒体发布", "招领中", "待核验", "已归还", "无人认领归档",
    "待组织部审核", "待申请人修改", "待主席团确认", "待组织部复核", "已生效", "已驳回",
    "待结果确认", "待新媒体领取", "新媒体制作中", "待主席审核", "待学习部修改", "已撤回", "已通过归档",
  ];
  assert.deepEqual(statuses.filter((status) => toUnifiedWorkStatus(status) === "unknown"), []);
});

