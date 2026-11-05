import { authErrorResponse, requireRole } from "../../server-auth.ts";
import { captureActivityTemplate, instantiateActivityTemplate, listActivityTemplates } from "../../activity-template-store.ts";

export async function GET(request: Request) { try { await requireRole(request); return Response.json({ templates: await listActivityTemplates() }); } catch (error) { return authErrorResponse(error, "读取活动模板失败"); } }

export async function POST(request: Request) {
  try {
    const auth = await requireRole(request, ["admin", "chair"]);
    const body = await request.json() as { action?: "capture" | "instantiate"; activityId?: string; templateId?: number; name?: string };
    if (!body.activityId || !body.action) return Response.json({ error: "缺少模板操作参数" }, { status: 400 });
    if (body.action === "capture") {
      const template = await captureActivityTemplate(body.activityId, body.name?.trim() || "活动执行模板", auth.user.name);
      return Response.json({ ok: true, template }, { status: 201 });
    }
    const result = await instantiateActivityTemplate(Number(body.templateId), body.activityId);
    return Response.json({ ok: true, ...result }, { status: 201 });
  } catch (error) { return authErrorResponse(error, "活动模板操作失败"); }
}

