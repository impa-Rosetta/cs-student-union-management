// Cloudflare 平台的适配层实现（组合根）。
// 国内自托管时新增一个 node-platform.ts 提供 PostgreSQL/S3 实现，并在此切换。

import { env } from "cloudflare:workers";
import { getDb } from "./db.ts";
import { currentUser } from "./server-auth.ts";
import { insertNotifications } from "./notification-store.ts";
import { listReadNotificationIds, markNotificationsRead } from "./notification-receipts.ts";
import type { NotificationRecord } from "./workflow/notifications.ts";
import type {
  IdentityProvider,
  NotificationService,
  ObjectStorage,
  Platform,
} from "./ports.ts";

const storage: ObjectStorage = {
  put(key, value, options) {
    return env.FILES.put(key, value, options ? {
      httpMetadata: { contentType: options.contentType },
      customMetadata: options.metadata,
    } : undefined);
  },
  async get(key) {
    const object = await env.FILES.get(key);
    if (!object) return null;
    return {
      body: object.body,
      contentType: object.httpMetadata?.contentType,
      metadata: object.customMetadata as Record<string, string> | undefined,
    };
  },
  delete(key) {
    return env.FILES.delete(key);
  },
};

let storageOverride: ObjectStorage | null = null;

/**
 * 注入自定义 ObjectStorage（用于 Node 自托管或测试）。
 * 传入 null 恢复 Cloudflare R2 默认实现。
 */
export function setStorage(repo: ObjectStorage | null): void {
  storageOverride = repo;
}

const identity: IdentityProvider = {
  async currentUser(request) {
    const auth = await currentUser(request);
    return {
      localMode: auth.localMode,
      id: auth.user.id,
      username: auth.user.username,
      name: auth.user.name,
      email: auth.user.email,
      role: auth.user.role,
      department: auth.user.department,
      title: auth.user.title,
      scope: auth.user.scope,
      active: auth.user.active,
    };
  },
};

const notifications: NotificationService = {
  async create(inputs) {
    const records: NotificationRecord[] = inputs.map((input) => ({
      id: `notice-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      recipientUsernames: input.recipientUsernames,
      title: input.title,
      detail: input.detail,
      createdAt: new Date().toISOString(),
      level: (input.level as NotificationRecord["level"]) || "info",
      entity: input.entity?.type ? { type: input.entity.type, id: input.entity.id, parentTaskId: input.entity.parentTaskId } : { type: "system" },
    }));
    await insertNotifications(records);
  },
  listReadIds: listReadNotificationIds,
  markRead: markNotificationsRead,
};

export function getPlatform(): Platform {
  return { db: getDb(), storage: storageOverride ?? storage, identity, notifications };
}
