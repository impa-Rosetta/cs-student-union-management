import { getDb } from "../../db.ts";
import { insertNotifications } from "../../notification-store.ts";
import {
  addOfficeRequestEvent, getOfficeRequest, listOfficeRequestEvents, listOfficeRequests, upsertOfficeRequest,
  type OfficeMaterial, type OfficeRequest, type OfficeRequestDetails, type OfficeRequestType,
} from "../../office-request-store.ts";
import { isOfficeManager, officeRequestTransition, type OfficeRequestAction } from "../../office-workflow/state-machine.ts";
import type { Attachment } from "../../product-model.ts";
import { authErrorResponse, requireRole } from "../../server-auth.ts";
import { recordWorkflowEvent } from "../../workflow-events.ts";

const db = getDb();

async function notifyUsers(item: OfficeRequest, actorUsername: string, status: string) {
  const accounts = await db.prepare("SELECT username, role, department, active FROM app_accounts WHERE active = 1")
    .all<{ username: string; role: string; department: string; active: number }>();
  const recipients = status === "待办公室审核"
    ? accounts.results.filter((account) => account.role === "admin" || account.role === "chair" || account.department === "办公室").map((account) => account.username)
    : [item.requesterUsername];
  const recipientUsernames = Array.from(new Set(recipients)).filter((username) => username && username !== actorUsername);
  if (!recipientUsernames.length) return;
  await insertNotifications([{
    id: `office-${item.id}-${Date.now()}`,
    recipientUsernames,
    title: status === "待办公室审核" ? "新的办公室申请待审核" : "办公室申请状态已更新",
    detail: `${item.title}：${status}`,
    level: status === "待补充材料" || status === "已驳回" ? "warning" : status === "已完成" ? "success" : "info",
    entity: { type: "officeRequest", id: item.id },
    createdAt: new Date().toISOString(),
  }]);
}

export async function GET(request: Request) {
  try {
    await requireRole(request);
    const items = await listOfficeRequests();
    const events = await listOfficeRequestEvents();
    return Response.json({ items, events });
  } catch (error) { return authErrorResponse(error, "读取办公室申请失败"); }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRole(request, ["admin", "chair", "leader", "staff"]);
    const body = (await request.json()) as {
      type?: OfficeRequestType; title?: string; activityId?: string; activityName?: string; deadline?: string;
      description?: string; details?: OfficeRequestDetails; materials?: OfficeMaterial[]; attachments?: Attachment[];
    };
    if (!body.type || !["venue", "reimbursement"].includes(body.type) || !body.title?.trim()) {
      return Response.json({ error: "申请类型和标题不能为空" }, { status: 400 });
    }
    const now = new Date().toISOString();
    const item: OfficeRequest = {
      id: `office-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type: body.type, title: body.title.trim(), status: "草稿",
      requesterUsername: auth.user.username, requesterName: auth.user.name, requesterDepartment: auth.user.department,
      activityId: body.activityId || "", activityName: body.activityName || "非活动事项", deadline: body.deadline || "",
      description: body.description?.trim() || "", details: body.details || {}, materials: body.materials || [],
      attachments: body.attachments || [], externalPlatform: "", externalReference: "", handlerName: "", createdAt: now, updatedAt: now,
    };
    await upsertOfficeRequest(item);
    await addOfficeRequestEvent({ requestId: item.id, action: "create", fromStatus: "", toStatus: "草稿", actorName: auth.user.name, note: "创建申请草稿" });
    return Response.json({ ok: true, item }, { status: 201 });
  } catch (error) { return authErrorResponse(error, "创建办公室申请失败"); }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireRole(request, ["admin", "chair", "leader", "staff"]);
    const body = (await request.json()) as { id?: string; action?: OfficeRequestAction; note?: string; externalPlatform?: string; externalReference?: string };
    if (!body.id || !body.action) return Response.json({ error: "申请编号和操作不能为空" }, { status: 400 });
    const item = await getOfficeRequest(body.id);
    if (!item) return Response.json({ error: "办公室申请不存在" }, { status: 404 });
    const transition = officeRequestTransition(item.status, body.action, {
      role: auth.user.role, department: auth.user.department, username: auth.user.username, requesterUsername: item.requesterUsername,
    });
    if (!transition.ok) return Response.json({ error: transition.reason }, { status: transition.reason.startsWith("只有") ? 403 : 409 });
    const note = body.note?.trim() || "";
    if ((body.action === "return" || body.action === "reject") && !note) return Response.json({ error: "退回或驳回时必须填写原因" }, { status: 400 });
    if (body.action === "complete" && !body.externalReference?.trim() && !item.externalReference) return Response.json({ error: "办结前请登记外部单号或结果编号" }, { status: 400 });
    const saved: OfficeRequest = { ...item, status: transition.next, handlerName: isOfficeManager(auth.user) ? auth.user.name : item.handlerName,
      externalPlatform: body.externalPlatform?.trim() || item.externalPlatform, externalReference: body.externalReference?.trim() || item.externalReference,
      updatedAt: new Date().toISOString() };
    await upsertOfficeRequest(saved);
    await addOfficeRequestEvent({ requestId: item.id, action: body.action, fromStatus: item.status, toStatus: transition.next, actorName: auth.user.name, note });
    await recordWorkflowEvent({ entityType: "office_request", entityId: item.id, action: body.action, fromStatus: item.status, toStatus: transition.next, reason: note || undefined }, auth.user.name, auth.user.role);
    await notifyUsers(saved, auth.user.username, transition.next);
    return Response.json({ ok: true, item: saved, events: await listOfficeRequestEvents(item.id) });
  } catch (error) { return authErrorResponse(error, "办理办公室申请失败"); }
}
