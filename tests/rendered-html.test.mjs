import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the authenticated student union shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>学生联盟管理系统 \| 计算学院<\/title>/i);
  assert.match(html, /学生联盟管理系统/);
  assert.doesNotMatch(html, /中台/);
  assert.match(html, /正在连接系统/);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site/);
});

test("keeps lightweight workflow and supervision rules in the product", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  for (const mode of ["快捷办结", "凭据留痕", "负责人确认"]) {
    assert.match(page, new RegExp(mode));
  }
  assert.match(page, /登录工作台/);
  assert.match(page, /username: "chair"/);
  assert.match(page, /username: "leader"/);
  assert.match(page, /username: "admin"/);
  assert.match(page, /负责人直接办结/);
  assert.match(page, /提交主席审核/);
  assert.match(page, /审核通过/);
  assert.match(page, /退回修改/);
  assert.match(page, /union-demo-session-v1/);
  assert.doesNotMatch(page, /部门对接/);
  assert.doesNotMatch(page, /union-coordination/);
  assert.match(page, /子任务已开始，主任务自动进入进行中/);
  assert.match(page, /parentTaskId/);
  assert.match(page, /主席直接交办给你/);
  assert.match(page, /执行分工/);
  assert.match(page, /departmentExecutors/);
  assert.match(page, /TextEntryModal/);
  assert.doesNotMatch(page, /window\.prompt/);
  assert.match(page, /ConfirmActionModal/);
  assert.doesNotMatch(page, /\bconfirm\(/);
  assert.match(page, /chairsExpanded/);
  assert.match(page, /expandedDepartments/);
  assert.match(page, /学生联盟主席团/);
  assert.match(page, /分管主席：/);
  assert.match(page, /成员管理/);
  assert.doesNotMatch(page, /逐级展开组织目录/);
  assert.match(page, /member-profile-modal/);
  assert.match(page, /成员信息卡/);
  assert.match(page, /当前为查看模式/);
  assert.match(page, /showTaskActions/);
  assert.match(page, /organizationDirectory/);
  assert.match(page, /draftAssignees/);
  assert.match(page, /内容已自动保存/);
  assert.match(page, /requestTaskStatus/);
  assert.match(page, /openNotification/);
  assert.match(page, /unreadNotificationCount/);
  assert.match(page, /persistSharedState\("notifications"/);
  assert.match(page, /union-notification-read-v1:/);
  assert.match(page, /pushNotification/);
  assert.match(page, /resolveUsernames/);
  assert.match(page, /部门结办等待审核/);
  assert.match(page, /子任务等待验收/);
  assert.match(page, /主任务审核通过/);
  assert.match(page, /撤销子任务/);
  assert.match(page, /withdrawSubmission/);
  assert.match(page, /withdrawMainForLeader/);
  assert.match(page, /执行人已撤回提交/);
  assert.match(page, /负责人已撤回结办申请/);
  assert.match(page, /item\.entity\?\.id === draft\.entity\?\.id/);
  assert.doesNotMatch(page, /收到新的跨部门任务/);
  assert.match(page, /activityCatalog/);
  assert.match(page, /本学期活动全景/);
  assert.match(page, /activity-card-grid/);
  assert.match(page, /activity-card-date/);
  assert.match(page, /\{activity\.date\}/);
  assert.match(page, /进入完整执行台/);
  assert.match(page, /准备新任务/);
  assert.match(page, /function ChairOverview/);
  assert.match(page, /全局监督工作台/);
  assert.match(page, /eventWorkspaceOpen/);
  assert.match(page, /返回主席总览/);
  assert.match(page, /type UserRole = "admin"/);
  assert.match(page, /系统管理总览/);
  assert.match(page, /账号与权限/);
  assert.match(page, /审计日志/);
  assert.match(page, /指导教师工作台/);
  assert.match(page, /非活动临时事项/);
  assert.doesNotMatch(page, /先确定任务所属范围/);
  assert.match(page, /activityName: ""/);
  assert.match(page, /function ArchiveWorkspace/);
  assert.match(page, /2026-2027学年/);
  assert.match(page, /每年8月切换学年/);
  assert.match(page, /function AccountsWorkspace/);
  assert.match(page, /function AuditWorkspace/);
  assert.match(page, /function SettingsWorkspace/);
  assert.match(page, /persistSharedState\("activities"/);
  assert.match(page, /persistSharedState\("archive"/);
  assert.match(page, /学生联盟审计日志\.csv/);
  assert.doesNotMatch(page, /先选择活动，再进入独立工作空间/);
  assert.doesNotMatch(page, /这是演示附件/);
  assert.match(page, /归属学期/);
  assert.doesNotMatch(page, /老师/);
  assert.doesNotMatch(page, /aria-label="更新任务状态"/);
  assert.match(page, /method: "DELETE"/);
  assert.match(page, /accept="image\/\*/);
  assert.match(css, /control-mode-grid/);
  assert.match(css, /archive-browser/);
  assert.match(css, /semester-switch/);
  assert.match(css, /archive-file-table/);
  assert.match(css, /chair-subtask-list/);
  assert.match(css, /direct-assignment/);
  assert.match(css, /org-manage-panel/);
  assert.match(css, /org-department-cards/);
  assert.match(css, /member-profile-modal/);
  assert.match(css, /drawer-actions\.view-mode/);
  assert.match(css, /autosave-note/);
  assert.match(css, /notification-panel > div > button\.read/);
  assert.match(css, /activity-card-grid/);
  assert.match(css, /\.activity-card-date/);
  assert.match(css, /activity-detail-grid/);
  assert.match(css, /chair-summary-strip/);
  assert.match(css, /chair-department-pulse/);
  assert.match(css, /task-scope-picker/);
  assert.match(css, /admin-layout/);
  assert.match(css, /permission-table/);
});

test("protects hosted data with platform identity and server roles", async () => {
  const [auth, identity, state, files, accounts] = await Promise.all([
    readFile(new URL("../app/server-auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/platform-identity.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/state/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/files/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/accounts/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(identity, /oai-authenticated-user-id/);
  assert.match(identity, /oai-authenticated-user-email/);
  assert.match(identity, /email:\$\{email\}/);
  assert.match(auth, /INSERT OR IGNORE INTO app_accounts/);
  assert.match(state, /shared_state/);
  assert.match(state, /keyRoles/);
  assert.match(files, /requireRole/);
  assert.match(accounts, /\["admin"\]/);
});
