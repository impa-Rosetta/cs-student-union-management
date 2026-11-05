"use client";

import { Activity, AlertTriangle, CalendarClock, CheckCircle2, ChevronRight, CircleDot, RefreshCw, Search, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import type { DemoUser } from "./product-model";
import type { WorkItem, WorkItemSourceType } from "./work-management/store";

const sourceLabels: Record<WorkItemSourceType, string> = {
  task: "主任务", subtask: "干事任务", venue_request: "教室借用", purchase_request: "采购申请", white_card: "白卡制作",
};

const statusLabels: Record<string, string> = {
  pending: "待处理", in_progress: "进行中", waiting: "等待他人", review: "待审核", done: "已完成", canceled: "已取消", unknown: "状态待配置",
};

type FilterKey = "waiting" | "responsible" | "started" | "dueSoon" | "overdue" | "completed" | "all";

function dateMs(value: string) { const parsed = Date.parse(value); return Number.isFinite(parsed) ? parsed : null; }
function isOpen(item: WorkItem) { return !["done", "canceled"].includes(item.statusGroup); }

export function WorkItemsDashboard({ user, onOpenSource }: { user: DemoUser; onOpenSource: (item: WorkItem) => void }) {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterKey>("waiting");
  const [query, setQuery] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/work-items");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "读取工作列表失败");
      setItems(Array.isArray(result.items) ? result.items : []);
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
    }).then((result) => { if (active) setItems(Array.isArray(result.items) ? result.items : []); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "读取工作列表失败"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const [now] = useState(() => Date.now());
  const matches = (item: WorkItem, key: FilterKey) => {
    const due = dateMs(item.dueAt);
    const waitingForMe = item.nextActorId === user.username || item.nextActorId === String(user.id || "") || item.nextActorId === user.department || item.nextActorId === `${user.department}:leader` || (["chair", "admin"].includes(user.role) && item.nextActorId === "chair");
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

  const visible = items.filter((item) => matches(item, filter) && (!query.trim() || `${item.title}${item.activityName}${item.ownerDepartmentName}${item.assigneeName}${sourceLabels[item.sourceType]}`.toLowerCase().includes(query.trim().toLowerCase())));
  const counts = Object.fromEntries(filters.map((item) => [item.key, items.filter((workItem) => matches(workItem, item.key)).length]));

  return <div className="module-page unified-work-page">
    <div className="module-header"><div><span className="module-kicker">统一工作队列</span><h1>我的工作</h1><p>任务和部门申请使用同一份待办口径，不重复生成进度记录。</p></div><button className="outline-button" onClick={() => void load()} disabled={loading}><RefreshCw size={15}/>{loading ? "刷新中" : "刷新"}</button></div>
    <section className="work-queue-summary">{filters.slice(0,6).map(({key,label,icon:Icon}) => <button key={key} className={filter===key?"active":""} onClick={()=>setFilter(key)}><Icon size={18}/><span><strong>{counts[key]}</strong><small>{label}</small></span></button>)}</section>
    <div className="work-queue-toolbar"><div>{filters.map(({key,label})=><button key={key} className={filter===key?"active":""} onClick={()=>setFilter(key)}>{label}<span>{counts[key]}</span></button>)}</div><label><Search size={15}/><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="搜索事项、活动、部门或负责人"/></label></div>
    {error && <div className="work-queue-error"><AlertTriangle size={18}/><span>{error}</span><button onClick={()=>void load()}>重试</button></div>}
    <section className="work-queue-list"><header><span>工作事项</span><span>活动 / 部门</span><span>负责人</span><span>截止时间</span><span>当前状态</span></header>{visible.map((item)=><button key={item.id} className={item.blocked?"blocked":""} onClick={()=>onOpenSource(item)}><span className="work-item-title"><i className={`source-${item.sourceType}`}>{sourceLabels[item.sourceType].slice(0,1)}</i><span><small>{sourceLabels[item.sourceType]}{item.blocked?" · 已阻塞":""}</small><strong>{item.title}</strong></span></span><span><strong>{item.activityName||"日常事项"}</strong><small>{item.ownerDepartmentName||"未设置部门"}</small></span><span><strong>{item.assigneeName||item.requesterName||"待领取"}</strong><small>{item.nextActorId?`等待：${item.nextActorId}`:"流程已结束"}</small></span><span><strong>{item.dueAt?new Date(item.dueAt).toLocaleString("zh-CN",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}):"未设置"}</strong><small>{item.priority}</small></span><span><em className={`unified-status ${item.statusGroup}`}>{statusLabels[item.statusGroup]}</em><small>{item.nativeStatus}</small></span><ChevronRight size={17}/></button>)}{!loading&&!visible.length&&<div className="work-queue-empty"><CheckCircle2 size={25}/><strong>当前分类没有事项</strong><span>可以切换到“全部可见”或调整搜索条件。</span></div>}</section>
  </div>;
}

