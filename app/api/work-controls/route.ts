import { authErrorResponse, requireRole } from "../../server-auth.ts";
import { recordWorkflowEvent } from "../../workflow-events.ts";
import { listAllSubtasks, listAllTasks, upsertSubtasks, upsertTasks } from "../../task-store.ts";

export async function PATCH(request: Request) {
  try {
    const auth = await requireRole(request, ["admin", "chair", "leader", "staff"]);
    const body = await request.json() as { kind?: "task" | "subtask"; id?: string | number; action?: "block" | "unblock" | "reassign" | "reschedule"; reason?: string; assignee?: string; plannedEndAt?: string };
    const reason = String(body.reason || "").trim();
    if (!body.kind || body.id == null || !body.action) return Response.json({ error: "缺少操作参数" }, { status: 400 });
    if (!reason) return Response.json({ error: "必须填写本次调整原因" }, { status: 400 });
    const tasks = await listAllTasks(); const subtasks = await listAllSubtasks();
    if (body.kind === "task") {
      const task = tasks.find((item) => item.id === Number(body.id));
      if (!task) return Response.json({ error: "任务不存在" }, { status: 404 });
      const sameDepartmentLeader = auth.user.role === "leader" && String(task.department || "") === auth.user.department;
      const assignee = Number(task.assigneeAccountId) === auth.user.id || String(task.person || "") === auth.user.name;
      if (!["admin", "chair"].includes(auth.user.role) && !sameDepartmentLeader && !(assignee && ["block", "unblock"].includes(body.action))) return Response.json({ error: "当前账号不能调整该任务" }, { status: 403 });
      const updated = { ...task };
      if (body.action === "block") { updated.blocked = true; updated.blockedReason = reason; updated.risk = true; }
      if (body.action === "unblock") { updated.blocked = false; updated.blockedReason = ""; updated.risk = false; }
      if (body.action === "reassign") { if (!body.assignee?.trim()) return Response.json({ error: "请选择新的负责人" }, { status: 400 }); updated.person = body.assignee.trim(); updated.assigneeAccountId = undefined; updated.reassignmentReason = reason; }
      if (body.action === "reschedule") { if (!body.plannedEndAt) return Response.json({ error: "请选择新的计划完成时间" }, { status: 400 }); updated.plannedEndAt = body.plannedEndAt; updated.deadline = body.plannedEndAt; updated.scheduleChangeReason = reason; }
      updated.lastAction = `${auth.user.name}${body.action === "block" ? "标记阻塞" : body.action === "unblock" ? "解除阻塞" : body.action === "reassign" ? "调整负责人" : "调整期限"}：${reason}`;
      await upsertTasks([updated]);
      await recordWorkflowEvent({ entityType: "task", entityId: updated.id, action: body.action, fromStatus: String(task.status || ""), toStatus: String(updated.status || ""), reason }, auth.user.name, auth.user.role);
      return Response.json({ ok: true, item: updated });
    }
    const subtask = subtasks.find((item) => item.id === String(body.id));
    if (!subtask) return Response.json({ error: "子任务不存在" }, { status: 404 });
    const parent = tasks.find((item) => item.id === Number(subtask.parentTaskId));
    const sameDepartmentLeader = auth.user.role === "leader" && String(parent?.department || "") === auth.user.department;
    const assignee = Number(subtask.assigneeAccountId) === auth.user.id || String(subtask.assignee || "") === auth.user.name;
    if (!["admin", "chair"].includes(auth.user.role) && !sameDepartmentLeader && !(assignee && ["block", "unblock"].includes(body.action))) return Response.json({ error: "当前账号不能调整该子任务" }, { status: 403 });
    const updated = { ...subtask };
    if (body.action === "block") { updated.blocked = true; updated.blockedReason = reason; }
    if (body.action === "unblock") { updated.blocked = false; updated.blockedReason = ""; }
    if (body.action === "reassign") { if (!body.assignee?.trim()) return Response.json({ error: "请选择新的执行人" }, { status: 400 }); updated.assignee = body.assignee.trim(); updated.assigneeAccountId = undefined; updated.reassignmentReason = reason; }
    if (body.action === "reschedule") { if (!body.plannedEndAt) return Response.json({ error: "请选择新的计划完成时间" }, { status: 400 }); updated.plannedEndAt = body.plannedEndAt; updated.deadline = body.plannedEndAt; updated.scheduleChangeReason = reason; }
    updated.lastAction = `${auth.user.name}${body.action === "block" ? "标记阻塞" : body.action === "unblock" ? "解除阻塞" : body.action === "reassign" ? "调整执行人" : "调整期限"}：${reason}`;
    await upsertSubtasks([updated]);
    await recordWorkflowEvent({ entityType: "subtask", entityId: updated.id, action: body.action, fromStatus: String(subtask.status || ""), toStatus: String(updated.status || ""), reason }, auth.user.name, auth.user.role);
    return Response.json({ ok: true, item: updated });
  } catch (error) { return authErrorResponse(error, "调整工作项失败"); }
}

