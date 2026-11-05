import { authErrorResponse, currentUser, ensureLocalDevelopmentAccounts } from "../../server-auth.ts";

export async function GET(request: Request) {
  try {
    await ensureLocalDevelopmentAccounts(request);
    const auth = await currentUser(request);
    return Response.json({ localMode: false, authMethod: auth.authMethod, user: auth.user });
  } catch (error) {
    return authErrorResponse(error, "读取登录状态失败");
  }
}
