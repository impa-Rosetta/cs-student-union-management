import { getDb } from "../../db.ts";
import { insertNotifications } from "../../notification-store.ts";
import type { Attachment } from "../../product-model.ts";
import { AuthError, authErrorResponse, requireRole } from "../../server-auth.ts";
import { addWhiteCardEvent, claimWhiteCard, createWhiteCard, getWhiteCard, listWhiteCardEvents, listWhiteCards, updateWhiteCard } from "../../learning-department/store.ts";
import { isLearningMember, isMediaMember, whiteCardTransition, type WhiteCardAction } from "../../learning-department/state-machine.ts";
import { buildWhiteCardTemplate } from "../../learning-department/template-xlsx.ts";

const db = getDb();
const now = () => new Date().toISOString();
const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

type Account = { username: string; name: string; role: string; department: string };

async function accountsWhere(predicate: (account: Account) => boolean) {
  const rows = await db.prepare("SELECT username,name,role,department FROM app_accounts WHERE active=1").all<Account>();
  return rows.results.filter(predicate);
}

async function notify(recipientUsernames: string[], title: string, detail: string, id: string, level: "info" | "warning" | "success" = "warning") {
  const recipients = [...new Set(recipientUsernames.filter(Boolean))];
  if (!recipients.length) return;
  await insertNotifications([{ id:newId("notice-white-card"),recipientUsernames:recipients,title,detail,createdAt:now(),level,entity:{type:"white_card",id} }]);
}

function validAttachments(value: unknown): value is Attachment[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => item && typeof item === "object" && typeof (item as Attachment).key === "string" && typeof (item as Attachment).name === "string");
}

function requireWorkspaceAccess(user: { role: string; department: string }) {
  if (user.role !== "admin" && user.role !== "chair" && user.department !== "学习部" && user.department !== "新媒体中心") throw new AuthError(403, "当前账号不能访问白卡工作区");
}

export async function GET(request: Request) {
  try {
    const auth = await requireRole(request);
    const url = new URL(request.url);
    if (url.searchParams.get("template") === "1") {
      if (!isLearningMember(auth.user)) throw new AuthError(403, "仅学习部可以下载白卡模板");
      const body = buildWhiteCardTemplate();
      return new Response(Uint8Array.from(body).buffer, { headers:{ "Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition":`attachment; filename*=UTF-8''${encodeURIComponent("白卡名单模板.xlsx")}` } });
    }
    requireWorkspaceAccess(auth.user);
    const chairs = await accountsWhere((account) => account.role === "chair");
    return Response.json({ submissions:await listWhiteCards(),events:await listWhiteCardEvents(),chairs:chairs.map(({username,name}) => ({username,name})) });
  } catch (error) { return authErrorResponse(error,"读取白卡记录失败"); }
}

export async function POST(request: Request) {
  try {
    const auth = await requireRole(request);
    if (!isLearningMember(auth.user)) throw new AuthError(403,"仅学习部可以提交白卡附件");
    const body = await request.json() as { attachments?: unknown };
    if (!validAttachments(body.attachments)) return Response.json({error:"请至少上传一个附件"},{status:400});
    const createdAt = now();
    const item = { id:newId("white-card"),title:`${createdAt.slice(0,10)} 白卡制作`,status:"待新媒体领取" as const,submitterUsername:auth.user.username,submitterName:auth.user.name,attachments:body.attachments,handlerUsername:"",handlerName:"",articleUrl:"",reviewerUsername:"",reviewerName:"",returnTarget:"",returnReason:"",createdAt,updatedAt:createdAt,archivedAt:"" };
    await createWhiteCard(item);
    await addWhiteCardEvent({submissionId:item.id,action:"submit",fromStatus:"",toStatus:item.status,actorUsername:auth.user.username,actorName:auth.user.name,note:`提交 ${item.attachments.length} 个附件`});
    const media = await accountsWhere((account) => account.department === "新媒体中心");
    await notify(media.map((account) => account.username),"新的白卡待制作",`${auth.user.name} 已提交白卡附件，请领取处理。`,item.id);
    return Response.json({ok:true,item},{status:201});
  } catch (error) { return authErrorResponse(error,"提交白卡失败"); }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireRole(request);
    const body = await request.json() as { id?:string;action?:WhiteCardAction;note?:string;articleUrl?:string;reviewerUsername?:string;attachments?:unknown };
    if (!body.id || !body.action) return Response.json({error:"缺少白卡记录或操作"},{status:400});
    let item = await getWhiteCard(body.id);
    if (!item) return Response.json({error:"白卡记录不存在"},{status:404});
    const fromStatus = item.status;
    const action = body.action;
    const note = body.note?.trim() || "";

    if (action === "claim") {
      if (!isMediaMember(auth.user)) throw new AuthError(403,"仅新媒体中心可以领取");
      const claimed = await claimWhiteCard(item.id,auth.user.username,auth.user.name);
      if (!claimed) return Response.json({error:"该白卡已被其他成员领取，请刷新列表"},{status:409});
      item = claimed;
    } else {
      let next;
      try { next = whiteCardTransition(item.status,action); }
      catch (error) { return Response.json({error:error instanceof Error?error.message:"当前状态不能执行该操作"},{status:409}); }
      if (action === "withdraw") {
        if (!isLearningMember(auth.user) || (auth.user.role !== "admin" && item.submitterUsername !== auth.user.username)) throw new AuthError(403,"只能撤回本人提交且尚未领取的白卡");
      }
      if (action === "release") {
        if (!isMediaMember(auth.user) || (auth.user.role !== "admin" && item.handlerUsername !== auth.user.username)) throw new AuthError(403,"只有当前经办人可以释放领取");
        item.handlerUsername=""; item.handlerName="";
      }
      if (action === "submitReview") {
        if (!isMediaMember(auth.user) || (auth.user.role !== "admin" && item.handlerUsername !== auth.user.username)) throw new AuthError(403,"只有当前经办人可以提交审核");
        try { const parsed = new URL(body.articleUrl || ""); if (!/^https?:$/.test(parsed.protocol)) throw new Error(); } catch { return Response.json({error:"请填写有效的公众号推文链接"},{status:400}); }
        const reviewer = await db.prepare("SELECT username,name,role FROM app_accounts WHERE username=? AND active=1").bind(body.reviewerUsername || "").first<{username:string;name:string;role:string}>();
        if (!reviewer || reviewer.role !== "chair") return Response.json({error:"请选择有效的主席账号"},{status:400});
        item.articleUrl=body.articleUrl!.trim(); item.reviewerUsername=reviewer.username; item.reviewerName=reviewer.name; item.returnTarget=""; item.returnReason="";
      }
      if (action === "approve" || (fromStatus === "待主席审核" && (action === "returnMedia" || action === "returnLearning"))) {
        if (auth.user.role !== "admin" && (auth.user.role !== "chair" || item.reviewerUsername !== auth.user.username)) throw new AuthError(403,"仅指定主席可以审核");
        if (action !== "approve" && !note) return Response.json({error:"退回时必须填写原因"},{status:400});
      }
      if (fromStatus === "新媒体制作中" && action === "returnLearning") {
        if (!isMediaMember(auth.user) || (auth.user.role !== "admin" && item.handlerUsername !== auth.user.username)) throw new AuthError(403,"只有当前经办人可以退回学习部");
        if (!note) return Response.json({error:"退回时必须填写原因"},{status:400});
      }
      if (action === "resubmit") {
        if (!isLearningMember(auth.user) || (auth.user.role !== "admin" && item.submitterUsername !== auth.user.username)) throw new AuthError(403,"仅原提交人可以重新提交");
        if (!validAttachments(body.attachments)) return Response.json({error:"请至少上传一个附件"},{status:400});
        item.attachments=body.attachments; item.handlerUsername=""; item.handlerName=""; item.articleUrl=""; item.reviewerUsername=""; item.reviewerName=""; item.returnTarget=""; item.returnReason="";
      }
      item.status=next; item.updatedAt=now();
      if (action === "approve") item.archivedAt=item.updatedAt;
      if (action === "returnMedia") { item.returnTarget="新媒体中心"; item.returnReason=note; }
      if (action === "returnLearning") { item.returnTarget="学习部"; item.returnReason=note; }
      await updateWhiteCard(item);
    }

    await addWhiteCardEvent({submissionId:item.id,action,fromStatus,toStatus:item.status,actorUsername:auth.user.username,actorName:auth.user.name,note});
    if (action === "submitReview") await notify([item.reviewerUsername],"白卡推文待审核",`${item.handlerName} 已提交公众号推文，请审核。`,item.id);
    if (action === "returnMedia") await notify([item.handlerUsername],"白卡推文已退回",note,item.id);
    if (action === "returnLearning") {
      const learning = await accountsWhere((account) => account.department === "学习部");
      await notify([...learning.map((account) => account.username),item.submitterUsername],"白卡附件需修改",note,item.id);
    }
    if (action === "resubmit") {
      const media = await accountsWhere((account) => account.department === "新媒体中心");
      await notify(media.map((account) => account.username),"白卡已重新提交",`${item.submitterName} 已更新白卡附件，请重新领取。`,item.id);
    }
    if (action === "approve") await notify([item.submitterUsername,item.handlerUsername],"白卡推文审核通过",`${auth.user.name} 已审核通过，流程已归档。`,item.id,"success");
    return Response.json({ok:true,item});
  } catch (error) { return authErrorResponse(error,"处理白卡失败"); }
}
