"use client";

import { ArrowLeft, Building2, Check, CheckCircle2, ChevronRight, CircleAlert, Clock3, FileText, Paperclip, Plus, Receipt, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ActivityRecord, Attachment, DemoUser, UserRole } from "./product-model";
import type { OfficeMaterial, OfficeRequest, OfficeRequestEvent, OfficeRequestType } from "./office-request-store";
import { isOfficeManager, type OfficeRequestAction } from "./office-workflow/state-machine";

const TYPE_LABELS: Record<OfficeRequestType, string> = { venue: "场地申请", reimbursement: "报销申请" };
const FILTERS = ["全部", "草稿", "待办公室审核", "待补充材料", "外部办理中", "已完成", "已驳回"];
const ACTION_LABELS: Record<string, string> = { create: "创建草稿", submit: "提交审核", return: "退回补充", reject: "驳回申请", process: "进入外部办理", complete: "确认办结", reopen: "重新打开" };
const MATERIALS: Record<OfficeRequestType, OfficeMaterial[]> = {
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
const DETAIL_LABELS: Record<string, string> = { startTime: "使用开始", endTime: "使用结束", attendeeCount: "预计人数", roomType: "教室类型", equipment: "设备要求", amount: "报销金额", expenseCategory: "费用类别", payee: "收款人", budgetItem: "预算项目" };

type Draft = { type: OfficeRequestType; title: string; activityId: string; deadline: string; description: string; details: Record<string, string>; materials: OfficeMaterial[]; attachments: Attachment[] };
function emptyDraft(type: OfficeRequestType = "venue"): Draft { return { type, title: "", activityId: "", deadline: "", description: "", details: {}, materials: MATERIALS[type].map((item) => ({ ...item })), attachments: [] }; }
function tone(status: string) { return status === "已完成" ? "success" : status === "已驳回" || status === "待补充材料" ? "warning" : status === "外部办理中" ? "processing" : "pending"; }

export function OfficeWorkspace({ user, role, activities, notify, onBack }: { user: DemoUser; role: UserRole; activities: ActivityRecord[]; notify: (message: string) => void; onBack?: () => void }) {
  const [items, setItems] = useState<OfficeRequest[]>([]);
  const [events, setEvents] = useState<OfficeRequestEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("全部");
  const [selected, setSelected] = useState<OfficeRequest | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<OfficeRequestAction | null>(null);
  const [note, setNote] = useState("");
  const [externalPlatform, setExternalPlatform] = useState("");
  const [externalReference, setExternalReference] = useState("");

  // 工作区首次打开时从服务端读取申请；后续操作会同时更新列表与当前详情。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void fetch("/api/office-requests").then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.error || "读取失败"); setItems(result.items || []); setEvents(result.events || []); }).catch((error) => notify(error instanceof Error ? error.message : "办公室申请读取失败")).finally(() => setLoading(false)); }, []);
  const visible = useMemo(() => filter === "全部" ? items : items.filter((item) => item.status === filter), [filter, items]);
  const manager = isOfficeManager({ role, department: user.department });
  const selectedEvents = selected ? events.filter((event) => event.requestId === selected.id) : [];

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const uploaded: Attachment[] = [];
      for (const file of Array.from(files)) {
        const data = new FormData(); data.append("file", file);
        const response = await fetch("/api/files", { method: "POST", body: data });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `${file.name} 上传失败`);
        uploaded.push(result.attachment);
      }
      setDraft((current) => ({ ...current, attachments: [...current.attachments, ...uploaded] })); notify(`已上传 ${uploaded.length} 个附件`);
    } catch (error) { notify(error instanceof Error ? error.message : "附件上传失败"); } finally { setBusy(false); }
  }

  async function createRequest() {
    if (!draft.title.trim()) return notify("请填写申请标题");
    const activity = activities.find((item) => item.id === draft.activityId);
    setBusy(true);
    try {
      const response = await fetch("/api/office-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, activityName: activity?.name || "非活动事项" }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "保存失败");
      setItems((current) => [result.item, ...current]);
      setEvents((current) => [{ id: Date.now(), requestId: result.item.id, action: "create", fromStatus: "", toStatus: "草稿", actorName: user.name, note: "创建申请草稿", createdAt: new Date().toISOString() }, ...current]);
      setCreating(false); setDraft(emptyDraft()); setSelected(result.item); notify("申请草稿已保存，可以检查后提交");
    } catch (error) { notify(error instanceof Error ? error.message : "保存失败"); } finally { setBusy(false); }
  }

  async function runAction() {
    if (!selected || !action) return;
    setBusy(true);
    try {
      const response = await fetch("/api/office-requests", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: selected.id, action, note, externalPlatform, externalReference }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "操作失败");
      setItems((current) => current.map((item) => item.id === selected.id ? result.item : item));
      setEvents((current) => [...(result.events || []), ...current.filter((event) => event.requestId !== selected.id)]);
      setSelected(result.item); setAction(null); setNote(""); notify(`${ACTION_LABELS[action]}成功`);
    } catch (error) { notify(error instanceof Error ? error.message : "操作失败"); } finally { setBusy(false); }
  }

  function openAction(next: OfficeRequestAction) { setAction(next); setNote(""); setExternalPlatform(selected?.externalPlatform || (selected?.type === "venue" ? "教务平台 / OA" : "财务报销平台")); setExternalReference(selected?.externalReference || ""); }

  return <div className="module-page office-workspace">
    {onBack && <button className="department-back" onClick={onBack}><ArrowLeft size={15}/>返回全部部门</button>}
    <div className="module-header"><div><span className="module-kicker">部门办事中心 / 办公室</span><h1>办公室办事中心</h1><p>统一处理场地借用与经费报销，外部系统办理结果在这里留痕。</p></div>{role !== "teacher" && <button className="primary-button" onClick={() => { setDraft(emptyDraft()); setCreating(true); }}><Plus size={18}/>新建申请</button>}</div>
    <div className="office-stats"><article><span>全部申请</span><strong>{items.length}</strong><small>场地 {items.filter((item) => item.type === "venue").length} · 报销 {items.filter((item) => item.type === "reimbursement").length}</small></article><article><span>待办公室处理</span><strong>{items.filter((item) => item.status === "待办公室审核").length}</strong><small>需要审核材料</small></article><article><span>外部办理中</span><strong>{items.filter((item) => item.status === "外部办理中").length}</strong><small>OA / 教务 / 财务平台</small></article><article><span>本期已完成</span><strong>{items.filter((item) => item.status === "已完成").length}</strong><small>全过程已留痕</small></article></div>
    <div className="office-filter-bar">{FILTERS.map((status) => <button key={status} className={filter === status ? "active" : ""} onClick={() => setFilter(status)}>{status}<b>{status === "全部" ? items.length : items.filter((item) => item.status === status).length}</b></button>)}</div>
    <div className="office-request-list"><div className="office-request-head"><span/><span>申请事项</span><span>关联活动</span><span>申请部门 / 申请人</span><span>截止时间</span><span>状态</span><span/></div>{visible.map((item) => <button key={item.id} onClick={() => setSelected(item)}><i className={item.type}>{item.type === "venue" ? <Building2 size={17}/> : <Receipt size={17}/>}</i><span><strong>{item.title}</strong><small>{TYPE_LABELS[item.type]} · {item.id}</small></span><span>{item.activityName || "非活动事项"}</span><span><strong>{item.requesterDepartment}</strong><small>{item.requesterName}</small></span><span>{item.deadline ? new Date(item.deadline).toLocaleString("zh-CN", { hour12: false }) : "未设置"}</span><em className={tone(item.status)}>{item.status}</em><ChevronRight size={16}/></button>)}{!loading && !visible.length && <div className="office-empty"><FileText size={24}/><strong>暂无符合条件的申请</strong><span>可以新建一份场地或报销申请进行体验</span></div>}{loading && <div className="office-empty"><Clock3 size={24}/><strong>正在读取申请</strong></div>}</div>

    {creating && <div className="modal-backdrop"><div className="office-form-modal"><header><div><span>办公室办事中心</span><h2>新建申请</h2></div><button className="icon-button" onClick={() => setCreating(false)}><X size={18}/></button></header><div className="office-form-body"><div className="office-type-picker"><button className={draft.type === "venue" ? "active" : ""} onClick={() => setDraft(emptyDraft("venue"))}><Building2 size={20}/><span><strong>场地申请</strong><small>教室、会议室及活动场地</small></span></button><button className={draft.type === "reimbursement" ? "active" : ""} onClick={() => setDraft(emptyDraft("reimbursement"))}><Receipt size={20}/><span><strong>报销申请</strong><small>日常费用与大型活动经费</small></span></button></div>
      <div className="form-grid"><label className="span-2"><span>申请标题 *</span><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder={draft.type === "venue" ? "例如：秋招分享会教室申请" : "例如：十佳歌手横幅制作费报销"}/></label><label><span>关联活动</span><select value={draft.activityId} onChange={(event) => setDraft({ ...draft, activityId: event.target.value })}><option value="">非活动事项</option>{activities.map((activity) => <option key={activity.id} value={activity.id}>{activity.name}</option>)}</select></label><label><span>期望办结时间</span><input type="datetime-local" value={draft.deadline} onChange={(event) => setDraft({ ...draft, deadline: event.target.value })}/></label>
      {draft.type === "venue" ? <><label><span>使用开始时间</span><input type="datetime-local" value={draft.details.startTime || ""} onChange={(event) => setDraft({ ...draft, details: { ...draft.details, startTime: event.target.value } })}/></label><label><span>使用结束时间</span><input type="datetime-local" value={draft.details.endTime || ""} onChange={(event) => setDraft({ ...draft, details: { ...draft.details, endTime: event.target.value } })}/></label><label><span>预计人数</span><input type="number" min="1" value={draft.details.attendeeCount || ""} onChange={(event) => setDraft({ ...draft, details: { ...draft.details, attendeeCount: event.target.value } })}/></label><label><span>教室类型</span><select value={draft.details.roomType || "普通教室"} onChange={(event) => setDraft({ ...draft, details: { ...draft.details, roomType: event.target.value } })}><option>普通教室</option><option>收费教室</option><option>会议室</option><option>室外场地</option></select></label><label className="span-2"><span>设备与场地要求</span><input value={draft.details.equipment || ""} onChange={(event) => setDraft({ ...draft, details: { ...draft.details, equipment: event.target.value } })} placeholder="投影、话筒、桌椅布置等"/></label></> : <><label><span>报销金额（元）</span><input type="number" min="0" step="0.01" value={draft.details.amount || ""} onChange={(event) => setDraft({ ...draft, details: { ...draft.details, amount: event.target.value } })}/></label><label><span>费用类别</span><select value={draft.details.expenseCategory || "活动物资"} onChange={(event) => setDraft({ ...draft, details: { ...draft.details, expenseCategory: event.target.value } })}><option>活动物资</option><option>宣传制作</option><option>奖品</option><option>交通</option><option>其他</option></select></label><label><span>收款人</span><input value={draft.details.payee || ""} onChange={(event) => setDraft({ ...draft, details: { ...draft.details, payee: event.target.value } })}/></label><label><span>预算项目</span><input value={draft.details.budgetItem || ""} onChange={(event) => setDraft({ ...draft, details: { ...draft.details, budgetItem: event.target.value } })}/></label></>}
      <label className="span-2"><span>事项说明</span><textarea rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })}/></label></div>
      <section className="office-materials"><header><strong>材料自检</strong><small>提交前请确认材料已准备</small></header>{draft.materials.map((material, index) => <label key={material.key}><input type="checkbox" checked={material.checked} onChange={(event) => setDraft({ ...draft, materials: draft.materials.map((item, itemIndex) => itemIndex === index ? { ...item, checked: event.target.checked } : item) })}/><i>{material.checked && <Check size={13}/>}</i><span>{material.label}</span></label>)}</section>
      <label className="office-attachment-drop"><Paperclip size={20}/><span><strong>上传证明材料</strong><small>{draft.attachments.length ? `已上传 ${draft.attachments.length} 个文件：${draft.attachments.map((file) => file.name).join("、")}` : "支持图片、PDF、Word、Excel 等文件"}</small></span><em>{busy ? "上传中" : "选择文件"}</em><input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={(event) => void upload(event.target.files)}/></label>
    </div><footer><button className="outline-button" onClick={() => setCreating(false)}>取消</button><button className="primary-button" disabled={busy || !draft.title.trim()} onClick={() => void createRequest()}>保存草稿</button></footer></div></div>}

    {selected && <div className="modal-backdrop"><div className="office-detail-modal"><header><div><span>{TYPE_LABELS[selected.type]} · {selected.id}</span><h2>{selected.title}</h2></div><button className="icon-button" onClick={() => setSelected(null)}><X size={18}/></button></header><div className="office-detail-body"><section className="office-detail-summary"><div><small>当前状态</small><em className={tone(selected.status)}>{selected.status}</em></div><div><small>申请部门 / 申请人</small><strong>{selected.requesterDepartment} · {selected.requesterName}</strong></div><div><small>关联活动</small><strong>{selected.activityName || "非活动事项"}</strong></div><div><small>经办人</small><strong>{selected.handlerName || "待办公室受理"}</strong></div></section><div className="office-detail-columns"><section><h3>申请信息</h3>{Object.entries(selected.details).filter(([, value]) => value).map(([key, value]) => <div className="office-detail-field" key={key}><span>{DETAIL_LABELS[key] || key}</span><strong>{key === "amount" ? `¥${value}` : value}</strong></div>)}<div className="office-detail-field"><span>事项说明</span><strong>{selected.description || "无"}</strong></div><div className="office-detail-field"><span>外部平台 / 结果编号</span><strong>{selected.externalPlatform || "尚未登记"}{selected.externalReference ? ` · ${selected.externalReference}` : ""}</strong></div><h3>材料与附件</h3><div className="office-checklist">{selected.materials.map((material) => <span key={material.key} className={material.checked ? "done" : "missing"}>{material.checked ? <CheckCircle2 size={14}/> : <CircleAlert size={14}/>} {material.label}</span>)}</div><div className="office-file-list">{selected.attachments.map((file) => <a key={file.key} href={`/api/files?key=${encodeURIComponent(file.key)}`} target="_blank" rel="noreferrer"><Paperclip size={13}/>{file.name}</a>)}{!selected.attachments.length && <span>未上传附件</span>}</div></section><section><h3>处理轨迹</h3><div className="office-timeline">{selectedEvents.map((event) => <article key={event.id}><i/><span><strong>{ACTION_LABELS[event.action] || event.action}</strong><small>{event.actorName} · {new Date(event.createdAt).toLocaleString("zh-CN", { hour12: false })}</small>{event.note && <p>{event.note}</p>}</span><em>{event.toStatus}</em></article>)}</div></section></div></div>
      <footer><span>更新于 {new Date(selected.updatedAt).toLocaleString("zh-CN", { hour12: false })}</span>{selected.requesterUsername === user.username && (selected.status === "草稿" || selected.status === "待补充材料") && <button className="primary-button" onClick={() => openAction("submit")}>提交办公室审核</button>}{manager && selected.status === "待办公室审核" && <><button className="outline-button warning" onClick={() => openAction("return")}>退回补充</button><button className="outline-button danger" onClick={() => openAction("reject")}>驳回</button><button className="primary-button" onClick={() => openAction("process")}>开始外部办理</button></>}{manager && selected.status === "外部办理中" && <button className="primary-button" onClick={() => openAction("complete")}><Check size={16}/>确认办结</button>}{manager && (selected.status === "已完成" || selected.status === "已驳回") && <button className="outline-button" onClick={() => openAction("reopen")}><RotateCcw size={15}/>重新打开</button>}</footer></div></div>}

    {selected && action && <div className="modal-backdrop office-action-layer"><div className="office-action-modal"><header><div><span>状态流转</span><h2>{ACTION_LABELS[action]}</h2></div><button className="icon-button" onClick={() => setAction(null)}><X size={17}/></button></header><div>{(action === "process" || action === "complete") && <><label><span>外部办理平台</span><input value={externalPlatform} onChange={(event) => setExternalPlatform(event.target.value)} placeholder="OA / 教务平台 / 财务报销平台"/></label><label><span>外部单号或结果编号{action === "complete" ? " *" : ""}</span><input value={externalReference} onChange={(event) => setExternalReference(event.target.value)} placeholder="用于后续核对和追溯"/></label></>}<label><span>{action === "return" || action === "reject" ? "原因 *" : "处理备注"}</span><textarea rows={4} value={note} onChange={(event) => setNote(event.target.value)} placeholder="说明本次处理情况"/></label></div><footer><button className="outline-button" onClick={() => setAction(null)}>取消</button><button className="primary-button" disabled={busy || ((action === "return" || action === "reject") && !note.trim()) || (action === "complete" && !externalReference.trim())} onClick={() => void runAction()}>确认{ACTION_LABELS[action]}</button></footer></div></div>}
  </div>;
}
