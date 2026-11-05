# 统一工作管理平台实施计划

日期：2026-11-05  
依据：`docs/superpowers/specs/2026-11-05-unified-work-management-platform-design.md`

## 实施原则

- 按四批交付，每一批均可独立回归和验收。
- 先增加纯函数、迁移和服务端约束，再切换界面数据源。
- 保留现有业务表和状态机，不进行一次性重写。
- 所有迁移幂等，历史数据不删除。
- 每个步骤先补测试，再接入业务入口。
- 每次代码提交前执行 `npm run check`，推送后检查 CI。

## 第一批：数据与权限治理

### 任务 1：统一状态映射

新增：

- `app/work-management/status.ts`
- `tests/work-management-status.test.mjs`

实现：

- 定义六类统一状态。
- 集中映射任务、子任务、教室、采购、白卡等现有状态。
- 未知状态显式返回 `unknown`，禁止静默当作完成。

验收：所有现有业务状态有测试覆盖；页面不再自行复制映射逻辑。

### 任务 2：统一活动执行进度

新增：

- `app/work-management/activity-progress.ts`
- `tests/activity-progress.test.mjs`

修改：

- `app/api/state/route.ts`
- `app/teacher-supervision/service.ts`
- 必要的活动展示组件

实现：

- 没有子任务的主任务作为叶子项。
- 有子任务时仅计算子任务。
- 完成 100%、进行中 50%、其他 0%。
- 返回完成数、执行项总数、待处理数和总体进度。
- 服务端返回活动时覆盖历史手工进度展示值，但暂时保留旧列以兼容迁移。

验收：活动中心、主席团和教师端对同一活动显示相同进度。

### 任务 3：收紧共享状态读取范围

修改：

- `app/api/state/route.ts`
- `app/notification-store.ts`
- 相关集成测试

实现：

- 教师、主席团、管理员读取全部监管数据。
- 部门负责人读取本部门任务、参与活动及本人通知。
- 干事读取本人主任务、本人子任务、必要的父任务、参与活动及本人通知。
- 通知在服务端按收件账号过滤。
- 归档资料按角色范围返回。

验收：普通成员无法通过接口读取无关部门任务或其他账号通知。

### 任务 4：负责人稳定编号准备

新增迁移并修改：

- `drizzle/0019_work_management_foundation.sql`
- `db/schema.ts`
- `platform/pg-schema.sql`
- `app/task-store.ts`

实现：

- tasks 增加 `assignee_account_id`、`owner_department_id`。
- subtasks 增加 `assignee_account_id`。
- 保留姓名字段作为历史快照和兼容显示。
- 通过账号用户名、姓名和部门进行保守回填；无法唯一匹配的记录保持空值并进入后续治理队列。

验收：新建任务写入稳定账号编号；旧数据可继续读取。

## 第二批：统一工作项与“我的工作”

### 任务 5：工作项表与统一事件表

新增：

- `app/work-management/types.ts`
- `app/work-management/store.ts`
- `app/work-management/projectors.ts`
- `drizzle/0020_unified_work_items.sql`
- 对应测试

实现 `work_items`、`work_item_events`，建立来源唯一约束、活动索引、部门索引、负责人索引和下一处理人索引。

### 任务 6：历史记录幂等补建

接入普通任务、子任务、教室申请、采购和白卡。白卡投影器强制清空活动编号；教室和采购保留可选活动关系。

### 任务 7：业务写入同步工作项

修改各业务 API，使每次创建和状态流转同步更新工作项、通知和审计。先使用数据库批处理保证原子性；自托管适配层补充显式事务能力。

### 任务 8：“我的工作”和部门统一待办

新增只返回当前账号可见工作项的 API 与首页组件，支持等待我处理、我发起、我负责、临期、逾期、退回/阻塞和最近完成。

## 第三批：活动全过程完善

### 任务 9：活动服务与时间轴

活动详情读取关联工作项，将教室、采购等服务显示在活动时间轴；白卡等禁止关联的类型不会出现。

### 任务 10：依赖、阻塞、重新指派与延期

新增完成后开始依赖、阻塞原因和协助对象；增加重新指派和修改期限操作，强制填写原因并记录前后值。

### 任务 11：活动模板

保存任务层级、类型、相对日期和部门角色；从模板创建活动时重新选择人员和实际日期。

### 任务 12：自动健康状态

根据逾期、阻塞、临期、长期未更新和关键事项计算正常、关注、有风险。

## 第四批：工作台整合与工程治理

### 任务 13：主席团协调中心

增加无负责人事项、部门负荷、长期等待、活动风险和下一里程碑。

### 任务 14：教师监管中心扩展

补充关联部门服务、延期原因、最终成果和统一工作项筛选，继续保持只读。

### 任务 15：统一详情组件

提取基本信息、状态流程、附件、成果和历史记录组件，逐步替换各工作台重复实现。

### 任务 16：工程整理

拆分 `app/page.tsx`、`app/views.tsx` 和大型工作台组件；统一服务端查询、错误响应和权限校验；完成全量回归、迁移演练和部署检查。

## 提交边界

建议提交顺序：

1. `feat: add unified status and progress model`
2. `fix: scope shared state by authenticated user`
3. `feat: add stable task ownership identifiers`
4. `feat: add unified work item index`
5. `feat: add personal and department work queues`
6. `feat: connect service requests to activity timeline`
7. `feat: add dependencies blockers and reassignment`
8. `feat: add activity templates and health status`
9. `refactor: unify management workspaces`

每个提交仅包含对应功能及测试，避免将当前工作区中其他未提交功能混入。
