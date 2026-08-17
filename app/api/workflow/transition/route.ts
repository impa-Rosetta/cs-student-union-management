// 细粒度工作流操作端点：在服务端完成鉴权、状态机校验、父子聚合、通知与落库。
// 主任务/子任务已迁移到关系表 tasks / subtasks；通知暂存 shared_state，后续迁移。

import { getDb } from "../../../db.ts";
import { authErrorResponse, requireRole, type AppRole } from "../../../server-auth.ts";
import { applySubtaskAction, createSubtask, type SubtaskActionName } from "../../../workflow/apply-subtask-action.ts";
import { applyTaskAction, createTask, type TaskActionName } from "../../../workflow/apply-task-action.ts";
import { resolveNotification, type NotificationRecord } from "../../../workflow/notifications.ts";
import { recordWorkflowEvent } from "../../../workflow-events.ts";
import { changedById, listAllSubtasks, listAllTasks, upsertSubtasks, upsertTasks, type SubtaskEntity, type TaskEntity } from "../../../task-store.ts";
import { insertNotifications } from "../../../notification-store.ts";
import type {
  WorkflowActor,
  WorkflowAttachment,
  WorkflowMutationResult,
  WorkflowSubtask,
  WorkflowTask,
} from "../../../workflow/types.ts";

const allowedRoles = new Set<AppRole>(["admin", "chair", "leader", "staff"]);
const db = getDb();

export async function POST(request: Request) {
  try {
    const auth = await requireRole(request);
    if (!allowedRoles.has(auth.user.role)) {
      return Response.json({ error: "当前账号不能执行任务操作" }, { status: 403 });
    }
    const body = (await request.json()) as {
      kind?: string;
      id?: string | number;
      action?: string;
      note?: string;
      reason?: string;
      attachment?: WorkflowAttachment;
      key?: string;
      parentTaskId?: number;
      title?: string;
      assignee?: string;
      deadline?: string;
      evidence?: string;
      task?: TaskEntity;
    };

    const tasks = (await listAllTasks()) as unknown as WorkflowTask[];
    const subtasks = (await listAllSubtasks()) as unknown as WorkflowSubtask[];

    const actor: WorkflowActor = { role: auth.user.role, name: auth.user.name, department: auth.user.department };

    let result: WorkflowMutationResult;
    if (body.kind === "task" && body.action === "create") {
      result = createTask(tasks, subtasks, body.task as unknown as WorkflowTask, actor);
    } else if (body.kind === "task" && body.id !== undefined && body.action) {
      result = applyTaskAction(tasks, subtasks, Number(body.id), body.action as TaskActionName, actor, {
        note: body.note,
        reason: body.reason,
        attachment: body.attachment,
        key: body.key,
      });
    } else if (body.kind === "subtask" && body.action === "create") {
      result = createSubtask(tasks, subtasks, Number(body.parentTaskId), actor, {
        title: body.title || "",
        assignee: body.assignee || "",
        deadline: body.deadline,
        evidence: body.evidence,
      });
    } else if (body.kind === "subtask" && body.id && body.action) {
      result = applySubtaskAction(tasks, subtasks, String(body.id), body.action as SubtaskActionName, actor, {
        note: body.note,
        reason: body.reason,
        attachment: body.attachment,
        key: body.key,
      });
    } else {
      return Response.json({ error: "缺少必要的操作参数" }, { status: 400 });
    }

    if (!result.ok) return Response.json({ error: result.reason }, { status: result.status });

    const accounts = await db.prepare("SELECT username, name, role, department, active FROM app_accounts")
      .all<{ username: string; name: string; role: AppRole; department: string; active: number }>();
    const newRecords = result.notifications
      .map((draft) =>
        resolveNotification(
          draft,
          accounts.results.map((row) => ({
            username: row.username,
            name: row.name,
            role: row.role,
            department: row.department,
            active: Boolean(row.active),
          })),
          auth.user.username,
        ),
      )
      .filter((record): record is NotificationRecord => record !== null);

    // 只 upsert 真正变动的实体，避免整表覆盖带来的并发丢失。
    const changedTasks = changedById(tasks, result.tasks);
    const changedSubtasks = changedById(subtasks, result.subtasks);
    await upsertTasks(changedTasks as unknown as TaskEntity[]);
    await upsertSubtasks(changedSubtasks as unknown as SubtaskEntity[]);
    await insertNotifications(newRecords);

    await recordWorkflowEvent(result.event, auth.user.name, auth.user.role);

    return Response.json({
      ok: true,
      tasks: result.tasks,
      subtasks: result.subtasks,
      notifications: newRecords,
    });
  } catch (error) {
    return authErrorResponse(error, "任务操作失败");
  }
}
