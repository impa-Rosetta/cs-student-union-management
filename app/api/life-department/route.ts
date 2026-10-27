import { getDb } from "../../db.ts";
import { insertNotifications } from "../../notification-store.ts";
import { addOfficeRequestEvent, listOfficeRequests, upsertOfficeRequest, type OfficeRequest } from "../../office-request-store.ts";
import { authErrorResponse, requireRole } from "../../server-auth.ts";
import { recordWorkflowEvent } from "../../workflow-events.ts";
import {
  addLostFoundEvent, addPurchaseEvent, createBatch, createLostFound, createPurchase, createRoom, getBatch, getLostFound, getPurchase,
  listBatches, listInspectionRecords, listLifeEvents, listLostFound, listPurchases, listRooms, updateBatch, updateLostFound,
  updatePurchase, updatePurchaseContent, upsertInspectionRecord, type DormRoom, type InspectionBatch, type InspectionRecord, type LostFoundItem,
  type PurchaseItem, type PurchaseRequest,
} from "../../life-department/store.ts";
import {
  inspectionTransition, isLifeManager, lostFoundTransition, purchaseTransition,
  type InspectionAction, type LostFoundAction, type PurchaseAction,
} from "../../life-department/state-machines.ts";
import type { Attachment } from "../../product-model.ts";

const db = getDb();
const now = () => new Date().toISOString();
const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;

function normalizePurchaseItems(items: PurchaseItem[]) {
  return items.map((item) => ({
    name: item.name?.trim() || "",
    imageUrl: item.imageUrl?.trim() || "",
    productUrl: item.productUrl?.trim() || "",
    quantity: Number(item.quantity),
    estimatedUnitPrice: Number(item.estimatedUnitPrice),
    note: item.note?.trim() || "",
  }));
}

function validatePurchase(title: string, purpose: string, items: PurchaseItem[]) {
  if (!title.trim() || !purpose.trim() || !items.length) return "请填写采购标题、用途和至少一项有效物品";
  if (items.some((item) => !item.name || !Number.isInteger(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.estimatedUnitPrice) || item.estimatedUnitPrice < 0)) return "采购明细的名称、数量或预算单价无效";
  if (items.some((item) => !item.imageUrl && !item.productUrl)) return "每项物品至少需要商品图片或商品链接";
  return "";
}

async function notify(options: { department?: string; roles?: string[]; usernames?: string[]; actor: string; title: string; detail: string; type: string; id: string; level?: "info"|"success"|"warning" }) {
  const rows = await db.prepare("SELECT username,role,department FROM app_accounts WHERE active=1").all<{username:string;role:string;department:string}>();
  const recipients = rows.results.filter((account) => options.usernames?.includes(account.username) || (options.roles?.includes(account.role) && (!options.department || account.department === options.department)) || (options.department && account.department === options.department)).map((account)=>account.username);
  const recipientUsernames=[...new Set(recipients)].filter((item)=>item!==options.actor); if(!recipientUsernames.length)return;
  await insertNotifications([{id:newId("notice-life"),recipientUsernames,title:options.title,detail:options.detail,createdAt:now(),level:options.level||"info",entity:{type:options.type,id:options.id}}]);
}

export async function GET(request: Request) {
  try {
    const auth=await requireRole(request);
    const [purchases,rooms,batches,records,lostFound,events,officeRequests]=await Promise.all([listPurchases(),listRooms(),listBatches(),listInspectionRecords(),listLostFound(),listLifeEvents(),listOfficeRequests()]);
    const officeMap=new Map(officeRequests.map((item)=>[item.id,item]));
    for(const purchase of purchases){
      if(!purchase.officeRequestId)continue; const office=officeMap.get(purchase.officeRequestId); purchase.officeStatus=office?.status||"关联报销不存在";
      if(office?.status==="已完成"&&purchase.status==="待办公室报销"){const before=purchase.status;purchase.status="已完成";purchase.updatedAt=now();await updatePurchase(purchase);await addPurchaseEvent({entityId:purchase.id,action:"officeComplete",fromStatus:before,toStatus:"已完成",actorName:"办公室报销流程",note:`关联报销 ${office.id} 已完成`});}
    }
    const canSeeSecret=isLifeManager(auth.user);
    return Response.json({purchases,rooms,batches,records,lostFound:lostFound.map((item)=>canSeeSecret?item:{...item,secretFeature:"",claimantContact:"",verificationNote:""}),...events,permissions:{canManage:isLifeManager(auth.user)}});
  } catch(error){return authErrorResponse(error,"读取生活部数据失败");}
}

export async function POST(request: Request) {
  try {
    const auth=await requireRole(request,["admin","chair","leader","staff"]); const body=await request.json() as Record<string,unknown>; const kind=String(body.kind||"");
    if(kind==="purchase"){
      const input=(body.purchase as Partial<PurchaseRequest>|undefined)||{}; const items=normalizePurchaseItems((body.items as PurchaseItem[])||[]);const title=input.title||"";const purpose=input.purpose||"";
      const validationError=validatePurchase(title,purpose,items);if(validationError)return Response.json({error:validationError},{status:400});
      const timestamp=now(); const purchase:PurchaseRequest={id:newId("purchase"),title:title.trim(),status:"草稿",requesterUsername:auth.user.username,requesterName:auth.user.name,requesterDepartment:auth.user.department,activityId:input.activityId||"",activityName:input.activityName||"非活动事项",purpose:purpose.trim(),expectedAt:input.expectedAt||"",estimatedTotal:items.reduce((sum,item)=>sum+Number(item.quantity)*Number(item.estimatedUnitPrice),0),actualTotal:0,payee:input.payee||auth.user.name,supplier:"",orderNumber:"",handlerName:"",officeRequestId:"",attachments:(input.attachments||[]) as Attachment[],items:items.map((item)=>({...item,quantity:Number(item.quantity),estimatedUnitPrice:Number(item.estimatedUnitPrice)})),createdAt:timestamp,updatedAt:timestamp};
      await createPurchase(purchase);await addPurchaseEvent({entityId:purchase.id,action:"create",fromStatus:"",toStatus:"草稿",actorName:auth.user.name,note:"创建采购申请"});return Response.json({ok:true,item:purchase},{status:201});
    }
    if(kind==="room"){
      if(!isLifeManager(auth.user))return Response.json({error:"只有生活部成员、主席或管理员可以维护寝室档案"},{status:403}); const room=body.room as Partial<DormRoom>|undefined;
      if(!room?.building?.trim()||!room.roomNumber?.trim())return Response.json({error:"楼栋和寝室号不能为空"},{status:400});
      if((await listRooms()).some((item)=>item.building===room.building&&item.roomNumber===room.roomNumber))return Response.json({error:"该楼栋寝室号已存在"},{status:409});
      await createRoom({building:room.building.trim(),floor:room.floor||"",roomNumber:room.roomNumber.trim(),leaderName:room.leaderName||"",contact:room.contact||"",residentCount:Number(room.residentCount||0),note:room.note||"",active:true});return Response.json({ok:true},{status:201});
    }
    if(kind==="batch"){
      if(!isLifeManager(auth.user))return Response.json({error:"只有生活部成员、主席或管理员可以创建查寝批次"},{status:403}); const input=body.batch as Partial<InspectionBatch>|undefined;
      if(!input?.name?.trim()||!input.roomIds?.length)return Response.json({error:"批次名称和目标寝室不能为空"},{status:400}); const timestamp=now(); const item:InspectionBatch={id:newId("inspection"),name:input.name.trim(),status:"草稿",plannedDate:input.plannedDate||"",leaderName:input.leaderName||auth.user.name,inspectors:input.inspectors||[],roomIds:input.roomIds.map(Number),scoringNote:input.scoringNote||"卫生、整洁、安全各10分",createdAt:timestamp,updatedAt:timestamp};await createBatch(item);return Response.json({ok:true,item},{status:201});
    }
    if(kind==="inspectionRecord"){
      if(!isLifeManager(auth.user))return Response.json({error:"只有生活部成员、主席或管理员可以录入查寝"},{status:403}); const input=body.record as Partial<InspectionRecord>|undefined; const batch=input?.batchId?await getBatch(input.batchId):null;
      if(!batch||!input?.roomId||!batch.roomIds.includes(Number(input.roomId)))return Response.json({error:"查寝批次或寝室无效"},{status:400}); const scores=[input.hygieneScore,input.tidinessScore,input.safetyScore].map(Number);if(scores.some((score)=>score<0||score>10))return Response.json({error:"评分必须在0到10分之间"},{status:400});
      const previous=(await listInspectionRecords()).find((item)=>item.batchId===batch.id&&item.roomId===Number(input.roomId)); const record:InspectionRecord={id:previous?.id,batchId:batch.id,roomId:Number(input.roomId),hygieneScore:scores[0],tidinessScore:scores[1],safetyScore:scores[2],issueNote:input.issueNote||"",photos:(input.photos||previous?.photos||[]) as Attachment[],needsRectification:Boolean(input.needsRectification),rectificationDeadline:input.rectificationDeadline||"",rectificationNote:input.rectificationNote||previous?.rectificationNote||"",reviewResult:input.reviewResult||previous?.reviewResult||"",reviewPhotos:(input.reviewPhotos||previous?.reviewPhotos||[]) as Attachment[],inspectorName:previous?.inspectorName||auth.user.name,inspectedAt:previous?.inspectedAt||now(),reviewerName:input.reviewResult?auth.user.name:previous?.reviewerName||"",reviewedAt:input.reviewResult?now():previous?.reviewedAt||""};await upsertInspectionRecord(record);return Response.json({ok:true,item:record});
    }
    if(kind==="lostFound"){
      const input=body.item as Partial<LostFoundItem>|undefined;if(!input?.name?.trim()||!input.foundLocation?.trim()||!input.foundAt)return Response.json({error:"物品名称、拾取地点和时间不能为空"},{status:400});const timestamp=now();const item:LostFoundItem={id:newId("lost"),name:input.name.trim(),category:input.category||"其他",status:"待整理",foundLocation:input.foundLocation.trim(),foundAt:input.foundAt,storageLocation:input.storageLocation||"生活部保管处",publicDescription:input.publicDescription||"",secretFeature:input.secretFeature||"",photos:(input.photos||[]) as Attachment[],registrantUsername:auth.user.username,registrantName:auth.user.name,publishUrl:"",claimantName:"",claimantStudentNo:"",claimantContact:"",verificationNote:"",handlerName:"",claimedAt:"",createdAt:timestamp,updatedAt:timestamp};await createLostFound(item);await addLostFoundEvent({entityId:item.id,action:"create",fromStatus:"",toStatus:"待整理",actorName:auth.user.name,note:"登记失物"});return Response.json({ok:true,item},{status:201});
    }
    return Response.json({error:"未知生活部业务类型"},{status:400});
  }catch(error){return authErrorResponse(error,"保存生活部业务失败");}
}

export async function PATCH(request:Request){
  try{
    const auth=await requireRole(request,["admin","chair","leader","staff"]);const body=await request.json() as {kind?:string;id?:string;action?:string;note?:string;data?:Record<string,unknown>};if(!body.kind||!body.id||!body.action)return Response.json({error:"业务类型、编号和操作不能为空"},{status:400});const note=body.note?.trim()||"";const data=body.data||{};
    if(body.kind==="purchase"){
      const item=await getPurchase(body.id);if(!item)return Response.json({error:"采购申请不存在"},{status:404});
      if(body.action==="update"){
        if(item.requesterUsername!==auth.user.username)return Response.json({error:"只有申请人可以修改采购申请"},{status:403});
        if(item.status!=="草稿"&&item.status!=="待补充材料")return Response.json({error:`当前状态为“${item.status}”，不能修改采购申请`},{status:409});
        const items=normalizePurchaseItems((data.items as PurchaseItem[])||[]);const title=String(data.title||"").trim();const purpose=String(data.purpose||"").trim();const validationError=validatePurchase(title,purpose,items);if(validationError)return Response.json({error:validationError},{status:400});
        const saved:PurchaseRequest={...item,title,purpose,activityId:String(data.activityId||""),activityName:String(data.activityName||"非活动事项"),expectedAt:String(data.expectedAt||""),payee:String(data.payee||auth.user.name),attachments:Array.isArray(data.attachments)?data.attachments as Attachment[]:[],items,estimatedTotal:items.reduce((sum,part)=>sum+part.quantity*part.estimatedUnitPrice,0),updatedAt:now()};
        await updatePurchaseContent(saved);await addPurchaseEvent({entityId:item.id,action:"update",fromStatus:item.status,toStatus:item.status,actorName:auth.user.name,note:"申请人更新采购内容与材料"});await recordWorkflowEvent({entityType:"purchase_request",entityId:item.id,action:"update",fromStatus:item.status,toStatus:item.status,reason:"申请人更新采购内容与材料"},auth.user.name,auth.user.role);const events=(await listLifeEvents()).purchaseEvents.filter((event)=>event.entityId===item.id);return Response.json({ok:true,item:saved,events});
      }
      const result=purchaseTransition(item.status,body.action as PurchaseAction,auth.user,item.requesterUsername);if(!result.ok)return Response.json({error:result.reason},{status:result.reason.startsWith("只有")?403:409});if(["return","reject","reopen"].includes(body.action)&&!note)return Response.json({error:"该操作必须填写原因"},{status:400});
      if(body.action==="purchased"){item.actualTotal=Number(data.actualTotal||0);item.supplier=String(data.supplier||"");item.orderNumber=String(data.orderNumber||"");item.payee=String(data.payee||item.payee);item.attachments=(data.attachments as Attachment[])||item.attachments;if(item.actualTotal<=0||!item.supplier||!item.orderNumber)return Response.json({error:"请填写实际金额、供应商和订单号"},{status:400});}
      if(body.action==="transfer"){
        if(item.officeRequestId)return Response.json({error:"该采购已生成办公室报销，不能重复提交"},{status:409});if(item.actualTotal<=0)return Response.json({error:"请先登记实际采购金额"},{status:400});const timestamp=now();const office:OfficeRequest={id:newId("office-purchase"),type:"reimbursement",title:`${item.title}报销`,status:"待办公室审核",requesterUsername:item.requesterUsername,requesterName:item.requesterName,requesterDepartment:item.requesterDepartment,activityId:item.activityId,activityName:item.activityName,deadline:"",description:item.purpose,details:{amount:String(item.actualTotal),expenseCategory:"活动物资",payee:item.payee,budgetItem:item.title,purchaseRequestId:item.id,supplier:item.supplier,orderNumber:item.orderNumber},materials:[{key:"invoice",label:"发票已签名",checked:item.attachments.length>0},{key:"order",label:"订单或购买记录截图",checked:item.attachments.length>0}],attachments:item.attachments,externalPlatform:"",externalReference:"",handlerName:"",createdAt:timestamp,updatedAt:timestamp};await upsertOfficeRequest(office);await addOfficeRequestEvent({requestId:office.id,action:"createdFromPurchase",fromStatus:"",toStatus:"待办公室审核",actorName:auth.user.name,note:`由采购申请 ${item.id} 自动生成`});item.officeRequestId=office.id;await notify({department:"办公室",roles:["admin","chair"],actor:auth.user.username,title:"生活部采购待报销",detail:`${item.title}已完成采购，请审核报销材料。`,type:"officeRequest",id:office.id,level:"warning"});
      }
      const before=item.status;item.status=result.next;item.handlerName=isLifeManager(auth.user)?auth.user.name:item.handlerName;item.updatedAt=now();await updatePurchase(item);await addPurchaseEvent({entityId:item.id,action:body.action,fromStatus:before,toStatus:item.status,actorName:auth.user.name,note});await recordWorkflowEvent({entityType:"purchase_request",entityId:item.id,action:body.action,fromStatus:before,toStatus:item.status,reason:note||undefined},auth.user.name,auth.user.role);if(body.action==="submit")await notify({department:"生活部",roles:["admin","chair"],actor:auth.user.username,title:"新的采购申请",detail:`${item.requesterDepartment}提交“${item.title}”`,type:"purchase",id:item.id,level:"warning"});return Response.json({ok:true,item});
    }
    if(body.kind==="batch"){
      const item=await getBatch(body.id);if(!item)return Response.json({error:"查寝批次不存在"},{status:404});const result=inspectionTransition(item.status,body.action as InspectionAction,auth.user);if(!result.ok)return Response.json({error:result.reason},{status:result.reason.startsWith("只有")?403:409});if(body.action==="reopen"&&!note)return Response.json({error:"重新打开必须填写原因"},{status:400});const records=(await listInspectionRecords()).filter((record)=>record.batchId===item.id);if(body.action==="archive"){if(item.roomIds.some((id)=>!records.some((record)=>record.roomId===id)))return Response.json({error:"所有目标寝室完成检查后才能归档"},{status:409});if(item.status==="进行中"&&records.some((record)=>record.needsRectification))return Response.json({error:"存在需整改寝室，请先进入整改流程"},{status:409});if(item.status==="待复查"&&records.some((record)=>record.needsRectification&&!record.reviewResult))return Response.json({error:"所有整改寝室完成复查后才能归档"},{status:409});}const before=item.status;item.status=result.next;item.updatedAt=now();await updateBatch(item);await recordWorkflowEvent({entityType:"dorm_inspection",entityId:item.id,action:body.action,fromStatus:before,toStatus:item.status,reason:note||undefined},auth.user.name,auth.user.role);return Response.json({ok:true,item});
    }
    if(body.kind==="lostFound"){
      const item=await getLostFound(body.id);if(!item)return Response.json({error:"失物记录不存在"},{status:404});const result=lostFoundTransition(item.status,body.action as LostFoundAction,auth.user);if(!result.ok)return Response.json({error:result.reason},{status:result.reason.startsWith("只有")?403:409});if(body.action==="publish"){item.publishUrl=String(data.publishUrl||"");if(!item.publishUrl)return Response.json({error:"请填写新媒体发布链接"},{status:400});}if(body.action==="claim"){item.claimantName=String(data.claimantName||"");item.claimantStudentNo=String(data.claimantStudentNo||"");item.claimantContact=String(data.claimantContact||"");if(!item.claimantName||!item.claimantStudentNo)return Response.json({error:"请填写认领人姓名和学号"},{status:400});}if(body.action==="return"){item.verificationNote=String(data.verificationNote||"");if(!item.verificationNote)return Response.json({error:"确认归还前必须填写核验说明"},{status:400});item.claimedAt=now();}if(body.action==="reopen"&&!note)return Response.json({error:"重新打开必须填写原因"},{status:400});const before=item.status;item.status=result.next;item.handlerName=auth.user.name;item.updatedAt=now();await updateLostFound(item);await addLostFoundEvent({entityId:item.id,action:body.action,fromStatus:before,toStatus:item.status,actorName:auth.user.name,note});await recordWorkflowEvent({entityType:"lost_found",entityId:item.id,action:body.action,fromStatus:before,toStatus:item.status,reason:note||undefined},auth.user.name,auth.user.role);if(body.action==="submitPublish")await notify({department:"新媒体中心",actor:auth.user.username,title:"失物招领待发布",detail:`请发布“${item.name}”的失物招领信息。`,type:"lostFound",id:item.id,level:"warning"});return Response.json({ok:true,item});
    }
    return Response.json({error:"未知业务类型"},{status:400});
  }catch(error){return authErrorResponse(error,"更新生活部业务失败");}
}
