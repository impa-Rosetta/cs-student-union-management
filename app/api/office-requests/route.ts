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

const materialTemplates: Record<OfficeRequestType, OfficeMaterial[]> = {
  venue: [
    { key: "activity", label: "活动或会议安排已确认", checked: false },
    { key: "contact", label: "现场联系人及电话已确认", checked: false },
    { key: "equipment", label: "教室设备需求已核对", checked: false },
  ],
  reimbursement: [
    { key: "requisition", label: "领用单", checked: false },
    { key: "invoice", label: "发票已签名", checked: false },
    { key: "order", label: "订单或购买记录截图", checked: false },
    { key: "activityProof", label: "活动证明截图（活动类费用）", checked: false },
    { key: "handwriting", label: "奖品领用人姓名、学号已手写", checked: false },
  ],
};

function normalizeMaterials(type: OfficeRequestType, materials?: OfficeMaterial[]) {
  const selected = new Map((materials || []).map((item) => [item.key, Boolean(item.checked)]));
  return materialTemplates[type].map((item) => ({ ...item, checked: selected.get(item.key) || false }));
}

function validateOfficeFields(type: OfficeRequestType, title: string, details: OfficeRequestDetails) {
  if (!title.trim()) return "申请标题不能为空";
  if (type === "venue") {
    const attendees = details.attendeeCount ? Number(details.attendeeCount) : 0;
    if (details.attendeeCount && (!Number.isFinite(attendees) || attendees <= 0)) return "预计人数必须为正数";
    if (details.startTime && details.endTime && details.endTime < details.startTime) return "使用结束时间不能早于开始时间";
  }
  if (type === "reimbursement" && details.amount && (!Number.isFinite(Number(details.amount)) || Number(details.amount) <= 0)) return "报销金额必须大于零";
  return "";
}

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
    const validationError = validateOfficeFields(body.type, body.title, body.details || {});
    if (validationError) return Response.json({ error: validationError }, { status: 400 });
    const now = new Date().toISOString();
    const item: OfficeRequest = {
      id: `office-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type: body.type, title: body.title.trim(), status: "草稿",
      requesterUsername: auth.user.username, requesterName: auth.user.name, requesterDepartment: auth.user.department,
      activityId: body.activityId || "", activityName: body.activityName || "非活动事项", deadline: body.deadline || "",
      description: body.description?.trim() || "", details: body.details || {}, materials: normalizeMaterials(body.type, body.materials),
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
    const body = (await request.json()) as { id?: string; action?: OfficeRequestAction | "update"; note?: string; externalPlatform?: string; externalReference?: string; data?: Partial<Pick<OfficeRequest, "title" | "activityId" | "activityName" | "deadline" | "description" | "details" | "materials" | "attachments">> };
    if (!body.id || !body.action) return Response.json({ error: "申请编号和操作不能为空" }, { status: 400 });
    const item = await getOfficeRequest(body.id);
    if (!item) return Response.json({ error: "办公室申请不存在" }, { status: 404 });
    if (body.action === "update") {
      if (item.requesterUsername !== auth.user.username) return Response.json({ error: "只有申请人可以修改申请" }, { status: 403 });
      if (item.status !== "草稿" && item.status !== "待补充材料") return Response.json({ error: `当前状态为“${item.status}”，不能修改申请内容` }, { status: 409 });
      const data = body.data || {};
      const title = data.title?.trim() || "";
      const details = data.details || {};
      const validationError = validateOfficeFields(item.type, title, details);
      if (validationError) return Response.json({ error: validationError }, { status: 400 });
      const saved: OfficeRequest = {
        ...item,
        title,
        activityId: data.activityId || "",
        activityName: data.activityName || "非活动事项",
        deadline: data.deadline || "",
        description: data.description?.trim() || "",
        details,
        materials: normalizeMaterials(item.type, data.materials),
        attachments: Array.isArray(data.attachments) ? data.attachments : [],
        updatedAt: new Date().toISOString(),
      };
      await upsertOfficeRequest(saved);
      await addOfficeRequestEvent({ requestId: item.id, action: "update", fromStatus: item.status, toStatus: item.status, actorName: auth.user.name, note: "申请人更新申请内容与材料" });
      await recordWorkflowEvent({ entityType: "office_request", entityId: item.id, action: "update", fromStatus: item.status, toStatus: item.status, reason: "申请人更新申请内容与材料" }, auth.user.name, auth.user.role);
      return Response.json({ ok: true, item: saved, events: await listOfficeRequestEvents(item.id) });
    }
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
