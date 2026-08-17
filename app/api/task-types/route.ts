// 任务类型模板端点：读取任务类型及动态字段定义；管理员可新增/编辑。

import { authErrorResponse, requireRole } from "../../server-auth.ts";
import { listTaskTypes, upsertTaskType, type TaskTypeSchema } from "../../task-type-store.ts";

export async function GET(request: Request) {
  try {
    await requireRole(request);
    const types = await listTaskTypes();
    return Response.json({ types });
  } catch (error) {
    return authErrorResponse(error, "读取任务类型失败");
  }
}

export async function POST(request: Request) {
  try {
    await requireRole(request, ["admin"]);
    const body = (await request.json()) as { type?: TaskTypeSchema };
    const type = body.type;
    if (!type || !type.name?.trim() || !Array.isArray(type.fields)) {
      return Response.json({ error: "任务类型信息不完整" }, { status: 400 });
    }
    await upsertTaskType(type);
    return Response.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error, "保存任务类型失败");
  }
}
