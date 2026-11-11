"use client";

import { Activity, AlertTriangle, CalendarClock, CheckCircle2, ChevronRight, CircleDot, RefreshCw, Search, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import type { DemoUser } from "./product-model";
import type { WorkItem, WorkItemSourceType } from "./work-management/store";

const sourceLabels: Record<WorkItemSourceType, string> = {
  task: "主任务", subtask: "干事任务", venue_request: "教室借用", purchase_request: "采购申请", white_card: "白卡制作",
  meeting_report: "例会通报", organization_change: "成员异动", organization_affair: "组织事务",
};

const statusLabels: Record<string, string> = {
  pending: "待处理", in_progress: "进行中", waiting: "等待他人", review: "待审核", done: "已完成", canceled: "已取消", unknown: "状态待配置",
};

type FilterKey = "waiting" | "responsible" | "started" | "dueSoon" | "overdue" | "completed" | "all";

function dateMs(value: string) { const parsed = Date.parse(value); return Number.isFinite(parsed) ? parsed : null; }
function isOpen(item: WorkItem) { return !["done", "canceled"].includes(item.statusGroup); }
function waitingForUser(item: WorkItem, user: DemoUser) {
  return item.nextActorId === user.username || item.nextActorId === String(user.id || "") || item.nextActorId === user.department || item.nextActorId === `${user.department}:leader` || (["chair", "admin"].includes(user.role) && item.nextActorId === "chair");
}
function nextActorLabel(item: WorkItem, user: DemoUser) {
  if (!item.nextActorId) return "流程已结束";
  if (waitingForUser(item, user)) return "等待你处理";
  if (item.nextActorType === "role" && item.nextActorId === "chair") return "等待主席审核";
  if (item.nextActorType === "department") return `等待${item.nextActorId}处理`;
  if (item.nextActorType === "department_role") return `等待${item.nextActorId.split(":")[0]}负责人处理`;
  return `等待${item.assigneeName || item.ownerDepartmentName || "指定人员"}处理`;
}
function nextActionLabel(item: WorkItem, user: DemoUser) {
  if (!isOpen(item)) return "查看结果";
  if (!waitingForUser(item, user)) return "查看进度";
  if (/补充|退回|修改/.test(item.nativeStatus)) return "补充并重新提交";
  if (/待验收|待审核|待确认|待主席团确认|待结果确认/.test(item.nativeStatus)) return "去审核";
  if (/待领取/.test(item.nativeStatus)) return "去领取";
  if (/草稿|未填写/.test(item.nativeStatus)) return "继续填写";
  if (/待开始/.test(item.nativeStatus)) return "开始处理";
  return "去处理";
}
function restoreQueueState(username: string): { filter: FilterKey; query: string } {
  if (typeof window === "undefined") return { filter: "waiting", query: "" };
  try {
    const value = JSON.parse(window.sessionStorage.getItem(`work-queue:${username}`) || "{}");
    const allowed: FilterKey[] = ["waiting", "responsible", "started", "dueSoon", "overdue", "completed", "all"];
    return { filter: allowed.includes(value.filter) ? value.filter : "waiting", query: typeof value.query === "string" ? value.query : "" };
  } catch { return { filter: "waiting", query: "" }; }
}

export function WorkItemsDashboard({ user, onOpenSource }: { user: DemoUser; onOpenSource: (item: WorkItem) => void }) {
  const restored = restoreQueueState(user.username);
  const [items, setItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterKey>(restored.filter);
  const [query, setQuery] = useState(restored.query);
  const [lastUpdatedAt, setLastUpdatedAt] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/work-items");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "读取工作列表失败");
      setItems(Array.isArray(result.items) ? result.items : []);
      setLastUpdatedAt(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "读取工作列表失败");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    let active = true;
    fetch("/api/work-items").then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "读取工作列表失败");
      return result;
    }).then((result) => { if (active) { setItems(Array.isArray(result.items) ? result.items : []); setLastUpdatedAt(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })); } })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "读取工作列表失败"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    window.sessionStorage.setItem(`work-queue:${user.username}`, JSON.stringify({ filter, query }));
  }, [filter, query, user.username]);

  const [now] = useState(() => Date.now());
  const matches = (item: WorkItem, key: FilterKey) => {
    const due = dateMs(item.dueAt);
    const waitingForMe = waitingForUser(item, user);
    if (key === "waiting") return isOpen(item) && waitingForMe;
    if (key === "responsible") return isOpen(item) && (item.assigneeAccountId === user.id || item.assigneeName === user.name || (user.role === "leader" && item.ownerDepartmentName.includes(user.department)));
    if (key === "started") return item.requesterUsername === user.username;
    if (key === "dueSoon") return isOpen(item) && due != null && due >= now && due <= now + 7 * 86400000;
    if (key === "overdue") return isOpen(item) && due != null && due < now;
    if (key === "completed") return item.statusGroup === "done";
    return true;
  };

  const filters: Array<{ key: FilterKey; label: string; icon: typeof CircleDot }> = [
    { key: "waiting", label: "待我处理", icon: CircleDot }, { key: "responsible", label: "我负责的", icon: UserRound },
    { key: "started", label: "我发起的", icon: Activity }, { key: "dueSoon", label: "即将到期", icon: CalendarClock },
    { key: "overdue", label: "已逾期", icon: AlertTriangle }, { key: "completed", label: "最近完成", icon: CheckCircle2 },
    { key: "all", label: "全部可见", icon: Search },
  ];

  const visible = items.filter((item) => matches(item, filter) && (!query.trim() || `${item.title}${item.activityName}${item.ownerDepartmentName}${item.assigneeName}${sourceLabels[item.sourceType]}`.toLowerCase().includes(query.trim().toLowerCase()))).sort((a,b) => {
    const rank = (item: WorkItem) => waitingForUser(item,user) ? 0 : item.blocked ? 1 : (dateMs(item.dueAt) ?? Number.MAX_SAFE_INTEGER) < now ? 2 : 3;
    const rankDiff = rank(a) - rank(b);
    if (rankDiff) return rankDiff;
    return (dateMs(a.dueAt) ?? Number.MAX_SAFE_INTEGER) - (dateMs(b.dueAt) ?? Number.MAX_SAFE_INTEGER);
  });
  const counts = Object.fromEntries(filters.map((item) => [item.key, items.filter((workItem) => matches(workItem, item.key)).length]));

  return <div className="module-page unified-work-page">
    <div className="module-header"><div><span className="module-kicker">统一工作队列</span><h1>我的工作</h1><p>优先展示需要你处理的任务、申请和部门协作事项。</p></div><div className="work-queue-refresh"><small>{lastUpdatedAt ? `${lastUpdatedAt} 已更新` : "正在同步最新状态"}</small><button className="outline-button" onClick={() => void load()} disabled={loading}><RefreshCw size={15}/>{loading ? "刷新中" : "刷新"}</button></div></div>
    <section className="work-queue-summary">{filters.slice(0,6).map(({key,label,icon:Icon}) => <button key={key} className={filter===key?"active":""} onClick={()=>setFilter(key)}><Icon size={18}/><span><strong>{counts[key]}</strong><small>{label}</small></span></button>)}</section>
    <div className="work-queue-toolbar"><div>{filters.map(({key,label})=><button key={key} className={filter===key?"active":""} onClick={()=>setFilter(key)}>{label}<span>{counts[key]}</span></button>)}</div><label><Search size={15}/><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="搜索事项、活动、部门或负责人"/></label></div>
    {error && <div className="work-queue-error"><AlertTriangle size={18}/><span>{error}</span><button onClick={()=>void load()}>重试</button></div>}
    <section className="work-queue-list"><header><span>工作事项</span><span>活动 / 部门</span><span>负责人</span><span>截止时间</span><span>当前状态</span></header>{loading&&!items.length&&Array.from({length:4},(_,index)=><div className="work-queue-skeleton" key={index}><i/><span/><span/><span/><span/></div>)}{visible.map((item)=>{const due=dateMs(item.dueAt);const overdue=isOpen(item)&&due!=null&&due<now;const dueSoon=isOpen(item)&&due!=null&&due>=now&&due<=now+7*86400000;return <button key={item.id} className={[item.blocked?"blocked":"",overdue?"overdue":"",dueSoon?"due-soon":"",waitingForUser(item,user)?"needs-action":""].filter(Boolean).join(" ")} onClick={()=>onOpenSource(item)}><span className="work-item-title"><i className={`source-${item.sourceType}`}>{sourceLabels[item.sourceType].slice(0,1)}</i><span><small>{sourceLabels[item.sourceType]}{item.blocked?" · 已阻塞":overdue?" · 已逾期":dueSoon?" · 即将到期":""}</small><strong>{item.title}</strong>{item.blocked&&item.blockedReason&&<small className="work-blocked-reason">{item.blockedReason}</small>}</span></span><span><strong>{item.activityName||"日常事项"}</strong><small>{item.ownerDepartmentName||"未设置部门"}</small></span><span><strong>{item.assigneeName||item.requesterName||"待领取"}</strong><small>{nextActorLabel(item,user)}</small></span><span><strong>{item.dueAt?new Date(item.dueAt).toLocaleString("zh-CN",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}):"未设置"}</strong><small className={overdue?"due-danger":dueSoon?"due-warning":""}>{overdue?"已逾期":dueSoon?"七日内到期":item.priority}</small></span><span><em className={`unified-status ${item.statusGroup}`}>{statusLabels[item.statusGroup]}</em><small>{nextActionLabel(item,user)}</small></span><ChevronRight size={17}/></button>})}{!loading&&!visible.length&&<div className="work-queue-empty"><CheckCircle2 size={25}/><strong>{query.trim()?"没有找到匹配事项":filter==="waiting"?"暂时没有需要你处理的事项":"当前分类没有事项"}</strong><span>{query.trim()?"可以尝试更换关键词或清空搜索。":filter==="waiting"?"新的审核、领取或补充任务会自动出现在这里。":"可以切换到“全部可见”或调整筛选条件。"}</span>{(query||filter!=="waiting")&&<button onClick={()=>{setQuery("");setFilter("waiting")}}>返回待我处理</button>}</div>}</section>
  </div>;
}

export function DepartmentTodoSummary({ user, onOpenSource }: { user: DemoUser; onOpenSource: (item: WorkItem) => void }) {
  const [items,setItems]=useState<WorkItem[]>([]);
  useEffect(()=>{let active=true;void fetch("/api/work-items").then(async response=>response.ok?response.json():null).then(result=>{if(active&&Array.isArray(result?.items))setItems(result.items);}).catch(()=>undefined);return()=>{active=false;};},[user.username]);
  const pending=items.filter(item=>item.sourceType!=="white_card"&&isOpen(item)&&waitingForUser(item,user)).sort((a,b)=>Number(b.blocked)-Number(a.blocked)||(dateMs(a.dueAt)??Number.MAX_SAFE_INTEGER)-(dateMs(b.dueAt)??Number.MAX_SAFE_INTEGER)).slice(0,5);
  if(!pending.length)return null;
  return <section className="white-card-dashboard-todos"><header><div><span>统一业务待办</span><h2>需要我处理</h2></div></header><div>{pending.map(item=><button key={item.id} onClick={()=>onOpenSource(item)}><i><CircleDot size={17}/></i><span><strong>{item.title}</strong><small>{sourceLabels[item.sourceType]} · {item.ownerDepartmentName}{item.blocked?` · 已阻塞${item.blockedReason?`：${item.blockedReason}`:""}`:""}</small></span><em>{nextActionLabel(item,user)}</em><ChevronRight size={15}/></button>)}</div></section>;
}

