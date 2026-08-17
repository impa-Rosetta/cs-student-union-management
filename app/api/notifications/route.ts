// 通知创建端点：供前端（账号/活动/归档/指导等场景）把通知写入关系表。

import { authErrorResponse, requireRole } from "../../server-auth.ts";
import { insertNotifications } from "../../notification-store.ts";
import type { NotificationRecord } from "../../workflow/notifications.ts";

export async function POST(request: Request) {
  try {
    await requireRole(request);
    const body = (await request.json()) as {
      recipientUsernames?: string[];
      title?: string;
      detail?: string;
      level?: string;
      entity?: { type?: string; id?: string | number; parentTaskId?: number };
    };
    if (!body.title?.trim() || !body.detail?.trim()) {
      return Response.json({ error: "通知内容不完整" }, { status: 400 });
    }
    const recipients = Array.from(
      new Set(Array.isArray(body.recipientUsernames) ? body.recipientUsernames.filter((u): u is string => typeof u === "string" && u.length > 0) : []),
    );
    if (!recipients.length) return Response.json({ error: "缺少通知接收人" }, { status: 400 });
    const record: NotificationRecord = {
      id: `notice-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      recipientUsernames: recipients,
      title: body.title,
      detail: body.detail,
      createdAt: new Date().toISOString(),
      level: (body.level as NotificationRecord["level"]) || "info",
      entity: body.entity?.type
        ? { type: body.entity.type, id: body.entity.id, parentTaskId: body.entity.parentTaskId }
        : { type: "system" },
    };
    await insertNotifications([record]);
    return Response.json({ ok: true, record }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error, "创建通知失败");
  }
}
