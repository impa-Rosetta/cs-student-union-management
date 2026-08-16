import { env } from "cloudflare:workers";
import { authErrorResponse, requireRole, type AppRole } from "../../server-auth";

const roles = new Set<AppRole>(["admin", "chair", "leader", "staff", "teacher"]);
type AccountBody = { id?: number; email?: string; username?: string; name?: string; role?: AppRole; department?: string; title?: string; scope?: string; active?: boolean };

export async function GET(request: Request) {
  try {
    await requireRole(request);
    const rows = await env.DB.prepare("SELECT id, email, username, name, role, department, title, scope, active FROM app_accounts ORDER BY active DESC, role, name").all();
    return Response.json({ accounts: (rows.results || []).map((row) => ({ ...row, active: Boolean(row.active) })) });
  } catch (error) {
    return authErrorResponse(error, "读取账号失败");
  }
}

export async function POST(request: Request) {
  try {
    await requireRole(request, ["admin"]);
    const body = await request.json() as AccountBody;
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    const username = String(body.username || email).trim();
    if (!email.includes("@") || !name || !username || !body.role || !roles.has(body.role)) return Response.json({ error: "请完整填写邮箱、姓名和身份" }, { status: 400 });
    await env.DB.prepare(`INSERT INTO app_accounts (email, username, name, role, department, title, scope, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(email, username, name, body.role, String(body.department || ""), String(body.title || ""), String(body.scope || "本人任务"), body.active === false ? 0 : 1).run();
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error && error.message.includes("UNIQUE") ? "邮箱或账号已经存在" : "创建账号失败";
    return authErrorResponse(error instanceof Error && error.message.includes("UNIQUE") ? new Error(message) : error, message);
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireRole(request, ["admin"]);
    const body = await request.json() as AccountBody;
    if (!body.id || !body.email?.includes("@") || !body.name?.trim() || !body.role || !roles.has(body.role)) return Response.json({ error: "账号信息不完整" }, { status: 400 });
    if (body.id === auth.user.id && body.active === false) return Response.json({ error: "不能停用当前登录账号" }, { status: 400 });
    await env.DB.prepare(`UPDATE app_accounts SET email = ?, username = ?, name = ?, role = ?, department = ?, title = ?, scope = ?, active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(body.email.trim().toLowerCase(), String(body.username || body.email).trim(), body.name.trim(), body.role, String(body.department || ""), String(body.title || ""), String(body.scope || "本人任务"), body.active === false ? 0 : 1, body.id).run();
    return Response.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error, "更新账号失败");
  }
}
