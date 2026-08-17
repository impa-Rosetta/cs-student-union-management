// 系统配置端点：管理员可保存，其余角色只读。

import { authErrorResponse, requireRole } from "../../server-auth.ts";
import { getSystemConfig, upsertSystemConfig, type SystemConfigRecord } from "../../config-store.ts";

export async function GET(request: Request) {
  try {
    await requireRole(request);
    const config = await getSystemConfig();
    return Response.json({ config });
  } catch (error) {
    return authErrorResponse(error, "读取系统配置失败");
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireRole(request, ["admin"]);
    const body = (await request.json()) as { config?: SystemConfigRecord };
    const config = body.config;
    if (!config || ["attachmentLimit", "academicYearMonth", "semesterBoundary", "notificationDays", "backupTime"].some((key) => typeof (config as unknown as Record<string, unknown>)[key] !== "string")) {
      return Response.json({ error: "系统配置不完整" }, { status: 400 });
    }
    await upsertSystemConfig(config, auth.user.email);
    return Response.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error, "保存系统配置失败");
  }
}
