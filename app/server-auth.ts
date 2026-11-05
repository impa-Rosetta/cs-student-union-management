import { getDb } from "./db.ts";
import { platformIdentityFromHeaders } from "./platform-identity.ts";
import { getCookie } from "./cookie.ts";
import { getSessionUser } from "./session-store.ts";
import { hashPassword } from "./password.ts";

const db = getDb();

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
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function ensurePlatformSchema() {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS app_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      external_user_id TEXT,
      email TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin','chair','leader','staff','teacher')),
      department TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      scope TEXT NOT NULL DEFAULT '本人任务',
      password_hash TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS shared_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 1,
      updated_by TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
  ]);
  // 兼容旧库：补充 password_hash 列。
  const columns = await db.prepare("PRAGMA table_info(app_accounts)").all<{ name: string }>();
  if (!columns.results.some((column) => column.name === "password_hash")) {
    await db.prepare("ALTER TABLE app_accounts ADD COLUMN password_hash TEXT").run();
  }
}

function isLocalRequest(request: Request) {
  const hostname = new URL(request.url).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1";
}

const LOCAL_TEST_ACCOUNTS: Array<{ email: string; username: string; name: string; role: AppRole; department: string; title: string; scope: string }> = [
  { email: "admin@demo.local", username: "admin", name: "系统管理员", role: "admin", department: "系统管理", title: "系统管理员", scope: "系统配置与基础数据" },
  { email: "chair@demo.local", username: "chair", name: "徐介翰", role: "chair", department: "主席团", title: "主席", scope: "当前届次全部业务" },
  { email: "leader@demo.local", username: "leader", name: "陈雨桐", role: "leader", department: "科创中心", title: "科创中心负责人", scope: "科创中心及相关任务" },
  { email: "staff@demo.local", username: "staff", name: "周子轩", role: "staff", department: "科创中心", title: "科创中心干事", scope: "本人任务" },
  { email: "office@demo.local", username: "office", name: "办公室测试人员", role: "leader", department: "办公室", title: "办公室负责人", scope: "办公室及相关任务" },
  { email: "learning@demo.local", username: "learning", name: "学习部测试人员", role: "staff", department: "学习部", title: "学习部干事", scope: "本人任务" },
  { email: "media@demo.local", username: "media", name: "新媒体测试人员", role: "staff", department: "新媒体中心", title: "新媒体干事", scope: "本人任务" },
  { email: "teacher@demo.local", username: "teacher", name: "王明远", role: "teacher", department: "计算学院", title: "指导教师", scope: "全部业务只读" },
];

export async function ensureLocalDevelopmentAccounts(request: Request) {
  if (!isLocalRequest(request)) return;
  await ensurePlatformSchema();
  for (const account of LOCAL_TEST_ACCOUNTS) {
    const existing = await db.prepare("SELECT id, password_hash FROM app_accounts WHERE lower(email) = ? OR username = ? LIMIT 1")
      .bind(account.email, account.username).first<{ id: number; password_hash: string | null }>();
    if (existing) {
      if (!existing.password_hash) {
        await db.prepare("UPDATE app_accounts SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
          .bind(await hashPassword("123456"), existing.id).run();
      }
      continue;
    }
    await db.prepare(`INSERT INTO app_accounts (email,username,name,role,department,title,scope,password_hash,active)
      VALUES (?,?,?,?,?,?,?,?,1)`)
      .bind(account.email, account.username, account.name, account.role, account.department, account.title, account.scope, await hashPassword("123456")).run();
  }
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

export async function currentUser(request: Request) {
  await ensurePlatformSchema();
  // 1) 服务端会话 Cookie（自托管密码登录）。localhost 同样必须建立真实会话，
  // 不再通过本地管理员回退绕过角色边界。
  const sessionToken = getCookie(request, "session");
  if (sessionToken) {
    const sessionUser = await getSessionUser(sessionToken);
    if (sessionUser && sessionUser.active) {
      return {
        localMode: false,
        authMethod: "session" as const,
        user: {
          id: sessionUser.id,
          externalUserId: "",
          email: sessionUser.email,
          username: sessionUser.username,
          name: sessionUser.name,
          role: sessionUser.role as AppRole,
          department: sessionUser.department,
          title: sessionUser.title,
          scope: sessionUser.scope,
          active: sessionUser.active,
        },
      };
    }
  }

  if (isLocalRequest(request)) throw new AuthError(401, "请先登录");

  // 2) 平台身份头（Cloudflare Sites）。
  const identity = platformIdentityFromHeaders(request.headers);
  if (!identity) throw new AuthError(401, "请先登录");
  const { externalUserId, email, fullName } = identity;

  let row = await db.prepare("SELECT * FROM app_accounts WHERE lower(email) = ? LIMIT 1").bind(email).first<AccountRow>();
  if (!row) {
    const count = await db.prepare("SELECT COUNT(*) AS total FROM app_accounts").first<{ total: number }>();
    if (Number(count?.total || 0) === 0) {
      await db.prepare(`INSERT OR IGNORE INTO app_accounts (external_user_id, email, username, name, role, department, title, scope, active)
        VALUES (?, ?, 'admin', ?, 'admin', '系统管理', '系统管理员', '全部数据', 1)`)
        .bind(externalUserId, email, fullName || email.split("@")[0]).run();
      row = await db.prepare("SELECT * FROM app_accounts WHERE lower(email) = ? LIMIT 1").bind(email).first<AccountRow>();
      if (!row) throw new AuthError(403, "系统已由其他管理员完成初始化，请联系管理员开通账号");
    } else {
      throw new AuthError(403, "账号尚未由管理员开通");
    }
  }
  if (!row || !row.active) throw new AuthError(403, "账号已停用或尚未开通");
  if (row.external_user_id !== externalUserId) {
    await db.prepare("UPDATE app_accounts SET external_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(externalUserId, row.id).run();
    row.external_user_id = externalUserId;
  }
  return { localMode: false, authMethod: "identity" as const, user: toUser(row) };
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
