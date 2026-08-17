// 附件上传/下载/删除：通过 ObjectStorage 端口访问对象存储，不直接依赖 R2。

import { authErrorResponse, requireRole } from "../../server-auth.ts";
import { getPlatform } from "../../platform.ts";

export async function POST(request: Request) {
  try {
    await requireRole(request);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "请选择文件" }, { status: 400 });
    if (file.size > 20 * 1024 * 1024) return Response.json({ error: "单个附件不能超过20MB" }, { status: 400 });
    const extension = file.name.includes(".") ? `.${file.name.split(".").pop()}` : "";
    const key = `tasks/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}${extension}`;
    await getPlatform().storage.put(key, file.stream(), {
      contentType: file.type || "application/octet-stream",
      metadata: { originalName: file.name },
    });
    return Response.json({ attachment: { key, name: file.name, size: file.size, type: file.type } }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error, "附件上传失败");
  }
}

export async function GET(request: Request) {
  try {
    await requireRole(request);
    const key = new URL(request.url).searchParams.get("key");
    if (!key) return Response.json({ error: "缺少附件标识" }, { status: 400 });
    const object = await getPlatform().storage.get(key);
    if (!object || !object.body) return Response.json({ error: "附件不存在" }, { status: 404 });
    const headers = new Headers();
    if (object.contentType) headers.set("Content-Type", object.contentType);
    headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(object.metadata?.originalName || "attachment")}`);
    return new Response(object.body, { headers });
  } catch (error) {
    return authErrorResponse(error, "附件下载失败");
  }
}

export async function DELETE(request: Request) {
  try {
    await requireRole(request, ["admin", "chair", "leader", "staff", "teacher"]);
    const key = new URL(request.url).searchParams.get("key");
    if (!key) return Response.json({ error: "缺少附件标识" }, { status: 400 });
    await getPlatform().storage.delete(key);
    return Response.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error, "附件删除失败");
  }
}
