// 功能调研端点：admin/chair 可新增编辑调研需求，其余角色只读。

import { authErrorResponse, requireRole } from "../../server-auth.ts";
import { listResearchItems, upsertResearchItem, type ResearchItemRecord } from "../../research-store.ts";

export async function GET(request: Request) {
  try {
    await requireRole(request);
    const items = await listResearchItems();
    return Response.json({ items });
  } catch (error) {
    return authErrorResponse(error, "读取功能调研失败");
  }
}

export async function POST(request: Request) {
  try {
    await requireRole(request, ["admin", "chair"]);
    const body = (await request.json()) as { item?: ResearchItemRecord };
    const item = body.item;
    if (!item || !item.id?.trim() || !item.name?.trim()) {
      return Response.json({ error: "调研需求信息不完整" }, { status: 400 });
    }
    await upsertResearchItem(item);
    return Response.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error, "保存调研需求失败");
  }
}
