import { env } from "cloudflare:workers";

export type AppRole = "admin" | "chair" | "leader" | "staff" | "teacher";

export type AuthenticatedUser = {
  id: number;
  externalUserId: string;
  email: string;
  username: string;
  name: string;
  role: AppRole;
  department: string;
  title: string;
  scope: string;
  active: boolean;
};

type AccountRow = {
  id: number;
  external_user_id: string | null;
  email: string;
  username: string;
  name: string;
  role: AppRole;
  department: string;
  title: string;
  scope: string;
  active: number;
};

export class AuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function ensurePlatformSchema() {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS app_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      external_user_id TEXT,
      email TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin','chair','leader','staff','teacher')),
      department TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      scope TEXT NOT NULL DEFAULT '本人任务',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS shared_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 1,
      updated_by TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
  ]);
}

function isLocalRequest(request: Request) {
  const hostname = new URL(request.url).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1";
}

function toUser(row: AccountRow): AuthenticatedUser {
  return {
    id: row.id,
    externalUserId: row.external_user_id || "",
    email: row.email,
    username: row.username,
    name: row.name,
    role: row.role,
    department: row.department,
    title: row.title,
    scope: row.scope,
    active: Boolean(row.active),
  };
}

function decodedName(value: string | null) {
  if (!value) return "";
  try { return decodeURIComponent(value); } catch { return value; }
}

export async function currentUser(request: Request, options: { allowLocal?: boolean } = {}) {
  await ensurePlatformSchema();
  if (isLocalRequest(request) && options.allowLocal !== false) {
    return {
      localMode: true,
      user: {
        id: 0,
        externalUserId: "local-development",
        email: "local@localhost",
        username: "admin",
        name: "本地开发管理员",
        role: "admin" as AppRole,
        department: "系统管理",
        title: "系统管理员",
        scope: "全部数据",
        active: true,
      },
    };
  }

  const externalUserId = request.headers.get("oai-authenticated-user-id")?.trim() || "";
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() || "";
  const fullName = decodedName(request.headers.get("oai-authenticated-user-full-name")).trim();
  if (!externalUserId || !email) throw new AuthError(401, "请先通过站点身份认证");

  let row = await env.DB.prepare("SELECT * FROM app_accounts WHERE lower(email) = ? LIMIT 1").bind(email).first<AccountRow>();
  if (!row) {
    const count = await env.DB.prepare("SELECT COUNT(*) AS total FROM app_accounts").first<{ total: number }>();
    if (Number(count?.total || 0) === 0) {
      await env.DB.prepare(`INSERT OR IGNORE INTO app_accounts (external_user_id, email, username, name, role, department, title, scope, active)
        VALUES (?, ?, 'admin', ?, 'admin', '系统管理', '系统管理员', '全部数据', 1)`)
        .bind(externalUserId, email, fullName || email.split("@")[0]).run();
      row = await env.DB.prepare("SELECT * FROM app_accounts WHERE lower(email) = ? LIMIT 1").bind(email).first<AccountRow>();
      if (!row) throw new AuthError(403, "系统已由其他管理员完成初始化，请联系管理员开通账号");
    } else {
      throw new AuthError(403, "账号尚未由管理员开通");
    }
  }
  if (!row || !row.active) throw new AuthError(403, "账号已停用或尚未开通");
  if (row.external_user_id !== externalUserId) {
    await env.DB.prepare("UPDATE app_accounts SET external_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(externalUserId, row.id).run();
    row.external_user_id = externalUserId;
  }
  return { localMode: false, user: toUser(row) };
}

export async function requireRole(request: Request, roles?: AppRole[]) {
  const auth = await currentUser(request);
  if (roles && !roles.includes(auth.user.role)) throw new AuthError(403, "当前账号没有执行此操作的权限");
  return auth;
}

export function authErrorResponse(error: unknown, fallback: string) {
  if (error instanceof AuthError) return Response.json({ error: error.message }, { status: error.status });
  return Response.json({ error: error instanceof Error ? error.message : fallback }, { status: 500 });
}
