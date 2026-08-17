// 通知已读回执端点：把已读状态从浏览器本地存储迁移到服务端。
// 本机演示模式允许指定模拟用户名；生产环境一律使用认证身份。

import { authErrorResponse, currentUser } from "../../../server-auth.ts";
import { listReadNotificationIds, markNotificationsRead } from "../../../notification-receipts.ts";

function resolveUsername(
  auth: { localMode: boolean; user: { username: string } },
  requested: unknown,
): string {
  if (auth.localMode && typeof requested === "string" && requested.trim()) {
    return requested.trim();
  }
  return auth.user.username;
}

export async function GET(request: Request) {
  try {
    const auth = await currentUser(request);
    const username = resolveUsername(auth, new URL(request.url).searchParams.get("username"));
    const ids = await listReadNotificationIds(username);
    return Response.json({ username, ids });
  } catch (error) {
    return authErrorResponse(error, "读取通知已读状态失败");
  }
}

export async function POST(request: Request) {
  try {
    const auth = await currentUser(request);
    const body = (await request.json()) as { ids?: string[]; username?: string };
    const username = resolveUsername(auth, body.username);
    const ids = (Array.isArray(body.ids) ? body.ids : []).filter(
      (id): id is string => typeof id === "string" && id.length > 0,
    );
    await markNotificationsRead(username, ids);
    return Response.json({ ok: true, username, ids });
  } catch (error) {
    return authErrorResponse(error, "标记通知已读失败");
  }
}
