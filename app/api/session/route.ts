import { authErrorResponse, currentUser } from "../../server-auth";

export async function GET(request: Request) {
  try {
    const auth = await currentUser(request);
    return Response.json({ localMode: auth.localMode, user: auth.localMode ? null : auth.user });
  } catch (error) {
    return authErrorResponse(error, "读取登录状态失败");
  }
}
