import { authErrorResponse, requireRole } from "../../server-auth.ts";
import { listWorkItemsForUser } from "../../work-management/store.ts";

export async function GET(request: Request) {
  try {
    const auth = await requireRole(request);
    return Response.json({ items: await listWorkItemsForUser(auth.user) });
  } catch (error) {
    return authErrorResponse(error, "读取统一工作列表失败");
  }
}

