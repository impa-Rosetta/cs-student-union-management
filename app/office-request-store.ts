import { getDb } from "./db.ts";
import type { Attachment } from "./product-model.ts";
import type { OfficeRequestStatus } from "./office-workflow/state-machine.ts";

const db = getDb();

export type OfficeRequestType = "venue" | "reimbursement";
export type OfficeMaterial = { key: string; label: string; checked: boolean };
export type OfficeRequestDetails = Record<string, string>;

export type OfficeRequest = {
  id: string;
  type: OfficeRequestType;
  title: string;
  status: OfficeRequestStatus;
  requesterUsername: string;
  requesterName: string;
  requesterDepartment: string;
  activityId: string;
  activityName: string;
  deadline: string;
  description: string;
  details: OfficeRequestDetails;
  materials: OfficeMaterial[];
  attachments: Attachment[];
  externalPlatform: string;
  externalReference: string;
  handlerName: string;
  createdAt: string;
  updatedAt: string;
};

export type OfficeRequestEvent = {
  id: number;
  requestId: string;
  action: string;
  fromStatus: string;
  toStatus: string;
  actorName: string;
  note: string;
  createdAt: string;
};

type OfficeRequestRow = {
  id: string; type: OfficeRequestType; title: string; status: OfficeRequestStatus;
  requester_username: string; requester_name: string; requester_department: string;
  activity_id: string; activity_name: string; deadline: string; description: string;
  details_json: string; materials_json: string; attachments_json: string;
  external_platform: string; external_reference: string; handler_name: string;
  created_at: string; updated_at: string;
};

type OfficeRequestEventRow = {
  id: number; request_id: string; action: string; from_status: string; to_status: string;
  actor_name: string; note: string; created_at: string;
};

function parseJson<T>(value: string, fallback: T): T {
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

export async function ensureOfficeRequestSchema() {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS office_requests (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('venue','reimbursement')),
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      requester_username TEXT NOT NULL,
      requester_name TEXT NOT NULL,
      requester_department TEXT NOT NULL,
      activity_id TEXT NOT NULL DEFAULT '',
      activity_name TEXT NOT NULL DEFAULT '',
      deadline TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      details_json TEXT NOT NULL DEFAULT '{}',
      materials_json TEXT NOT NULL DEFAULT '[]',
      attachments_json TEXT NOT NULL DEFAULT '[]',
      external_platform TEXT NOT NULL DEFAULT '',
      external_reference TEXT NOT NULL DEFAULT '',
      handler_name TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_office_requests_status ON office_requests(status, updated_at)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS office_request_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id TEXT NOT NULL,
      action TEXT NOT NULL,
      from_status TEXT NOT NULL,
      to_status TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_office_request_events_request ON office_request_events(request_id, id)"),
  ]);
}

function rowToRequest(row: OfficeRequestRow): OfficeRequest {
  return {
    id: row.id, type: row.type, title: row.title, status: row.status,
    requesterUsername: row.requester_username, requesterName: row.requester_name,
    requesterDepartment: row.requester_department, activityId: row.activity_id,
    activityName: row.activity_name, deadline: row.deadline, description: row.description,
    details: parseJson(row.details_json, {}), materials: parseJson(row.materials_json, []),
    attachments: parseJson(row.attachments_json, []), externalPlatform: row.external_platform,
    externalReference: row.external_reference, handlerName: row.handler_name,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export async function listOfficeRequests(): Promise<OfficeRequest[]> {
  await ensureOfficeRequestSchema();
  const result = await db.prepare("SELECT * FROM office_requests ORDER BY updated_at DESC, created_at DESC").all<OfficeRequestRow>();
  return (result.results || []).map(rowToRequest);
}

export async function getOfficeRequest(id: string): Promise<OfficeRequest | null> {
  await ensureOfficeRequestSchema();
  const row = await db.prepare("SELECT * FROM office_requests WHERE id = ? LIMIT 1").bind(id).first<OfficeRequestRow>();
  return row ? rowToRequest(row) : null;
}

export async function upsertOfficeRequest(item: OfficeRequest) {
  await ensureOfficeRequestSchema();
  await db.prepare(`INSERT INTO office_requests (
    id,type,title,status,requester_username,requester_name,requester_department,activity_id,activity_name,deadline,description,
    details_json,materials_json,attachments_json,external_platform,external_reference,handler_name,created_at,updated_at
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  ON CONFLICT(id) DO UPDATE SET title=excluded.title,status=excluded.status,activity_id=excluded.activity_id,
    activity_name=excluded.activity_name,deadline=excluded.deadline,description=excluded.description,details_json=excluded.details_json,
    materials_json=excluded.materials_json,attachments_json=excluded.attachments_json,external_platform=excluded.external_platform,
    external_reference=excluded.external_reference,handler_name=excluded.handler_name,updated_at=excluded.updated_at`)
    .bind(item.id,item.type,item.title,item.status,item.requesterUsername,item.requesterName,item.requesterDepartment,
      item.activityId,item.activityName,item.deadline,item.description,JSON.stringify(item.details),JSON.stringify(item.materials),
      JSON.stringify(item.attachments),item.externalPlatform,item.externalReference,item.handlerName,item.createdAt,item.updatedAt).run();
}

export async function addOfficeRequestEvent(event: Omit<OfficeRequestEvent, "id" | "createdAt">) {
  await ensureOfficeRequestSchema();
  await db.prepare(`INSERT INTO office_request_events (request_id,action,from_status,to_status,actor_name,note)
    VALUES (?,?,?,?,?,?)`).bind(event.requestId,event.action,event.fromStatus,event.toStatus,event.actorName,event.note).run();
}

export async function listOfficeRequestEvents(requestId?: string): Promise<OfficeRequestEvent[]> {
  await ensureOfficeRequestSchema();
  const result = requestId
    ? await db.prepare("SELECT * FROM office_request_events WHERE request_id = ? ORDER BY id DESC").bind(requestId).all<OfficeRequestEventRow>()
    : await db.prepare("SELECT * FROM office_request_events ORDER BY id DESC LIMIT 500").all<OfficeRequestEventRow>();
  return (result.results || []).map((row) => ({ id: row.id, requestId: row.request_id, action: row.action,
    fromStatus: row.from_status, toStatus: row.to_status, actorName: row.actor_name, note: row.note, createdAt: row.created_at }));
}
