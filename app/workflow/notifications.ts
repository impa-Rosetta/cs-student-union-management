// 通知草稿 → 通知记录：把角色/姓名/部门收件人解析为系统账号 username，
// 并去重、过滤操作者本人。纯函数，可单元测试。

import type { Role } from "./state-machine.ts";
import type { WorkflowNotificationDraft } from "./types.ts";

export interface AccountRef {
  username: string;
  name: string;
  role: Role;
  department: string;
  active: boolean;
}

export interface NotificationRecord {
  id: string;
  recipientUsernames: string[];
  title: string;
  detail: string;
  createdAt: string;
  level: "info" | "success" | "warning";
  entity: { type: string; id?: string | number; parentTaskId?: number };
}

export function resolveNotification(
  draft: WorkflowNotificationDraft,
  accounts: AccountRef[],
  actorUsername: string,
): NotificationRecord | null {
  const usernames = new Set<string>();
  for (const account of accounts) {
    if (!account.active) continue;
    if (draft.recipientNames?.includes(account.name)) usernames.add(account.username);
    if (
      draft.recipientRoles?.includes(account.role) &&
      (!draft.recipientDepartment || account.department === draft.recipientDepartment)
    ) {
      usernames.add(account.username);
    }
  }
  usernames.delete(actorUsername);
  if (usernames.size === 0) return null;

  return {
    id: `notice-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    recipientUsernames: [...usernames],
    title: draft.title,
    detail: draft.detail,
    createdAt: new Date().toISOString(),
    level: draft.level,
    entity: draft.entity,
  };
}
