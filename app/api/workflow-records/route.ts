// 快捷流程留痕端点：已登录角色可追加/读取快捷流程操作记录。

import { authErrorResponse, requireRole } from "../../server-auth.ts";
import { appendWorkflowRecord, listWorkflowRecords } from "../../workflow-record-store.ts";

export async function GET(request: Request) {
  try {
    await requireRole(request);
    const records = await listWorkflowRecords();
    return Response.json({ records });
  } catch (error) {
    return authErrorResponse(error, "读取流程留痕失败");
  }
}

export async function POST(request: Request) {
  try {
    await requireRole(request);
    const body = (await request.json()) as { record?: Record<string, string> };
    if (!body.record || typeof body.record !== "object") {
      return Response.json({ error: "流程记录不完整" }, { status: 400 });
    }
    await appendWorkflowRecord(body.record);
    return Response.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error, "保存流程留痕失败");
  }
}
