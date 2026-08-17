// /api/state：前端启动时合并读取的业务状态（只读）。
// 所有业务数据均已迁移到关系表；写操作由细粒度端点负责。
// 历史 shared_state JSON 仅由各存储模块做一次性迁移，不再在此读取。

import { authErrorResponse, requireRole } from "../../server-auth.ts";
import { listAllSubtasks, listAllTasks } from "../../task-store.ts";
import { listNotifications } from "../../notification-store.ts";
import { listActivities } from "../../activity-store.ts";
import { listArchiveRecords } from "../../archive-store.ts";

export async function GET(request: Request) {
  try {
    await requireRole(request);
    const state: Record<string, unknown> = {};
    state.tasks = await listAllTasks();
    state.subtasks = await listAllSubtasks();
    state.notifications = await listNotifications();
    state.activities = await listActivities();
    state.archive = await listArchiveRecords();
    return Response.json({ state });
  } catch (error) {
    return authErrorResponse(error, "读取共享数据失败");
  }
}
