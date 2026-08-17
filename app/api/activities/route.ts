// 活动写入端点：主席/管理员创建或更新活动（写入关系表 activities）。

import { authErrorResponse, requireRole } from "../../server-auth.ts";
import { upsertActivities, type ActivityEntity } from "../../activity-store.ts";

export async function POST(request: Request) {
  try {
    await requireRole(request, ["admin", "chair"]);
    const body = (await request.json()) as { activity?: ActivityEntity };
    const activity = body.activity;
    if (!activity || typeof activity.id !== "string" || !activity.name) {
      return Response.json({ error: "活动信息不完整" }, { status: 400 });
    }
    await upsertActivities([activity]);
    return Response.json({ ok: true, activity });
  } catch (error) {
    return authErrorResponse(error, "保存活动失败");
  }
}
