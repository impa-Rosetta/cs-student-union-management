// 集成测试：在 Node 内置 SQLite 上真实运行存储模块 + API 路由。
//
// 覆盖两层：
//  1) 存储层：shared_state 历史 JSON 一次性迁移、种子默认值、upsert 落库；
//  2) API 路由层：通过身份头模拟五类账号，验证服务端权限校验真实生效。
//
// 说明：存储模块在模块顶层捕获 getDb() 的代理，测试与自托管可随时 setDb 切换；
//       为避免模块缓存 + 单例 setDb 在跨文件间的相互影响，本文件合并为单一测试套件。
//
// 运行：node --import ./tests/helpers/register.mjs --test-isolation=none --test tests/integration.test.mjs

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { setDb } from "../app/db.ts";
import { createNodeSqliteRepository } from "../platform/node-sqlite-db.mjs";

let repo;
let serverAuth;
let configStore;
let researchStore;
let workflowRecordStore;
let configRoute;
let researchRoute;
let taskTypesRoute;
let workflowRecordsRoute;
let stateRoute;
let auditRoute;
let transitionRoute;
let taskStore;
let accountsRoute;
let notificationsRoute;
let loginRoute;
let logoutRoute;
let sessionRoute;
let filesRoute;
let activitiesRoute;
let archiveRoute;
let notificationsReadRoute;
let setStorage;
let organizationRoute;

const USERS = [
  { email: "admin@demo.local", username: "admin", name: "管理员", role: "admin", department: "系统管理" },
  { email: "chair@demo.local", username: "chair", name: "主席", role: "chair", department: "主席团" },
  { email: "leader@demo.local", username: "leader", name: "负责人", role: "leader", department: "运维部" },
  { email: "staff@demo.local", username: "staff", name: "干事", role: "staff", department: "运维部" },
  { email: "teacher@demo.local", username: "teacher", name: "指导教师", role: "teacher", department: "指导教师" },
];

const VALID_CONFIG = { attachmentLimit: "50", academicYearMonth: "8", semesterBoundary: "按学院校历", notificationDays: "180", backupTime: "23:30" };

// 内存对象存储桩：实现 ObjectStorage 端口，用于附件上传/下载/删除闭环测试。
const mockStorage = {
  objects: new Map(),
  async put(key, value, options) {
    mockStorage.objects.set(key, { value, options });
    return {};
  },
  async get(key) {
    const object = mockStorage.objects.get(key);
    if (!object) return null;
    return { body: object.value, contentType: object.options?.contentType, metadata: object.options?.metadata };
  },
  async delete(key) {
    mockStorage.objects.delete(key);
  },
};

function requestFor(email, { method = "GET", path = "/api", body } = {}) {
  const headers = {
    "oai-authenticated-user-email": email,
    "oai-authenticated-user-id": `u-${email}`,
    "oai-authenticated-user-full-name": encodeURIComponent(email),
  };
  if (body !== undefined) headers["content-type"] = "application/json";
  return new Request(`https://union.example.com${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

before(async () => {
  repo = createNodeSqliteRepository(":memory:");
  setDb(repo);

  // 历史 shared_state 夹具：systemConfig / workflows 有历史数据，research 留空（走种子）。
  repo.exec(`CREATE TABLE shared_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    updated_by TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await repo.prepare("INSERT INTO shared_state (key, value) VALUES (?, ?)")
    .bind("systemConfig", JSON.stringify({ attachmentLimit: "99", academicYearMonth: "9", semesterBoundary: "自定义", notificationDays: "30", backupTime: "01:00" })).run();
  await repo.prepare("INSERT INTO shared_state (key, value) VALUES (?, ?)")
    .bind("workflows", JSON.stringify([{ kind: "guidance", conclusion: "同意推进", createdAt: "2026-01-01T00:00:00Z" }])).run();

  // 认证与账号表，再按五类账号预置。
  serverAuth = await import("../app/server-auth.ts");
  await serverAuth.ensurePlatformSchema();
  for (const user of USERS) {
    await repo.prepare("INSERT INTO app_accounts (email, username, name, role, department, active) VALUES (?, ?, ?, ?, ?, 1)")
      .bind(user.email, user.username, user.name, user.role, user.department).run();
  }

  configStore = await import("../app/config-store.ts");
  researchStore = await import("../app/research-store.ts");
  workflowRecordStore = await import("../app/workflow-record-store.ts");

  configRoute = await import("../app/api/config/route.ts");
  researchRoute = await import("../app/api/research/route.ts");
  taskTypesRoute = await import("../app/api/task-types/route.ts");
  workflowRecordsRoute = await import("../app/api/workflow-records/route.ts");
  stateRoute = await import("../app/api/state/route.ts");
  auditRoute = await import("../app/api/audit/route.ts");
  transitionRoute = await import("../app/api/workflow/transition/route.ts");
  taskStore = await import("../app/task-store.ts");
  accountsRoute = await import("../app/api/accounts/route.ts");
  notificationsRoute = await import("../app/api/notifications/route.ts");
  loginRoute = await import("../app/api/login/route.ts");
  logoutRoute = await import("../app/api/logout/route.ts");
  sessionRoute = await import("../app/api/session/route.ts");
  setStorage = (await import("../app/platform.ts")).setStorage;
  setStorage(mockStorage);
  filesRoute = await import("../app/api/files/route.ts");
  activitiesRoute = await import("../app/api/activities/route.ts");
  archiveRoute = await import("../app/api/archive/route.ts");
  notificationsReadRoute = await import("../app/api/notifications/read/route.ts");
  organizationRoute = await import("../app/api/organization/route.ts");
});

after(() => {
  setStorage(null);
  setDb(null);
  repo.close();
});

// ── 存储层 ──────────────────────────────────────────────

test("存储层：system_config 从 shared_state 一次性迁移历史配置", async () => {
  const config = await configStore.getSystemConfig();
  assert.equal(config.attachmentLimit, "99");
  assert.equal(config.semesterBoundary, "自定义");
});

test("存储层：research_items 无历史数据时返回 4 条默认需求", async () => {
  const items = await researchStore.listResearchItems();
  assert.equal(items.length, 4);
  assert.ok(items.some((item) => item.id === "venue"));
});

test("存储层：workflow_records 迁移历史留痕", async () => {
  const records = await workflowRecordStore.listWorkflowRecords();
  assert.equal(records.length, 1);
  assert.equal(records[0].kind, "guidance");
  assert.equal(records[0].conclusion, "同意推进");
});

// ── API 路由层（服务端越权）─────────────────────────────

test("API：未认证请求返回 401", async () => {
  const res = await configRoute.GET(new Request("https://union.example.com/api/config"));
  assert.equal(res.status, 401);
});

test("API：config GET 五类账号均可读", async () => {
  for (const user of USERS) {
    const res = await configRoute.GET(requestFor(user.email));
    assert.equal(res.status, 200, `${user.role} 应可读配置`);
  }
});

test("API：config PUT 仅 admin 可写，其余 403", async () => {
  const adminRes = await configRoute.PUT(requestFor("admin@demo.local", { method: "PUT", body: { config: VALID_CONFIG } }));
  assert.equal(adminRes.status, 200);
  for (const role of ["chair", "leader", "staff", "teacher"]) {
    const res = await configRoute.PUT(requestFor(`${role}@demo.local`, { method: "PUT", body: { config: VALID_CONFIG } }));
    assert.equal(res.status, 403, `${role} 写配置应被拒绝`);
  }
});

test("API：research POST 仅 admin/chair 可写，其余 403", async () => {
  const item = { id: "r-auth", name: "越权测试需求", requester: "主席团", status: "待调研", detail: "" };
  for (const role of ["admin", "chair"]) {
    const res = await researchRoute.POST(requestFor(`${role}@demo.local`, { method: "POST", body: { item } }));
    assert.equal(res.status, 200, `${role} 应可新增调研需求`);
  }
  for (const role of ["leader", "staff", "teacher"]) {
    const res = await researchRoute.POST(requestFor(`${role}@demo.local`, { method: "POST", body: { item: { ...item, id: `r-${role}` } } }));
    assert.equal(res.status, 403, `${role} 新增调研需求应被拒绝`);
  }
});

test("API：task-types POST 仅 admin 可写", async () => {
  const type = { name: "测试类型", note: "", icon: "file-text", fields: [] };
  const adminRes = await taskTypesRoute.POST(requestFor("admin@demo.local", { method: "POST", body: { type } }));
  assert.equal(adminRes.status, 200);
  for (const role of ["chair", "leader", "staff", "teacher"]) {
    const res = await taskTypesRoute.POST(requestFor(`${role}@demo.local`, { method: "POST", body: { type: { ...type, name: `x-${role}` } } }));
    assert.equal(res.status, 403, `${role} 写任务类型应被拒绝`);
  }
});

test("API：workflow-records POST 五类账号均可追加留痕", async () => {
  for (const user of USERS) {
    const res = await workflowRecordsRoute.POST(requestFor(user.email, { method: "POST", body: { record: { kind: "guidance", opinion: "ok", createdAt: new Date().toISOString() } } }));
    assert.equal(res.status, 200, `${user.role} 应可追加流程留痕`);
  }
});

test("API：audit GET 仅 admin/chair 可读，其余 403", async () => {
  for (const role of ["admin", "chair"]) {
    const res = await auditRoute.GET(requestFor(`${role}@demo.local`, { path: "/api/audit" }));
    assert.equal(res.status, 200, `${role} 应可读审计`);
  }
  for (const role of ["leader", "staff", "teacher"]) {
    const res = await auditRoute.GET(requestFor(`${role}@demo.local`, { path: "/api/audit" }));
    assert.equal(res.status, 403, `${role} 读审计应被拒绝`);
  }
});

test("API：state GET 五类账号均可读业务状态", async () => {
  for (const user of USERS) {
    const res = await stateRoute.GET(requestFor(user.email, { path: "/api/state" }));
    assert.equal(res.status, 200, `${user.role} 应可读状态`);
    const body = await res.json();
    assert.ok(Array.isArray(body.state.tasks));
    assert.ok(Array.isArray(body.state.subtasks));
  }
});

// ── 工作流主链路（任务状态机 + 持久化 + 通知 + 审计）──────────────

test("工作流：teacher 执行任务操作被路由层拒绝（403）", async () => {
  const res = await transitionRoute.POST(requestFor("teacher@demo.local", { method: "POST", body: { kind: "task", id: 1, action: "start" } }));
  assert.equal(res.status, 403);
});

test("工作流：非主席发布主任务被拒（403）", async () => {
  const res = await transitionRoute.POST(requestFor("leader@demo.local", { method: "POST", body: { kind: "task", action: "create", task: { id: 200, title: "越权发布", department: "运维部", person: "干事" } } }));
  assert.equal(res.status, 403);
});

test("工作流：主席发布主任务并落库", async () => {
  const res = await transitionRoute.POST(requestFor("chair@demo.local", { method: "POST", body: { kind: "task", action: "create", task: { id: 100, title: "集成测试主任务", department: "运维部", person: "干事", deadline: "2026-09-20" } } }));
  assert.equal(res.status, 200);
  const tasks = await taskStore.listAllTasks();
  const task = tasks.find((item) => item.id === 100);
  assert.ok(task, "主任务应已持久化");
  assert.equal(task.status, "待开始");
});

test("工作流：干事开始→提交→主席审核通过，状态随库推进", async () => {
  // 干事（执行人）开始
  let res = await transitionRoute.POST(requestFor("staff@demo.local", { method: "POST", body: { kind: "task", id: 100, action: "start" } }));
  assert.equal(res.status, 200);
  // 干事提交结办
  res = await transitionRoute.POST(requestFor("staff@demo.local", { method: "POST", body: { kind: "task", id: 100, action: "submit" } }));
  assert.equal(res.status, 200);
  // 主席终审通过
  res = await transitionRoute.POST(requestFor("chair@demo.local", { method: "POST", body: { kind: "task", id: 100, action: "approve" } }));
  assert.equal(res.status, 200);
  const tasks = await taskStore.listAllTasks();
  const task = tasks.find((item) => item.id === 100);
  assert.equal(task.status, "已完成");
});

test("工作流：越权操作被状态机拒绝（干事不能审核通过）", async () => {
  const res = await transitionRoute.POST(requestFor("staff@demo.local", { method: "POST", body: { kind: "task", id: 100, action: "approve" } }));
  assert.equal(res.status, 403);
});

// ── 子任务工作流（拆解 + 执行 + 验收 + 父子聚合）─────────────────

test("工作流：干事不能拆分子任务（403）", async () => {
  const res = await transitionRoute.POST(requestFor("staff@demo.local", { method: "POST", body: { kind: "subtask", action: "create", parentTaskId: 100, title: "越权拆解", assignee: "干事" } }));
  assert.equal(res.status, 403);
});

test("工作流：负责人拆分子任务→干事执行→负责人验收，父子状态聚合", async () => {
  // 主席新建一个待开始主任务作为子任务父任务
  let res = await transitionRoute.POST(requestFor("chair@demo.local", { method: "POST", body: { kind: "task", action: "create", task: { id: 101, title: "子任务父任务", department: "运维部", person: "干事" } } }));
  assert.equal(res.status, 200);

  // 负责人（运维部）拆解并分派给干事
  res = await transitionRoute.POST(requestFor("leader@demo.local", { method: "POST", body: { kind: "subtask", action: "create", parentTaskId: 101, title: "集成测试子任务", assignee: "干事" } }));
  assert.equal(res.status, 200);
  const created = (await taskStore.listAllSubtasks()).find((item) => item.parentTaskId === 101 && item.title === "集成测试子任务");
  assert.ok(created, "子任务应已持久化");
  assert.equal(created.status, "待开始");

  // 干事（执行人）开始
  res = await transitionRoute.POST(requestFor("staff@demo.local", { method: "POST", body: { kind: "subtask", id: created.id, action: "start" } }));
  assert.equal(res.status, 200);
  // 主任务应被自动聚合为进行中
  let tasks = await taskStore.listAllTasks();
  assert.equal(tasks.find((item) => item.id === 101).status, "进行中");

  // 干事提交验收
  res = await transitionRoute.POST(requestFor("staff@demo.local", { method: "POST", body: { kind: "subtask", id: created.id, action: "submit" } }));
  assert.equal(res.status, 200);

  // 负责人验收通过
  res = await transitionRoute.POST(requestFor("leader@demo.local", { method: "POST", body: { kind: "subtask", id: created.id, action: "approve" } }));
  assert.equal(res.status, 200);
  const subtasks = await taskStore.listAllSubtasks();
  assert.equal(subtasks.find((item) => item.id === created.id).status, "已完成");
});

test("工作流：干事不能验收子任务（403，仅负责人可验收）", async () => {
  const subtask = (await taskStore.listAllSubtasks()).find((item) => item.title === "集成测试子任务");
  const res = await transitionRoute.POST(requestFor("staff@demo.local", { method: "POST", body: { kind: "subtask", id: subtask.id, action: "approve" } }));
  assert.equal(res.status, 403);
});

// ── 账号与通知端点（服务端越权）────────────────────────────

test("API：accounts GET 五类账号均可读", async () => {
  for (const user of USERS) {
    const res = await accountsRoute.GET(requestFor(user.email, { path: "/api/accounts" }));
    assert.equal(res.status, 200, `${user.role} 应可读账号`);
  }
});

test("API：accounts POST 仅 admin 可创建，其余 403", async () => {
  const account = { email: "newstaff@demo.local", username: "newstaff", name: "新干事", role: "staff", department: "运维部", password: "123456" };
  const adminRes = await accountsRoute.POST(requestFor("admin@demo.local", { method: "POST", body: account }));
  assert.equal(adminRes.status, 201);
  for (const role of ["chair", "leader", "staff", "teacher"]) {
    const res = await accountsRoute.POST(requestFor(`${role}@demo.local`, { method: "POST", body: { ...account, email: `x-${role}@demo.local`, username: `x-${role}` } }));
    assert.equal(res.status, 403, `${role} 创建账号应被拒绝`);
  }
});

test("API：notifications POST 已登录可创建，未认证 401", async () => {
  const unauthenticated = await notificationsRoute.POST(new Request("https://union.example.com/api/notifications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ recipientUsernames: ["staff"], title: "x", detail: "y" }) }));
  assert.equal(unauthenticated.status, 401);
  for (const user of USERS) {
    const res = await notificationsRoute.POST(requestFor(user.email, { method: "POST", body: { recipientUsernames: ["staff"], title: "通知", detail: "内容" } }));
    assert.equal(res.status, 201, `${user.role} 应可创建通知`);
  }
});

// ── 正式认证链路（密码登录 → 会话 → 登出）───────────────────

function sessionRequest(path, token, { method = "GET", body } = {}) {
  const headers = token ? { Cookie: `session=${token}` } : {};
  if (body !== undefined) headers["content-type"] = "application/json";
  return new Request(`https://union.example.com${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

test("认证：密码登录建立会话，会话读取与登出闭环", async () => {
  // 管理员预建带密码的账号
  const createRes = await accountsRoute.POST(requestFor("admin@demo.local", { method: "POST", body: { email: "loginuser@demo.local", username: "loginuser", name: "登录用户", role: "staff", department: "运维部", password: "secret123" } }));
  assert.equal(createRes.status, 201);

  // 正确密码登录
  const loginRes = await loginRoute.POST(sessionRequest("/api/login", null, { method: "POST", body: { email: "loginuser@demo.local", password: "secret123" } }));
  assert.equal(loginRes.status, 200);
  const setCookie = loginRes.headers.get("set-cookie") || "";
  const token = (setCookie.match(/session=([^;]+)/) || [])[1];
  assert.ok(token, "登录应返回会话 Cookie");

  // 会话读取：携带 Cookie 应识别为 session 认证
  const sessionRes = await sessionRoute.GET(sessionRequest("/api/session", token));
  assert.equal(sessionRes.status, 200);
  const sessionBody = await sessionRes.json();
  assert.equal(sessionBody.authMethod, "session");
  assert.equal(sessionBody.user.email, "loginuser@demo.local");

  // 错误密码 401
  const badLogin = await loginRoute.POST(sessionRequest("/api/login", null, { method: "POST", body: { email: "loginuser@demo.local", password: "wrong" } }));
  assert.equal(badLogin.status, 401);

  // 不存在账号 401
  const missingLogin = await loginRoute.POST(sessionRequest("/api/login", null, { method: "POST", body: { email: "nobody@demo.local", password: "x" } }));
  assert.equal(missingLogin.status, 401);

  // 登出
  const logoutRes = await logoutRoute.POST(sessionRequest("/api/logout", token, { method: "POST" }));
  assert.equal(logoutRes.status, 200);

  // 登出后旧 Cookie 失效
  const afterLogout = await sessionRoute.GET(sessionRequest("/api/session", token));
  assert.equal(afterLogout.status, 401);
});

test("认证：停用账号无法登录（403）", async () => {
  await accountsRoute.POST(requestFor("admin@demo.local", { method: "POST", body: { email: "disabled@demo.local", username: "disabled", name: "停用账号", role: "staff", department: "运维部", password: "secret123", active: false } }));
  const res = await loginRoute.POST(sessionRequest("/api/login", null, { method: "POST", body: { email: "disabled@demo.local", password: "secret123" } }));
  assert.equal(res.status, 403);
});

// ── 业务数据端点 + 对象存储端口 + 通知回执 ─────────────────

test("API：activities POST 仅 admin/chair，其余 403", async () => {
  const activity = { id: "act-1", name: "集成测试活动", category: "综合活动", state: "策划中", date: "", day: "", month: "", time: "", location: "", organizer: "主席团", teacher: "", progress: 0, pending: 0, departments: ["运维部"], description: "", nextMilestone: "", milestones: [] };
  for (const role of ["admin", "chair"]) {
    const res = await activitiesRoute.POST(requestFor(`${role}@demo.local`, { method: "POST", body: { activity } }));
    assert.equal(res.status, 200, `${role} 应可创建活动`);
  }
  for (const role of ["leader", "staff", "teacher"]) {
    const res = await activitiesRoute.POST(requestFor(`${role}@demo.local`, { method: "POST", body: { activity: { ...activity, id: `act-${role}` } } }));
    assert.equal(res.status, 403, `${role} 创建活动应被拒绝`);
  }
});

test("API：archive POST 仅 admin/chair/leader，其余 403", async () => {
  const record = { id: "arc-1", academicYear: "2026-2027学年", semester: "上学期", activity: "集成测试活动", category: "活动方案", name: "方案.docx", owner: "主席团", time: "", size: "1 KB" };
  for (const role of ["admin", "chair", "leader"]) {
    const res = await archiveRoute.POST(requestFor(`${role}@demo.local`, { method: "POST", body: { record } }));
    assert.equal(res.status, 200, `${role} 应可归档`);
  }
  for (const role of ["staff", "teacher"]) {
    const res = await archiveRoute.POST(requestFor(`${role}@demo.local`, { method: "POST", body: { record: { ...record, id: `arc-${role}` } } }));
    assert.equal(res.status, 403, `${role} 归档应被拒绝`);
  }
});

test("附件：上传→下载→删除闭环（ObjectStorage 端口）", async () => {
  const file = new File(["hello"], "说明.txt", { type: "text/plain" });
  const form = new FormData();
  form.append("file", file);
  const uploadReq = new Request("https://union.example.com/api/files", {
    method: "POST",
    headers: { "oai-authenticated-user-email": "chair@demo.local", "oai-authenticated-user-id": "u-chair@demo.local" },
    body: form,
  });
  const uploadRes = await filesRoute.POST(uploadReq);
  assert.equal(uploadRes.status, 201);
  const { attachment } = await uploadRes.json();
  assert.ok(attachment.key, "上传应返回对象 key");
  assert.equal(attachment.name, "说明.txt");

  const downloadRes = await filesRoute.GET(requestFor("chair@demo.local", { path: `/api/files?key=${encodeURIComponent(attachment.key)}` }));
  assert.equal(downloadRes.status, 200);
  assert.match(downloadRes.headers.get("content-disposition") || "", /filename/);

  const delRes = await filesRoute.DELETE(requestFor("chair@demo.local", { method: "DELETE", path: `/api/files?key=${encodeURIComponent(attachment.key)}` }));
  assert.equal(delRes.status, 200);

  const afterDelete = await filesRoute.GET(requestFor("chair@demo.local", { path: `/api/files?key=${encodeURIComponent(attachment.key)}` }));
  assert.equal(afterDelete.status, 404);
});

test("API：通知已读回执读写闭环", async () => {
  const markRes = await notificationsReadRoute.POST(requestFor("staff@demo.local", { method: "POST", body: { ids: ["n1", "n2"] } }));
  assert.equal(markRes.status, 200);
  const getRes = await notificationsReadRoute.GET(requestFor("staff@demo.local", { path: "/api/notifications/read" }));
  assert.equal(getRes.status, 200);
  const body = await getRes.json();
  assert.deepEqual([...body.ids].sort(), ["n1", "n2"]);
});

// ── 组织与成员端点（terms/departments/members）────────────────

test("组织：GET 五类账号均可读，返回届次/部门/成员快照", async () => {
  for (const user of USERS) {
    const res = await organizationRoute.GET(requestFor(user.email, { path: "/api/organization" }));
    assert.equal(res.status, 200, `${user.role} 应可读组织数据`);
  }
  const body = await (await organizationRoute.GET(requestFor("chair@demo.local", { path: "/api/organization" }))).json();
  assert.ok(Array.isArray(body.terms) && body.terms.length > 0, "应返回届次");
  assert.ok(Array.isArray(body.departments) && body.departments.length > 0, "应返回部门");
  assert.ok(Array.isArray(body.members) && body.members.length > 0, "应返回成员");
  assert.ok(body.selectedTermId, "应返回当前届次 id");
});

test("组织：新增成员仅 admin/chair，其余 403", async () => {
  const snapshot = await (await organizationRoute.GET(requestFor("chair@demo.local", { path: "/api/organization" }))).json();
  const member = { termId: snapshot.selectedTermId, name: "集成测试成员", position: "干事", roleLevel: "staff" };
  for (const role of ["admin", "chair"]) {
    const res = await organizationRoute.POST(requestFor(`${role}@demo.local`, { method: "POST", body: member }));
    assert.equal(res.status, 201, `${role} 应可新增成员`);
  }
  for (const role of ["leader", "staff", "teacher"]) {
    const res = await organizationRoute.POST(requestFor(`${role}@demo.local`, { method: "POST", body: member }));
    assert.equal(res.status, 403, `${role} 新增成员应被拒绝`);
  }
});

test("组织：更新/移除成员仅 admin/chair，其余 403", async () => {
  const snapshot = await (await organizationRoute.GET(requestFor("chair@demo.local", { path: "/api/organization" }))).json();
  const target = snapshot.members.find((m) => m.name === "集成测试成员") || snapshot.members[0];
  assert.ok(target, "应有可操作的成员");

  const update = { id: target.id, name: target.name, position: target.position, roleLevel: target.roleLevel, termId: target.termId, departmentId: target.departmentId };
  assert.equal((await organizationRoute.PUT(requestFor("admin@demo.local", { method: "PUT", body: update }))).status, 200);
  assert.equal((await organizationRoute.PUT(requestFor("staff@demo.local", { method: "PUT", body: update }))).status, 403);

  assert.equal((await organizationRoute.DELETE(requestFor("admin@demo.local", { method: "DELETE", path: `/api/organization?id=${target.id}` }))).status, 200);
  assert.equal((await organizationRoute.DELETE(requestFor("staff@demo.local", { method: "DELETE", path: `/api/organization?id=${target.id}` }))).status, 403);
});

test("组织：createTerm 仅 admin/chair，其余 403", async () => {
  const names = { admin: "2027-2028届", chair: "2028-2029届" };
  for (const role of ["admin", "chair"]) {
    const res = await organizationRoute.POST(requestFor(`${role}@demo.local`, { method: "POST", body: { action: "createTerm", name: names[role], startYear: 2027, endYear: 2028 } }));
    assert.equal(res.status, 201, `${role} 应可创建届次`);
  }
  for (const role of ["leader", "staff", "teacher"]) {
    const res = await organizationRoute.POST(requestFor(`${role}@demo.local`, { method: "POST", body: { action: "createTerm", name: `2029-2030届-${role}`, startYear: 2029, endYear: 2030 } }));
    assert.equal(res.status, 403, `${role} 创建届次应被拒绝`);
  }
});
