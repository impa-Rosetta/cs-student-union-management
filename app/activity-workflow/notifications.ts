import type { ActivityEntity } from "../activity-store.ts";
import type { WorkflowNotificationDraft } from "../workflow/types.ts";
import type { ActivityAction, ActivityStage } from "./state-machine.ts";

const actionLabels: Record<ActivityAction, string> = {
  submit: "已提交审批",
  approve: "已批准",
  reject: "已退回修改",
  start: "已开始执行",
  finish: "已进入总结",
  submitArchive: "已提交归档",
  archive: "已完成归档",
  reopen: "已重新打开",
};

export function activityNotificationDrafts(
  activity: ActivityEntity,
  action: ActivityAction,
  next: ActivityStage,
): WorkflowNotificationDraft[] {
  const id = activity.id;
  const name = String(activity.name || "未命名活动");
  const teacher = String(activity.teacher || "");
  const organizer = String(activity.organizer || "");
  const departments = Array.from(new Set([
    organizer,
    ...(Array.isArray(activity.departments) ? activity.departments.map(String) : []),
  ].filter(Boolean)));
  const base = {
    title: `活动${actionLabels[action]}`,
    detail: `“${name}”当前进入“${next}”阶段。`,
    entity: { type: "activity" as const, id },
  };

  if (action === "submit") {
    return [{
      ...base,
      level: "warning",
      recipientRoles: ["chair"],
      recipientNames: teacher && teacher !== "未指定" ? [teacher] : undefined,
    }];
  }

  if (action === "approve" || action === "reject") {
    return organizer ? [{
      ...base,
      level: action === "approve" ? "success" : "warning",
      recipientRoles: ["leader"],
      recipientDepartment: organizer,
    }] : [];
  }

  const drafts: WorkflowNotificationDraft[] = departments.map((department) => ({
    ...base,
    level: action === "archive" ? "success" : "info",
    recipientRoles: ["leader"],
    recipientDepartment: department,
  }));
  if ((action === "archive" || action === "reopen") && teacher && teacher !== "未指定") {
    drafts.push({ ...base, level: "info", recipientNames: [teacher] });
  }
  return drafts;
}
