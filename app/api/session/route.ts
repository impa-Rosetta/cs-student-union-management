import { authErrorResponse, currentUser } from "../../server-auth.ts";

export async function GET(request: Request) {
  try {
    const auth = await currentUser(request);
    return Response.json({ localMode: auth.localMode, authMethod: auth.authMethod, user: auth.localMode ? null : auth.user });
  } catch (error) {
    return authErrorResponse(error, "读取登录状态失败");
  }
}
