"use client";

import {
  Activity, AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, ChevronDown,
  ChevronRight, Clock3, Eye, MapPin, Paperclip, RefreshCw, Search,
  ShieldCheck, Users, X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { DemoUser } from "./product-model";
import type {
  ActivitySupervisionDetail,
  SupervisionNode,
  SupervisionOverview,
} from "./teacher-supervision/types";

const scheduleLabels = {
  unscheduled: "日期未完善",
  "not-started": "待开始",
  active: "正常进行",
  "due-soon": "即将截止",
  overdue: "已逾期",
  done: "已完成",
  risk: "风险事项",
} as const;

function formatDateTime(value: string) {
  if (!value) return "未设置";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}

function timelineMetrics(start: string, end: string) {
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
  const duration = endMs - startMs;
  return { startMs, endMs, duration };
}

function barStyle(node: Pick<SupervisionNode, "start" | "end">, metrics: ReturnType<typeof timelineMetrics>) {
  if (!metrics) return undefined;
  const start = Date.parse(node.start);
  const end = Date.parse(node.end);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return undefined;
  const left = Math.max(0, Math.min(100, (start - metrics.startMs) / metrics.duration * 100));
  const right = Math.max(left + 1.5, Math.min(100, (end - metrics.startMs) / metrics.duration * 100));
  return { left: `${left}%`, width: `${right - left}%` };
}

function TimelineRow({ node, depth, metrics, expandable, expanded, onToggle, onOpen }: {
  node: SupervisionNode;
  depth: number;
  metrics: ReturnType<typeof timelineMetrics>;
  expandable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  onOpen: () => void;
}) {
  const style = barStyle(node, metrics);
  return <div className={`supervision-timeline-row depth-${depth}`}>
    <div className="supervision-row-info" style={{ paddingLeft: `${14 + depth * 24}px` }}>
      {expandable ? <button className="supervision-expand" onClick={onToggle} aria-label={expanded ? "收起" : "展开"}>{expanded ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}</button> : <span className="supervision-leaf-dot"/>}
      <button className="supervision-row-main" onClick={onOpen}>
        <span><strong>{node.title}</strong><small>{node.department} · {node.assignee || "未分配"}</small></span>
        <em className={`schedule-label ${node.scheduleState}`}>{scheduleLabels[node.scheduleState]}</em>
      </button>
    </div>
    <div className="supervision-row-track">
      {style ? <button className={`supervision-bar ${node.scheduleState}`} style={style} title={`${node.title}：${formatDateTime(node.start)} 至 ${formatDateTime(node.end)}`} onClick={onOpen}><span>{node.progress ? `${node.progress}%` : ""}</span></button> : <button className="supervision-unscheduled" onClick={onOpen}>日期未完善</button>}
    </div>
  </div>;
}

export function TeacherSupervisionDashboard({ user }: { user: DemoUser }) {
  const [overview, setOverview] = useState<SupervisionOverview | null>(null);
  const [detail, setDetail] = useState<ActivitySupervisionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("全部状态");
  const [departmentFilter, setDepartmentFilter] = useState("全部部门");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<SupervisionNode | null>(null);
  const [detailTab, setDetailTab] = useState<"timeline" | "events">("timeline");

  async function loadOverview() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/teacher-supervision");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "读取失败");
      setOverview(result.overview);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "监管数据暂时无法读取");
    } finally { setLoading(false); }
  }

  async function openActivity(activityId: string) {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/teacher-supervision?activityId=${encodeURIComponent(activityId)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "读取失败");
      setDetail(result.detail);
      setExpanded(new Set(result.detail.tasks.map((task: SupervisionNode) => String(task.id))));
      setDetailTab("timeline");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "活动详情暂时无法读取");
    } finally { setLoading(false); }
  }

  // Initial network synchronization is intentionally performed once when the dashboard opens.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadOverview(); }, []);

  const visibleActivities = useMemo(() => (overview?.activities || []).filter((activity) => {
    const matchesQuery = `${activity.name}${activity.organizer}${activity.location}${activity.departments.join("")}`.includes(query.trim());
    const matchesState = stateFilter === "全部状态" || activity.state === stateFilter;
    const matchesDepartment = departmentFilter === "全部部门" || activity.departments.includes(departmentFilter);
    return matchesQuery && matchesState && matchesDepartment;
  }), [overview, query, stateFilter, departmentFilter]);

  if (loading && !overview && !detail) return <div className="supervision-loading"><span/><strong>正在汇总全部活动进度…</strong></div>;
  if (error && !overview && !detail) return <div className="supervision-error"><AlertTriangle/><strong>{error}</strong><button onClick={loadOverview}><RefreshCw size={15}/>重新加载</button></div>;

  if (detail) {
    const metrics = timelineMetrics(detail.range.start, detail.range.end);
    const markerCount = 7;
    const markers = metrics ? Array.from({ length: markerCount }, (_, index) => {
      const value = metrics.startMs + metrics.duration * index / (markerCount - 1);
      return { left: `${index / (markerCount - 1) * 100}%`, label: new Date(value).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }) };
    }) : [];
    const rootNode: SupervisionNode = {
      id: detail.activity.id, entityType: "activity", title: detail.activity.name,
      department: String(detail.activity.organizer || ""), assignee: "", status: String(detail.activity.state || ""),
      description: String(detail.activity.description || ""), start: detail.range.start, end: detail.range.end,
      deadline: String(detail.activity.date || ""), progress: detail.summary.progress,
      scheduleState: detail.summary.overdueCount ? "risk" : detail.summary.progress === 100 ? "done" : "active",
      attachments: [], completionNote: "", children: detail.tasks,
    };
    return <div className="teacher-supervision detail-mode">
      <header className="supervision-detail-head">
        <button className="supervision-back" onClick={() => { setDetail(null); setSelectedNode(null); }}><ArrowLeft size={17}/>返回全部活动</button>
        <div><span>教师只读监管 · 数据实时汇总</span><h1>{detail.activity.name}</h1><p><CalendarDays size={14}/>{String(detail.activity.date || "未设置")} {String(detail.activity.time || "")}<MapPin size={14}/>{String(detail.activity.location || "未设置")}</p></div>
        <span className="readonly-badge"><ShieldCheck size={16}/>只读查看</span>
      </header>
      <div className="supervision-detail-stats">
        <div><span>总体进度</span><strong>{detail.summary.progress}%</strong><small>{detail.summary.completedLeafCount}/{detail.summary.leafCount} 项执行工作完成</small></div>
        <div><span>执行工作项</span><strong>{detail.summary.taskCount}</strong><small>含任务与关联部门服务</small></div>
        <div><span>干事子任务</span><strong>{detail.summary.subtaskCount}</strong><small>逐项落实到执行人员</small></div>
        <div className={detail.summary.overdueCount ? "danger" : ""}><span>逾期事项</span><strong>{detail.summary.overdueCount}</strong><small>{detail.summary.dueSoonCount} 项七日内到期</small></div>
        <div className={detail.summary.unscheduledCount ? "warning" : ""}><span>日期未完善</span><strong>{detail.summary.unscheduledCount}</strong><small>需要负责人补充计划</small></div>
      </div>
      <div className="supervision-tabs"><button className={detailTab === "timeline" ? "active" : ""} onClick={() => setDetailTab("timeline")}><CalendarDays size={15}/>执行时间轴</button><button className={detailTab === "events" ? "active" : ""} onClick={() => setDetailTab("events")}><Clock3 size={15}/>操作记录 <em>{detail.events.length}</em></button><button onClick={() => openActivity(detail.activity.id)}><RefreshCw size={14}/>刷新</button></div>
      {detailTab === "timeline" ? <section className="supervision-timeline-card">
        <header><div><h2>活动任务分解与计划</h2><p>活动 → 部门负责人任务 / 部门服务 → 干事执行子任务</p></div><div className="timeline-legend"><span className="active">进行中</span><span className="due-soon">临期</span><span className="overdue">逾期</span><span className="done">完成</span></div></header>
        <div className="supervision-timeline-scroll">
          <div className="supervision-timeline-head"><div>任务 / 负责人</div><div className="supervision-date-scale">{markers.map((marker) => <span key={marker.left} style={{ left: marker.left }}>{marker.label}</span>)}</div></div>
          <div className="supervision-timeline-body">
            <div className="supervision-grid-lines">{markers.map((marker) => <i key={marker.left} style={{ left: marker.left }}/>)}</div>
            <TimelineRow node={rootNode} depth={0} metrics={metrics} expandable expanded onToggle={() => {}} onOpen={() => setSelectedNode(rootNode)}/>
            {detail.tasks.map((task) => <div key={task.id}>
              <TimelineRow node={task} depth={1} metrics={metrics} expandable={task.children.length > 0} expanded={expanded.has(String(task.id))} onToggle={() => setExpanded((current) => { const next = new Set(current); if (next.has(String(task.id))) next.delete(String(task.id)); else next.add(String(task.id)); return next; })} onOpen={() => setSelectedNode(task)}/>
              {expanded.has(String(task.id)) && task.children.map((child) => <TimelineRow key={child.id} node={child} depth={2} metrics={metrics} onOpen={() => setSelectedNode(child)}/>)}
            </div>)}
            {!detail.tasks.length && <div className="supervision-empty"><Users size={22}/><strong>这个活动尚未分工</strong><span>负责人任务发布后会自动出现在这里。</span></div>}
          </div>
        </div>
      </section> : <section className="supervision-event-card"><header><div><h2>实际操作记录</h2><p>活动、负责人任务和干事子任务的完整留痕</p></div></header><div className="supervision-events">{detail.events.map((event) => <article key={event.id}><i className={event.toStatus === "已完成" ? "done" : ""}>{event.toStatus === "已完成" ? <CheckCircle2 size={15}/> : <Clock3 size={15}/>}</i><div><header><strong>{event.actionLabel} · {event.entityTitle}</strong><time>{formatDateTime(event.createdAt)}</time></header><p>{event.actorName}（{event.actorRole}）{event.fromStatus && event.toStatus ? `将状态从“${event.fromStatus}”更新为“${event.toStatus}”` : `执行了“${event.actionLabel}”`}</p>{event.reason && <blockquote>说明：{event.reason}</blockquote>}</div></article>)}{!detail.events.length && <div className="supervision-empty"><Clock3 size={22}/><strong>暂无操作记录</strong><span>后续提交、审核和退回会自动留痕。</span></div>}</div></section>}
      {selectedNode && <div className="supervision-drawer-backdrop" role="button" tabIndex={0} aria-label="关闭详情" onClick={(event) => { if (event.target === event.currentTarget) setSelectedNode(null); }} onKeyDown={(event) => { if (event.key === "Escape" || event.key === "Enter") setSelectedNode(null); }}><aside className="supervision-drawer" role="dialog" aria-modal="true" aria-label={`${selectedNode.title}详情`}><header><div><span>{selectedNode.entityType === "activity" ? "活动" : selectedNode.entityType === "task" ? "负责人任务" : selectedNode.entityType === "service" ? "关联部门服务" : "干事子任务"} · 只读资料</span><h2>{selectedNode.title}</h2></div><button onClick={() => setSelectedNode(null)} aria-label="关闭"><X size={19}/></button></header><div className="supervision-drawer-body"><dl><div><dt>当前状态</dt><dd>{selectedNode.status}</dd></div><div><dt>进度</dt><dd>{selectedNode.progress}%</dd></div><div><dt>所属部门</dt><dd>{selectedNode.department || "未设置"}</dd></div><div><dt>负责人 / 执行人</dt><dd>{selectedNode.assignee || "未设置"}</dd></div><div><dt>计划开始</dt><dd>{formatDateTime(selectedNode.start)}</dd></div><div><dt>计划完成</dt><dd>{formatDateTime(selectedNode.end)}</dd></div></dl><section><h3>任务说明</h3><p>{selectedNode.description || "暂无补充说明"}</p></section>{selectedNode.completionNote && <section><h3>最近动态</h3><p>{selectedNode.completionNote}</p></section>}<section><h3>相关附件</h3>{selectedNode.attachments.length ? <div className="supervision-files">{selectedNode.attachments.map((file) => <a key={file.key} href={`/api/files?key=${encodeURIComponent(file.key)}`} target="_blank" rel="noreferrer"><Paperclip size={14}/><span><strong>{file.name}</strong><small>点击查看或下载</small></span></a>)}</div> : <p>暂无附件</p>}</section></div><footer><span><Eye size={14}/>教师账号只能查看</span><button onClick={() => setSelectedNode(null)}>关闭</button></footer></aside></div>}
    </div>;
  }

  const states = [...new Set((overview?.activities || []).map((activity) => activity.state))];
  return <div className="teacher-supervision">
    <header className="supervision-welcome"><div><span>全部活动 · 只读监管</span><h1>您好，{user.name}教师</h1><p>从活动总览进入，可查看各部门负责人和干事的计划、进度及操作留痕。</p></div><span className="readonly-badge"><ShieldCheck size={17}/>教师监管中心</span></header>
    <div className="supervision-overview-stats"><div><Activity/><span><small>全部活动</small><strong>{overview?.stats.activityCount || 0}</strong></span></div><div><Clock3/><span><small>正在推进</small><strong>{overview?.stats.activeActivityCount || 0}</strong></span></div><div className="danger"><AlertTriangle/><span><small>逾期执行项</small><strong>{overview?.stats.overdueTaskCount || 0}</strong></span></div><div className="warning"><CalendarDays/><span><small>七日内到期</small><strong>{overview?.stats.dueSoonTaskCount || 0}</strong></span></div></div>
    <div className="supervision-toolbar"><label><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索活动、部门或地点"/></label><select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}><option>全部状态</option>{states.map((state) => <option key={state}>{state}</option>)}</select><select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}><option>全部部门</option>{overview?.departments.map((department) => <option key={department}>{department}</option>)}</select><button onClick={loadOverview}><RefreshCw size={14}/>刷新</button></div>
    {error && <div className="supervision-inline-error"><AlertTriangle size={15}/>{error}</div>}
    <section className="supervision-activity-list"><header><div><h2>活动执行情况</h2><p>优先显示存在逾期事项和临近截止的活动</p></div><span>{visibleActivities.length} 个活动</span></header>{visibleActivities.map((activity) => <button key={activity.id} className={activity.overdueCount ? "has-risk" : ""} onClick={() => openActivity(activity.id)}><div className="supervision-activity-main"><i><Activity size={17}/></i><span><em>{activity.category || "活动"} · {activity.state}</em><strong>{activity.name}</strong><small>{activity.organizer} · {activity.departments.length} 个参与部门</small></span></div><div><small>活动时间</small><strong>{activity.date || "未设置"}</strong><span>{activity.time || activity.location}</span></div><div><small>执行进度</small><strong>{activity.progress}%</strong><i className="supervision-progress"><em style={{ width: `${activity.progress}%` }}/></i><span>{activity.completedLeafCount}/{activity.leafCount} 项完成</span></div><div className="supervision-risk-count"><small>需要关注</small><strong>{activity.overdueCount ? `${activity.overdueCount} 项逾期` : activity.dueSoonCount ? `${activity.dueSoonCount} 项临期` : "进度正常"}</strong><span>{activity.unscheduledCount ? `${activity.unscheduledCount} 项日期未完善` : activity.nextDeadline ? `下次截止 ${formatDateTime(activity.nextDeadline)}` : "暂无近期截止"}</span></div><ChevronRight size={18}/></button>)}{!visibleActivities.length && <div className="supervision-empty"><Search size={22}/><strong>没有符合条件的活动</strong><span>可以调整关键词或筛选条件。</span></div>}</section>
  </div>;
}
