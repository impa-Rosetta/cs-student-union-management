// 活动写入端点：主席/管理员创建或更新活动（写入关系表 activities）。

import { authErrorResponse, requireRole } from "../../server-auth.ts";
import { getActivity, upsertActivities, type ActivityEntity } from "../../activity-store.ts";
import { getDb } from "../../db.ts";
import { insertNotifications } from "../../notification-store.ts";
import { recordWorkflowEvent } from "../../workflow-events.ts";
import { resolveNotification, type NotificationRecord } from "../../workflow/notifications.ts";
import { activityNotificationDrafts } from "../../activity-workflow/notifications.ts";
import { createVenueFromApprovedActivity } from "../../office-service/store.ts";
import {
  activityTransition,
  normalizeActivityStage,
  type ActivityAction,
} from "../../activity-workflow/state-machine.ts";

const db = getDb();

export async function POST(request: Request) {
  try {
    await requireRole(request, ["admin", "chair"]);
    const body = (await request.json()) as { activity?: ActivityEntity };
    const activity = body.activity;
    if (!activity || typeof activity.id !== "string" || !activity.name) {
      return Response.json({ error: "活动信息不完整" }, { status: 400 });
    }
    const existing = await getActivity(activity.id);
    const saved = { ...activity, state: existing?.state ?? "草稿" };
    await upsertActivities([saved]);
    return Response.json({ ok: true, activity: saved });
  } catch (error) {
    return authErrorResponse(error, "保存活动失败");
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireRole(request, ["admin", "chair", "leader", "teacher"]);
    const body = (await request.json()) as { id?: string; action?: ActivityAction; note?: string; reason?: string };
    if (!body.id || !body.action) {
      return Response.json({ error: "活动编号和阶段操作不能为空" }, { status: 400 });
    }
    const activity = await getActivity(body.id);
    if (!activity) return Response.json({ error: "活动不存在" }, { status: 404 });
    const current = normalizeActivityStage(activity.state);
    if (!current) return Response.json({ error: "活动阶段数据无效" }, { status: 409 });

    const departments = Array.isArray(activity.departments) ? activity.departments.map(String) : [];
    const transition = activityTransition(current, body.action, {
      role: auth.user.role,
      isActivityLeader:
        auth.user.role === "leader" &&
        (String(activity.organizer ?? "") === auth.user.department || departments.includes(auth.user.department)),
      isGuidingTeacher:
        auth.user.role === "teacher" && String(activity.teacher ?? "") === auth.user.name,
    });
    if (!transition.ok) {
      const status = transition.reason.startsWith("只有") ? 403 : 409;
      return Response.json({ error: transition.reason }, { status });
    }
    const saved = { ...activity, state: transition.next };
    await upsertActivities([saved]);

    const accounts = await db.prepare("SELECT username, name, role, department, active FROM app_accounts")
      .all<{ username: string; name: string; role: typeof auth.user.role; department: string; active: number }>();
    const notifications = activityNotificationDrafts(activity, body.action, transition.next)
      .map((draft) => resolveNotification(
        draft,
        (accounts.results || []).map((account) => ({ ...account, active: Boolean(account.active) })),
        auth.user.username,
      ))
      .filter((record): record is NotificationRecord => record !== null);
    await insertNotifications(notifications);
    await recordWorkflowEvent({
      entityType: "activity",
      entityId: activity.id,
      action: body.action,
      fromStatus: current,
      toStatus: transition.next,
      reason: body.reason?.trim() || body.note?.trim() || undefined,
    }, auth.user.name, auth.user.role);

    const venueRequest = body.action === "approve" && transition.next === "筹备中"
      ? await createVenueFromApprovedActivity(saved, auth.user)
      : null;

    return Response.json({ ok: true, activity: saved, notifications, venueRequest });
  } catch (error) {
    return authErrorResponse(error, "更新活动阶段失败");
  }
}
