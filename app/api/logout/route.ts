// 正式认证登出端点：删除服务端会话并清除 Cookie。

import { deleteSession } from "../../session-store.ts";
import { getCookie } from "../../cookie.ts";

export async function POST(request: Request) {
  try {
    const token = getCookie(request, "session");
    if (token) await deleteSession(token);
  } catch {
    // 忽略会话删除失败，登出总是成功。
  }
  const headers = new Headers();
  headers.set("Set-Cookie", "session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0");
  return Response.json({ ok: true }, { headers });
}
