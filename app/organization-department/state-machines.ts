export type OrganizationActor = { role: "admin" | "chair" | "leader" | "staff" | "teacher"; department: string; username: string };
export const isOrganizationManager = (actor: Pick<OrganizationActor,"role"|"department">) => actor.role === "admin" || actor.role === "chair" || actor.department === "组织部";
export const isPresidium = (actor: Pick<OrganizationActor,"role">) => actor.role === "admin" || actor.role === "chair";
type Result<T extends string> = {ok:true;next:T}|{ok:false;reason:string};
const denied=<T extends string>(reason:string):Result<T>=>({ok:false,reason});

export const CHANGE_STATUSES=["草稿","待组织部审核","待申请人修改","待主席团确认","待组织部复核","已生效","已驳回"] as const;
export type ChangeStatus=(typeof CHANGE_STATUSES)[number];
export type ChangeAction="submit"|"organizationApprove"|"organizationReturn"|"organizationReject"|"presidiumConfirm"|"presidiumReturn"|"presidiumReject"|"resubmit"|"resubmitReview";
export function changeTransition(current:ChangeStatus,action:ChangeAction,actor:OrganizationActor,requesterUsername:string):Result<ChangeStatus>{
  const owner=actor.username===requesterUsername;
  if(action==="submit") return owner&&current==="草稿"?{ok:true,next:"待组织部审核"}:denied("只有申请人可以提交草稿");
  if(action==="resubmit") return owner&&current==="待申请人修改"?{ok:true,next:"待组织部审核"}:denied("只有申请人可以重新提交待修改申请");
  if(action==="organizationApprove") return isOrganizationManager(actor)&&current==="待组织部审核"?{ok:true,next:"待主席团确认"}:denied("只有组织部、主席或管理员可以审核待组织部申请");
  if(action==="organizationReturn") return isOrganizationManager(actor)&&current==="待组织部审核"?{ok:true,next:"待申请人修改"}:denied("当前申请不能退回申请人");
  if(action==="organizationReject") return isOrganizationManager(actor)&&current==="待组织部审核"?{ok:true,next:"已驳回"}:denied("当前申请不能由组织部驳回");
  if(action==="presidiumConfirm") return isPresidium(actor)&&current==="待主席团确认"?{ok:true,next:"已生效"}:denied("只有主席或管理员可以确认待主席团申请");
  if(action==="presidiumReturn") return isPresidium(actor)&&current==="待主席团确认"?{ok:true,next:"待组织部复核"}:denied("当前申请不能退回组织部");
  if(action==="presidiumReject") return isPresidium(actor)&&current==="待主席团确认"?{ok:true,next:"已驳回"}:denied("当前申请不能由主席团驳回");
  if(action==="resubmitReview") return isOrganizationManager(actor)&&current==="待组织部复核"?{ok:true,next:"待主席团确认"}:denied("只有组织部、主席或管理员可以重新提交复核申请");
  return denied("未知成员异动操作");
}

export const ASSESSMENT_STATUSES=["草稿","进行中","待确认","已归档"] as const;
export type AssessmentStatus=(typeof ASSESSMENT_STATUSES)[number];
export type AssessmentAction="start"|"submit"|"confirm"|"return";
export function assessmentTransition(current:AssessmentStatus,action:AssessmentAction,actor:OrganizationActor):Result<AssessmentStatus>{
  if(action==="start") return isOrganizationManager(actor)&&current==="草稿"?{ok:true,next:"进行中"}:denied("只有组织部、主席或管理员可以开始草稿考核");
  if(action==="submit") return isOrganizationManager(actor)&&current==="进行中"?{ok:true,next:"待确认"}:denied("只有组织部、主席或管理员可以提交进行中的考核");
  if(action==="confirm") return isPresidium(actor)&&current==="待确认"?{ok:true,next:"已归档"}:denied("只有主席或管理员可以确认考核结果");
  if(action==="return") return isPresidium(actor)&&current==="待确认"?{ok:true,next:"进行中"}:denied("只有主席或管理员可以退回考核");
  return denied("未知考核操作");
}

export const AFFAIR_STATUSES=["草稿","办理中","待结果确认","已完成","已归档"] as const;
export type AffairStatus=(typeof AFFAIR_STATUSES)[number];
export type AffairAction="start"|"submitResult"|"confirm"|"archive"|"return";
export function affairTransition(current:AffairStatus,action:AffairAction,actor:OrganizationActor):Result<AffairStatus>{
  if(!isOrganizationManager(actor))return denied("只有组织部、主席或管理员可以处理组织事务");
  if(action==="start"&&current==="草稿")return{ok:true,next:"办理中"};
  if(action==="submitResult"&&current==="办理中")return{ok:true,next:"待结果确认"};
  if(action==="confirm"&&current==="待结果确认"&&isPresidium(actor))return{ok:true,next:"已完成"};
  if(action==="archive"&&current==="已完成")return{ok:true,next:"已归档"};
  if(action==="return"&&current==="待结果确认"&&isPresidium(actor))return{ok:true,next:"办理中"};
  return denied(`当前状态为“${current}”，不能执行该操作`);
}
