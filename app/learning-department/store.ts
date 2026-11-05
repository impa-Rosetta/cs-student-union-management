import { getDb } from "../db.ts";
import type { Attachment } from "../product-model.ts";
import type { WhiteCardStatus } from "./state-machine.ts";

const db = getDb();
const parse = <T>(value: string, fallback: T): T => { try { return JSON.parse(value) as T; } catch { return fallback; } };

export type WhiteCardSubmission = {
  id: string; title: string; status: WhiteCardStatus; submitterUsername: string; submitterName: string;
  attachments: Attachment[]; handlerUsername: string; handlerName: string; articleUrl: string;
  reviewerUsername: string; reviewerName: string; returnTarget: string; returnReason: string;
  createdAt: string; updatedAt: string; archivedAt: string;
};

export type WhiteCardEvent = {
  id: number; submissionId: string; action: string; fromStatus: string; toStatus: string;
  actorUsername: string; actorName: string; note: string; createdAt: string;
};

export async function ensureWhiteCardSchema() {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS white_card_submissions (
      id TEXT PRIMARY KEY,title TEXT NOT NULL,status TEXT NOT NULL,submitter_username TEXT NOT NULL,submitter_name TEXT NOT NULL,
      attachments_json TEXT NOT NULL DEFAULT '[]',handler_username TEXT NOT NULL DEFAULT '',handler_name TEXT NOT NULL DEFAULT '',
      article_url TEXT NOT NULL DEFAULT '',reviewer_username TEXT NOT NULL DEFAULT '',reviewer_name TEXT NOT NULL DEFAULT '',
      return_target TEXT NOT NULL DEFAULT '',return_reason TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,archived_at TEXT NOT NULL DEFAULT '')`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_white_card_submissions_status ON white_card_submissions(status,updated_at)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS white_card_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,submission_id TEXT NOT NULL,action TEXT NOT NULL,from_status TEXT NOT NULL,
      to_status TEXT NOT NULL,actor_username TEXT NOT NULL,actor_name TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_white_card_events_submission ON white_card_events(submission_id,id)"),
  ]);
}

function mapSubmission(row: Record<string, unknown>): WhiteCardSubmission {
  return {
    id: String(row.id), title: String(row.title), status: row.status as WhiteCardStatus,
    submitterUsername: String(row.submitter_username), submitterName: String(row.submitter_name),
    attachments: parse(String(row.attachments_json), []), handlerUsername: String(row.handler_username), handlerName: String(row.handler_name),
    articleUrl: String(row.article_url), reviewerUsername: String(row.reviewer_username), reviewerName: String(row.reviewer_name),
    returnTarget: String(row.return_target), returnReason: String(row.return_reason), createdAt: String(row.created_at),
    updatedAt: String(row.updated_at), archivedAt: String(row.archived_at),
  };
}

export async function listWhiteCards() {
  await ensureWhiteCardSchema();
  const rows = await db.prepare("SELECT * FROM white_card_submissions ORDER BY updated_at DESC,id DESC").all<Record<string, unknown>>();
  return rows.results.map(mapSubmission);
}

export async function getWhiteCard(id: string) {
  await ensureWhiteCardSchema();
  const row = await db.prepare("SELECT * FROM white_card_submissions WHERE id=?").bind(id).first<Record<string, unknown>>();
  return row ? mapSubmission(row) : null;
}

export async function createWhiteCard(item: WhiteCardSubmission) {
  await ensureWhiteCardSchema();
  await db.prepare(`INSERT INTO white_card_submissions (id,title,status,submitter_username,submitter_name,attachments_json,handler_username,handler_name,article_url,reviewer_username,reviewer_name,return_target,return_reason,created_at,updated_at,archived_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(item.id,item.title,item.status,item.submitterUsername,item.submitterName,JSON.stringify(item.attachments),item.handlerUsername,item.handlerName,item.articleUrl,item.reviewerUsername,item.reviewerName,item.returnTarget,item.returnReason,item.createdAt,item.updatedAt,item.archivedAt).run();
}

export async function updateWhiteCard(item: WhiteCardSubmission) {
  await db.prepare(`UPDATE white_card_submissions SET status=?,attachments_json=?,handler_username=?,handler_name=?,article_url=?,reviewer_username=?,reviewer_name=?,return_target=?,return_reason=?,updated_at=?,archived_at=? WHERE id=?`)
    .bind(item.status,JSON.stringify(item.attachments),item.handlerUsername,item.handlerName,item.articleUrl,item.reviewerUsername,item.reviewerName,item.returnTarget,item.returnReason,item.updatedAt,item.archivedAt,item.id).run();
}

export async function claimWhiteCard(id: string, username: string, name: string) {
  await ensureWhiteCardSchema();
  await db.prepare("UPDATE white_card_submissions SET status='新媒体制作中',handler_username=?,handler_name=?,updated_at=? WHERE id=? AND status='待新媒体领取' AND handler_username='' ")
    .bind(username,name,new Date().toISOString(),id).run();
  const item = await getWhiteCard(id);
  return item?.status === "新媒体制作中" && item.handlerUsername === username ? item : null;
}

export async function addWhiteCardEvent(event: Omit<WhiteCardEvent, "id" | "createdAt">) {
  await ensureWhiteCardSchema();
  await db.prepare("INSERT INTO white_card_events (submission_id,action,from_status,to_status,actor_username,actor_name,note) VALUES (?,?,?,?,?,?,?)")
    .bind(event.submissionId,event.action,event.fromStatus,event.toStatus,event.actorUsername,event.actorName,event.note).run();
}

export async function listWhiteCardEvents() {
  await ensureWhiteCardSchema();
  const rows = await db.prepare("SELECT * FROM white_card_events ORDER BY id DESC").all<Record<string, unknown>>();
  return rows.results.map((row) => ({ id:Number(row.id), submissionId:String(row.submission_id), action:String(row.action), fromStatus:String(row.from_status), toStatus:String(row.to_status), actorUsername:String(row.actor_username), actorName:String(row.actor_name), note:String(row.note), createdAt:String(row.created_at) }));
}
