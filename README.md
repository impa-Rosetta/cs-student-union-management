# 计算学院学生联盟管理系统

> **私有测试版 · v0.1.0-test** —— 本仓库为 Private，仅限内部测试，请勿公开、请勿开启公开 Pages。
> 演示账号与演示数据仅用于本机开发，**不得用于生产环境**；生产部署必须通过独立数据库初始化管理员。

面向学生联盟内部的活动、任务、组织成员、通知和资料归档系统。系统按管理员、主席、负责人、干事、教师五类身份提供不同工作台，支持主任务下发、负责人拆解、执行凭据、逐级验收、撤回修改和活动资料留存。

## 技术架构

- **前端**：React 19 + vinext（`app/page.tsx` 编排层、`app/views.tsx` 视图、`app/product-model.ts` 数据模型）
- **服务端**：服务端任务状态机（`app/workflow/`）+ 细粒度 API，所有状态转换在服务端校验并写审计事件
- **数据库**：关系表 + 手写迁移（`drizzle/*.sql`），当前运行在 Cloudflare D1，经 `DatabaseRepository` 端口可替换为 PostgreSQL（`platform/node-pg-db.mjs` + `platform/pg-schema.sql` 已备）；`db/schema.ts` 是 `drizzle-kit generate` 的表结构来源，运行时不再依赖 Drizzle ORM
- **附件**：对象存储，经 `ObjectStorage` 端口访问（当前 Cloudflare R2，可替换为 MinIO/COS）
- **身份认证**：平台身份头（Cloudflare Sites）或邮箱密码 + 服务端会话（自托管）
- **权限**：账号邮箱/会话映射 + 服务端角色校验，不依赖前端隐藏按钮

## 数据模型（关系表）

任务/子任务/活动/通知/归档/审计已从共享 JSON 迁移到关系表：

`terms`、`departments`、`members`、`app_accounts`、`tasks`、`subtasks`、`activities`、`notifications`、`notification_receipts`、`workflow_events`、`archive_records`、`sessions`、`task_type_schemas`、`system_config`、`research_items`、`workflow_records`；`shared_state` 已无业务读写（仅历史数据留存，各存储模块做一次性迁移）。

动态字段（`fields_json`）、附件（`attachments_json`）、部门列表（`departments_json`）等以 JSON 列承载，可进一步拆分。

## 本地运行

需要 Node.js `>=22.13.0`。

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。本地开发模式保留五个演示账号（admin/chair/leader/staff/teacher，密码 `123456`），用于快速验证完整工作流；演示密码不会用于线上部署。

## 检查与构建

```bash
npm run typecheck   # tsc --noEmit
npm test            # 构建 + 全量测试（单元 + 路由级集成 + 部署配置 + 迁移一致性，共 93 项）
npm run lint
npm run db:generate # 生成迁移（需正常终端；沙箱内可能因 spawn EPERM 失败）
```

测试说明：路由级集成测试 `tests/integration.test.mjs` 在 Node 内置 SQLite 上真实运行存储模块与 API 路由（身份头模拟五类账号，验证服务端越权）；`tests/helpers/register.mjs` 提供 `cloudflare:workers` 垫片。

数据库结构位于 `db/schema.ts`，迁移文件位于 `drizzle/`。`types/cloudflare-workers.d.ts` 是独立类型检查用的自包含声明。

## 首次部署（Cloudflare Sites 私有托管）

1. 将站点部署为 Private，不要发布为 Public。
2. 站点所有者首次访问时，系统会把该身份初始化为系统管理员。
3. 管理员在“账号与权限”中按测试者的实际登录邮箱建立账号并分配身份。
4. 在站点访问控制中加入相同邮箱后，测试者才能进入。
5. 先用少量测试数据完成验收，再导入真实成员和正式活动资料。

详细步骤和验收流程见 [部署与测试手册](docs/部署与测试手册.md)，五类账号的完整端到端验收见 [端到端验收清单](docs/端到端验收清单.md)。

## 国内自托管（阶段 4）

应用已抽象四个部署端口（`app/ports.ts`）：`IdentityProvider` / `DatabaseRepository` / `ObjectStorage` / `NotificationService`；组合根在 `app/platform.ts`。目标形态（Docker Compose + PostgreSQL + MinIO/COS + Caddy + 备份）见 [自托管部署方案](docs/自托管部署方案.md)，脚手架见 `Dockerfile`、`deploy/`、`scripts/backup.sh`。

## GitHub

仓库必须创建为 Private。不要提交 `.env`、本地数据库、构建产物或真实成员名单；这些路径已写入 `.gitignore`。

## 数据边界

- 关系表保存账号、组织成员、任务、活动、通知、审计与归档元数据。
- 对象存储保存任务凭据和归档附件的二进制内容。
- 浏览器只保存未发布草稿（通知已读状态已迁移到服务端回执表）。
- 所有接口需登录，不能通过绕过页面匿名访问。
