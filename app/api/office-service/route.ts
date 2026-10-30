import { authErrorResponse, requireRole } from "../../server-auth.ts";
import { getDb } from "../../db.ts";
import { getPlatform } from "../../platform.ts";
import { buildMeetingDocx, type MeetingExportReport } from "../../office-service/meeting-docx.ts";
import {
  actOnMeetingRound, actOnVenueRequest, createMeetingRound, createVenueRequest,
  listMeetingData, listVenueEvents, listVenueRequests, reportsForExport, saveMeetingExport,
  saveMeetingReport, updateVenueRequest, type MeetingReport, type VenueDraft,
} from "../../office-service/store.ts";
import type { MeetingReportAction, MeetingRoundAction, VenueAction } from "../../office-service/state-machines.ts";

const db = getDb();

export async function GET(request: Request) {
  try {
    const auth = await requireRole(request);
    const [venueRequests, venueEvents, meetings, departments] = await Promise.all([
      listVenueRequests(auth.user), listVenueEvents(), listMeetingData(auth.user),
      db.prepare("SELECT name FROM departments ORDER BY sort_order,name").all<{ name: string }>().catch(() => ({ results: [] })),
    ]);
    return Response.json({ venueRequests, venueEvents, ...meetings, departments: departments.results.map((item) => item.name), currentUser: { username: auth.user.username, name: auth.user.name, department: auth.user.department, role: auth.user.role } });
  } catch (error) { return authErrorResponse(error, "读取办公室服务失败"); }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRole(request);
    const body = await request.json() as Record<string, unknown>;
    if (body.kind === "venue") {
      const venue = await createVenueRequest(body.draft as VenueDraft, auth.user, Boolean(body.submit));
      return Response.json({ venue }, { status: 201 });
    }
    if (body.kind === "meetingRound") {
      const round = await createMeetingRound(body.round as { title: string; meetingDate: string; deadline: string; departmentNames: string[] }, auth.user, Boolean(body.publish));
      return Response.json({ round }, { status: 201 });
    }
    if (body.kind === "meetingExport") {
      const roundId = String(body.roundId || "");
      const missingMode = body.missingMode === "placeholder" ? "placeholder" : "omit";
      const { round, reports } = await reportsForExport(roundId, missingMode);
      const exportReports: MeetingExportReport[] = reports.map((report) => ({ department: report.department, lastWeek: report.lastWeek, thisWeek: report.thisWeek, noticeCount: report.noticeCount, mediaCount: report.mediaCount, emailReceived: report.emailReceived, emailSent: report.emailSent, meetingAttendance: report.meetingAttendance, meetingDuration: report.meetingDuration, unplannedWorkload: report.unplannedWorkload }));
      const bytes = buildMeetingDocx(round.title, exportReports);
      const safeDate = (round.meetingDate || new Date().toISOString().slice(0, 10)).replace(/[^0-9-]/g, "");
      const fileName = `${safeDate || "例会"}-${round.title}-汇总版.docx`;
      const objectKey = `meetings/${safeDate || "undated"}/${crypto.randomUUID()}.docx`;
      await getPlatform().storage.put(objectKey, new Blob([bytes as BlobPart]).stream(), { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", metadata: { originalName: fileName } });
      const meetingExport = await saveMeetingExport(roundId, objectKey, fileName, missingMode, auth.user);
      try { await actOnMeetingRound(roundId, "generated", auth.user); } catch { /* 已生成状态下允许重复导出 */ }
      return Response.json({ export: meetingExport, attachment: { key: objectKey, name: fileName, size: bytes.byteLength, type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" } }, { status: 201 });
    }
    return Response.json({ error: "不支持的创建类型" }, { status: 400 });
  } catch (error) { return authErrorResponse(error, "保存办公室服务失败"); }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireRole(request);
    const body = await request.json() as { kind?: string; id?: string; draft?: VenueDraft };
    if (body.kind !== "venue" || !body.id || !body.draft) return Response.json({ error: "参数不完整" }, { status: 400 });
    const venue = await updateVenueRequest(body.id, body.draft, auth.user);
    return Response.json({ venue });
  } catch (error) { return authErrorResponse(error, "更新场地申请失败"); }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireRole(request);
    const body = await request.json() as Record<string, unknown>;
    if (body.kind === "venue" && body.id && body.action) {
      const venue = await actOnVenueRequest(String(body.id), body.action as VenueAction, auth.user, {
        note: String(body.note || ""), confirmedRoom: String(body.confirmedRoom || ""), confirmedDate: String(body.confirmedDate || ""),
        confirmedStartTime: String(body.confirmedStartTime || ""), confirmedEndTime: String(body.confirmedEndTime || ""),
        officeAttachments: Array.isArray(body.officeAttachments) ? body.officeAttachments as never[] : undefined,
      });
      return Response.json({ venue });
    }
    if (body.kind === "meetingRound" && body.id && body.action) {
      const round = await actOnMeetingRound(String(body.id), body.action as MeetingRoundAction, auth.user);
      return Response.json({ round });
    }
    if (body.kind === "meetingReport" && body.id && body.action) {
      const report = await saveMeetingReport(String(body.id), (body.report || {}) as Partial<MeetingReport>, body.action as MeetingReportAction, auth.user, String(body.note || ""));
      return Response.json({ report });
    }
    return Response.json({ error: "不支持的操作" }, { status: 400 });
  } catch (error) { return authErrorResponse(error, "更新办公室服务失败"); }
}
