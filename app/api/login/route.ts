// 正式认证登录端点：邮箱 + 密码 → 校验密码哈希 → 建立服务端会话。

import { getDb } from "../../db.ts";
import { verifyPassword } from "../../password.ts";
import { createSession } from "../../session-store.ts";

const db = getDb();

const SESSION_COOKIE = "session";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 天

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!email || !password) return Response.json({ error: "请输入邮箱和密码" }, { status: 400 });

    const account = await db.prepare("SELECT id, password_hash, active FROM app_accounts WHERE lower(email) = ?")
      .bind(email)
      .first<{ id: number; password_hash: string | null; active: number }>();
    if (!account || !account.password_hash) {
      return Response.json({ error: "账号或密码不正确" }, { status: 401 });
    }
    if (!(await verifyPassword(password, account.password_hash))) {
      return Response.json({ error: "账号或密码不正确" }, { status: 401 });
    }
    if (!account.active) return Response.json({ error: "账号已停用" }, { status: 403 });

    const token = await createSession(account.id);
    const headers = new Headers();
    headers.set("Set-Cookie", `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`);
    return Response.json({ ok: true }, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "登录失败" }, { status: 500 });
  }
}
