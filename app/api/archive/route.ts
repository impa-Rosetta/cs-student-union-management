// 归档资料写入端点：主席/负责人上传资料后写入关系表 archive_records。

import { authErrorResponse, requireRole } from "../../server-auth.ts";
import { upsertArchiveRecords, type ArchiveEntity } from "../../archive-store.ts";

export async function POST(request: Request) {
  try {
    await requireRole(request, ["admin", "chair", "leader"]);
    const body = (await request.json()) as { record?: ArchiveEntity };
    const record = body.record;
    if (!record || typeof record.id !== "string" || !record.name) {
      return Response.json({ error: "归档资料信息不完整" }, { status: 400 });
    }
    await upsertArchiveRecords([record]);
    return Response.json({ ok: true, record });
  } catch (error) {
    return authErrorResponse(error, "归档资料保存失败");
  }
}
