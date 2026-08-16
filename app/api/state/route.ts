import { env } from "cloudflare:workers";
import { authErrorResponse, requireRole } from "../../server-auth";

const keys = new Set(["tasks", "subtasks", "activities", "archive", "notifications", "systemConfig", "research", "workflows"]);

export async function GET(request: Request) {
  try {
    await requireRole(request);
    const result = await env.DB.prepare("SELECT key, value, revision, updated_at FROM shared_state").all<{ key: string; value: string; revision: number; updated_at: string }>();
    const state: Record<string, unknown> = {};
    const revisions: Record<string, number> = {};
    for (const row of result.results || []) {
      if (!keys.has(row.key)) continue;
      try { state[row.key] = JSON.parse(row.value); } catch { /* Ignore malformed legacy state. */ }
      revisions[row.key] = row.revision;
    }
    return Response.json({ state, revisions });
  } catch (error) {
    return authErrorResponse(error, "读取共享数据失败");
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireRole(request);
    const body = await request.json() as { key?: string; value?: unknown };
    if (!body.key || !keys.has(body.key)) return Response.json({ error: "不支持的数据类型" }, { status: 400 });
    const keyRoles: Partial<Record<string, Array<typeof auth.user.role>>> = {
      activities: ["admin", "chair"],
      tasks: ["admin", "chair", "leader", "staff"],
      subtasks: ["admin", "chair", "leader", "staff"],
      archive: ["admin", "chair", "leader", "staff", "teacher"],
      notifications: ["admin", "chair", "leader", "staff", "teacher"],
      systemConfig: ["admin"],
      research: ["admin", "chair"],
      workflows: ["admin", "chair", "leader", "staff", "teacher"],
    };
    if (!keyRoles[body.key]?.includes(auth.user.role)) return Response.json({ error: "当前账号不能修改此类数据" }, { status: 403 });
    const value = JSON.stringify(body.value);
    if (value.length > 4_000_000) return Response.json({ error: "数据体积过大" }, { status: 413 });
    await env.DB.prepare(`INSERT INTO shared_state (key, value, revision, updated_by, updated_at)
      VALUES (?, ?, 1, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, revision = shared_state.revision + 1,
      updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP`)
      .bind(body.key, value, auth.user.email).run();
    const row = await env.DB.prepare("SELECT revision, updated_at FROM shared_state WHERE key = ?").bind(body.key).first<{ revision: number; updated_at: string }>();
    return Response.json({ ok: true, revision: row?.revision || 1, updatedAt: row?.updated_at });
  } catch (error) {
    return authErrorResponse(error, "保存共享数据失败");
  }
}
