import { authErrorResponse, requireRole } from "../../server-auth.ts";
import { createTaskDependency, listTaskDependencies, removeTaskDependency } from "../../task-dependency-store.ts";
import { listAllTasks } from "../../task-store.ts";

export async function GET(request: Request) {
  try { await requireRole(request); return Response.json({ dependencies: await listTaskDependencies() }); }
  catch (error) { return authErrorResponse(error, "读取任务依赖失败"); }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRole(request, ["admin", "chair"]);
    const body = await request.json() as { predecessorTaskId?: number; successorTaskId?: number };
    const predecessorTaskId = Number(body.predecessorTaskId); const successorTaskId = Number(body.successorTaskId);
    const tasks = await listAllTasks();
    if (!tasks.some((item) => item.id === predecessorTaskId) || !tasks.some((item) => item.id === successorTaskId)) return Response.json({ error: "前置任务或后续任务不存在" }, { status: 404 });
    await createTaskDependency(predecessorTaskId, successorTaskId, auth.user.name);
    return Response.json({ ok: true, dependencies: await listTaskDependencies() }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && (error.message.includes("循环") || error.message.includes("自身") || error.message.includes("UNIQUE"))) return Response.json({ error: error.message.includes("UNIQUE") ? "该依赖已经存在" : error.message }, { status: 409 });
    return authErrorResponse(error, "创建任务依赖失败");
  }
}

export async function DELETE(request: Request) {
  try {
    await requireRole(request, ["admin", "chair"]);
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isFinite(id)) return Response.json({ error: "缺少依赖编号" }, { status: 400 });
    await removeTaskDependency(id);
    return Response.json({ ok: true });
  } catch (error) { return authErrorResponse(error, "删除任务依赖失败"); }
}

