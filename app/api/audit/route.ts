// 审计日志读取端点：返回任务/子任务状态转换的工作流事件轨迹。

import { authErrorResponse, requireRole } from "../../server-auth.ts";
import { listWorkflowEvents } from "../../workflow-events.ts";

export async function GET(request: Request) {
  try {
    await requireRole(request, ["admin", "chair"]);
    const limit = Number(new URL(request.url).searchParams.get("limit")) || 200;
    const events = await listWorkflowEvents(Math.min(Math.max(limit, 1), 500));
    return Response.json({ events });
  } catch (error) {
    return authErrorResponse(error, "读取审计记录失败");
  }
}
