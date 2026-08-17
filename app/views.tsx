"use client";

import {
  Activity, Bell, Building2, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight,
  CircleAlert, ClipboardCheck, Clock3, Download, Eye, FileSpreadsheet, FileText, LayoutDashboard,
  LogIn, Paperclip, Pencil, Plus, RotateCcw,
  Search, Settings, ShieldCheck, MapPin, Upload, Trash2, UserCheck, UserPlus, Users, X,
} from "lucide-react";
import readXlsxFile from "read-excel-file";
import { useEffect, useState } from "react";
import {
  blankMember, currentActivity, deleteAttachmentObject, isSubtaskOf,
  parseMemberImportRows, quickFlowTitles, seededAccounts,
  type AcademicSemester, type ActivityRecord, type ArchiveRecord, type Attachment,
  type DelegatedTask, type DemoUser, type ManagedAccount, type MemberImportRow,
  type NotificationDraft, type NotificationItem,
  type OrgDepartment, type OrgMember, type OrgSnapshot, type QuickFlowKind, type ResearchItem,
  type SystemConfig, type Task, type UserRole, type ViewKey, type WorkflowActionPayload,
} from "./product-model";

export function OrganizationManager({ notify, canManage = true }: { notify: (message: string) => void; canManage?: boolean }) {
  const [data, setData] = useState<OrgSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [treeMode, setTreeMode] = useState(true);
  const [showManagement, setShowManagement] = useState(false);
  const [removalTarget, setRemovalTarget] = useState<OrgMember | null>(null);
  const [viewingMember, setViewingMember] = useState<OrgMember | null>(null);
  const [chairsExpanded, setChairsExpanded] = useState(true);
  const [expandedDepartments, setExpandedDepartments] = useState<number[]>([]);
  const [editing, setEditing] = useState<OrgMember | null>(null);
  const [showTransition, setShowTransition] = useState(false);
  const [termName, setTermName] = useState("2027-2028届");
  const [selectedOrgKey, setSelectedOrgKey] = useState("chairs");
  const [importRows, setImportRows] = useState<MemberImportRow[]>([]);
  const [importFileName, setImportFileName] = useState("");
  const [importFileError, setImportFileError] = useState("");
  const [importingMembers, setImportingMembers] = useState(false);
  const [showImportGuide, setShowImportGuide] = useState(false);

  async function load(termId?: number) {
    setLoading(true);
    try {
      const response = await fetch(`/api/organization${termId ? `?term=${termId}` : ""}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "读取失败");
      setData(result);
    } catch {
      notify("成员数据库暂时不可用，请稍后重试");
    } finally { setLoading(false); }
  }

  // The organization snapshot is loaded once from D1 when this workspace opens.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, []);

  async function saveMember() {
    if (!editing?.name.trim() || !editing.position.trim() || !data) return;
    const method = editing.id ? "PUT" : "POST";
    const response = await fetch("/api/organization", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...editing, termId: editing.termId || data.selectedTermId }) });
    if (!response.ok) return notify("成员信息保存失败");
    setEditing(null); await load(data.selectedTermId); notify("成员信息已保存到数据库");
  }

  async function removeMember(member: OrgMember) {
    const response = await fetch(`/api/organization?id=${member.id}`, { method: "DELETE" });
    if (!response.ok) return notify("移除成员失败");
    setEditing(null); setRemovalTarget(null); await load(data?.selectedTermId); notify("成员已移出本届组织");
  }

  async function handleMemberImportFile(file?: File) {
    setImportRows([]); setImportFileError(""); setImportFileName(file?.name || "");
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) return setImportFileError("请选择 .xlsx 格式的 Excel 文件");
    if (file.size > 5 * 1024 * 1024) return setImportFileError("文件不能超过 5 MB");
    try {
      let table: unknown[][];
      try { table = await readXlsxFile(file, { sheet: "成员导入" }); }
      catch { table = await readXlsxFile(file); }
      setImportRows(parseMemberImportRows(table, data?.departments || []));
    } catch (error) {
      setImportFileError(error instanceof Error ? error.message : "无法读取这份 Excel 文件");
    }
  }

  async function startTransition() {
    const years = termName.match(/^(20\d{2})\s*[-—至]\s*(20\d{2})(?:届|学年)?$/);
    if (!years || Number(years[2]) !== Number(years[1]) + 1) return setImportFileError("届次名称应为“2027-2028届”这样的格式");
    const invalidCount = importRows.filter((row) => row.errors.length).length;
    if (!importRows.length || invalidCount) return;
    setImportingMembers(true);
    try {
      const response = await fetch("/api/organization", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "transitionImport", name: termName, startYear: Number(years[1]), endYear: Number(years[2]), rows: importRows.map((row) => ({ name: row.name, studentNo: row.studentNo, className: row.className, phone: row.phone, department: row.department, position: row.position })) }) });
      const result = await response.json();
      if (!response.ok) return setImportFileError(result.error || "成员导入失败");
      setShowTransition(false); setImportRows([]); setImportFileName(""); setImportFileError("");
      await load(result.selectedTermId); notify(`已创建${termName}并导入${importRows.length}名成员`);
    } catch {
      setImportFileError("网络异常，成员名单尚未写入数据库");
    } finally { setImportingMembers(false); }
  }

  if (loading) return <div className="org-loading"><span /><p>正在从成员数据库读取组织架构…</p></div>;
  if (!data) return <div className="org-loading"><p>成员数据暂时无法读取</p><button className="outline-button" onClick={() => load()}>重新加载</button></div>;

  const chairs = data.members.filter((member) => member.roleLevel === "chair");
  const openNew = (departmentId: number | null = null, position = "干事", roleLevel = "staff") => setEditing({ ...blankMember, termId: data.selectedTermId, departmentId, position, roleLevel });
  const selectedDepartment = selectedOrgKey.startsWith("dept-") ? data.departments.find((department) => department.id === Number(selectedOrgKey.slice(5))) : null;
  const descendantIds = selectedDepartment ? [selectedDepartment.id, ...data.departments.filter((department) => department.parentId === selectedDepartment.id).map((department) => department.id)] : [];
  const visibleMembers = selectedOrgKey === "chairs" ? chairs : selectedDepartment ? data.members.filter((member) => member.departmentId !== null && descendantIds.includes(member.departmentId)) : [];
  const selectedTitle = selectedOrgKey === "chairs" ? "学生联盟主席团" : selectedDepartment?.name || "组织目录";
  const isInnovationGroup = selectedDepartment?.name === "科创中心";
  const selectDepartment = (department: OrgDepartment, hasChildren: boolean) => {
    setSelectedOrgKey(`dept-${department.id}`);
    if (hasChildren) setExpandedDepartments((current) => current.includes(department.id) ? current.filter((id) => id !== department.id) : [...current, department.id]);
  };

  return <div className="module-page organization-page">
    <div className="module-header"><div><span className="module-kicker">数据库实时读取 · {data.members.length} 名在任成员</span><h1>学生联盟组织与成员</h1></div>{canManage && <button className={showManagement ? "outline-button active" : "outline-button"} onClick={() => setShowManagement((value) => !value)}><Settings size={16}/>成员管理{showManagement ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}</button>}</div>
    <div className="org-toolbar"><label><span>当前届次</span><select value={data.selectedTermId} onChange={(event) => load(Number(event.target.value))}>{data.terms.map((term) => <option key={term.id} value={term.id}>{term.name}{term.isCurrent ? "（当前）" : ""}</option>)}</select></label><div><button className={treeMode ? "active" : ""} onClick={() => setTreeMode(true)}>组织目录</button><button className={!treeMode ? "active" : ""} onClick={() => setTreeMode(false)}>成员名册</button></div><span>{canManage ? "选择成员可修改档案" : "当前为只读权限"}</span></div>
    {canManage && showManagement && <div className="org-manage-panel"><div><Settings size={17}/><span><strong>成员数据管理</strong></span></div><button className="outline-button" onClick={() => setShowTransition(true)}><Upload size={15}/>换届录入</button><button className="primary-button" onClick={() => openNew()}><UserPlus size={16}/>添加成员</button></div>}
    {treeMode ? <div className="org-directory-layout">
      <aside className="org-directory"><header><span>组织目录</span></header><section className={`org-top-level ${chairsExpanded ? "expanded" : ""}`}><button className={selectedOrgKey === "chairs" ? "selected group-node" : "group-node"} aria-expanded={chairsExpanded} onClick={() => { setSelectedOrgKey("chairs"); setChairsExpanded((value) => !value); }}><span className="org-node-icon root"><ShieldCheck size={15}/></span><span><strong>学生联盟主席团</strong><small>{chairs.length} 名主席</small></span>{chairsExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</button>{chairsExpanded && <div className="org-chair-list">{chairs.map((chair) => <button key={chair.id} className="chair-person-node" onClick={() => setViewingMember(chair)}><i>{chair.name.slice(0,1)}</i><span><strong>{chair.name}</strong><small>{chair.position}</small></span><Eye size={13}/></button>)}</div>}</section>{data.departments.filter((department) => department.parentId === null).sort((a,b) => a.sortOrder - b.sortOrder).map((department) => { const children = data.departments.filter((child) => child.parentId === department.id).sort((a,b) => a.sortOrder - b.sortOrder); const expanded = expandedDepartments.includes(department.id); const chairName = department.groupName.replace("分管", "").trim(); return <section key={department.id} className={`org-top-level ${expanded ? "expanded" : ""}`}><button className={selectedOrgKey === `dept-${department.id}` ? "selected group-node" : "group-node"} aria-expanded={children.length ? expanded : undefined} onClick={() => selectDepartment(department, Boolean(children.length))}><span className="org-node-icon dept"><Building2 size={14}/></span><span><strong>{department.name}</strong><small>分管主席：{chairName}</small></span>{children.length && expanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</button>{children.length > 0 && expanded && <div className="org-child-list">{children.map((child) => <button key={child.id} className={`child-node ${selectedOrgKey === `dept-${child.id}` ? "selected" : ""}`} onClick={() => setSelectedOrgKey(`dept-${child.id}`)}><i/><span className="org-node-icon child"><Building2 size={13}/></span><span><strong>{child.name}</strong></span></button>)}</div>}</section>; })}</aside>
      <section className="org-detail"><header><div><span className="org-breadcrumb">学生联盟 <ChevronRight size={13}/> {selectedTitle}</span><h2>{selectedTitle}</h2><p>{isInnovationGroup ? "部门组 · 由 PC 部与运维部共同组成，不设置独立负责人" : selectedDepartment ? `分管主席：${selectedDepartment.groupName.replace("分管", "").trim()} · ${visibleMembers.length} 名成员` : `${chairs.length} 名主席，点击成员查看信息卡`}</p></div>{selectedDepartment && !isInnovationGroup && canManage && <button className="primary-button" onClick={() => openNew(selectedDepartment.id)}><UserPlus size={16}/>添加成员</button>}</header>{isInnovationGroup && <div className="innovation-summary"><Building2 size={20}/><div><strong>科创中心</strong><span>这是 PC 部与运维部的统称，本级不设置负责人或干事。</span></div>{data.departments.filter((department) => department.parentId === selectedDepartment.id).map((department) => <button key={department.id} onClick={() => setSelectedOrgKey(`dept-${department.id}`)}><strong>{department.name}</strong><span>{data.members.filter((member) => member.departmentId === department.id).length} 名成员</span><ChevronRight size={14}/></button>)}</div>}{!isInnovationGroup && <div className="org-member-table"><div className="org-member-head"><span>成员</span><span>所属部门</span><span>职务</span><span>联系方式</span><span/></div>{visibleMembers.length ? visibleMembers.map((member) => <button key={member.id} onClick={() => setViewingMember(member)}><span><i>{member.name.slice(0,1)}</i><b>{member.name}</b><small>{member.className || member.grade || "未录入班级"}</small></span><span>{data.departments.find((department) => department.id === member.departmentId)?.name || "主席团"}</span><span><em className={`role-pill ${member.roleLevel}`}>{member.position}</em></span><span>{member.phone || "未录入"}</span><Eye size={14}/></button>) : <div className="org-empty"><Users size={20}/><strong>当前层级没有成员</strong><span>可以从成员管理中录入，或选择其他部门查看。</span></div>}</div>}</section>
    </div> : <div className="member-roster"><div className="roster-head"><span>姓名 / 学号</span><span>班级</span><span>部门</span><span>职务</span><span>操作</span></div>{data.members.map((member) => <div key={member.id}><span><strong>{member.name}</strong><small>{member.studentNo || "未录入学号"}</small></span><span><strong>{member.className || member.grade || "未录入班级"}</strong></span><span>{data.departments.find((department) => department.id === member.departmentId)?.name || "主席团"}</span><span>{member.position}</span><button onClick={() => setViewingMember(member)}><Eye size={14}/>查看</button></div>)}</div>}

    {viewingMember && <div className="modal-backdrop"><div className="member-profile-modal" role="dialog" aria-modal="true" aria-labelledby="member-profile-title"><header><div><span>成员信息卡</span><h2 id="member-profile-title">{viewingMember.name}</h2></div><button className="icon-button" onClick={() => setViewingMember(null)} aria-label="关闭"><X size={18}/></button></header><div className="member-profile-body"><div className="member-identity"><i>{viewingMember.name.slice(0,1)}</i><span><strong>{viewingMember.position}</strong><small>{data.departments.find((department) => department.id === viewingMember.departmentId)?.name || "主席团"}</small></span><em className={`role-pill ${viewingMember.roleLevel}`}>{viewingMember.position}</em></div><dl><div><dt>学号</dt><dd>{viewingMember.studentNo || "未录入"}</dd></div><div><dt>届次</dt><dd>{data.terms.find((term) => term.id === viewingMember.termId)?.name || "当前届次"}</dd></div><div><dt>班级</dt><dd>{viewingMember.className || viewingMember.grade || "未录入"}</dd></div><div><dt>所属部门</dt><dd>{data.departments.find((department) => department.id === viewingMember.departmentId)?.name || "主席团"}</dd></div><div><dt>联系电话</dt><dd>{viewingMember.phone || "未录入"}</dd></div></dl></div><footer><button className="outline-button" onClick={() => setViewingMember(null)}>关闭</button>{canManage && <button className="primary-button" onClick={() => { setEditing(viewingMember); setViewingMember(null); }}><Pencil size={15}/>编辑成员</button>}</footer></div></div>}
    {editing && <div className="modal-backdrop"><div className="member-modal"><header><div><span>{editing.id ? "修改成员档案" : "录入新成员"}</span><h2>{editing.id ? editing.name : "成员信息"}</h2></div><button className="icon-button" onClick={() => setEditing(null)}><X size={18}/></button></header><div className="form-grid"><label><span>姓名 *</span><input value={editing.name} onChange={(e) => setEditing({...editing,name:e.target.value})}/></label><label><span>学号</span><input value={editing.studentNo} onChange={(e) => setEditing({...editing,studentNo:e.target.value})}/></label><label><span>班级</span><input value={editing.className} onChange={(e) => setEditing({...editing,className:e.target.value})} placeholder="例如：计科 2401"/></label><label><span>联系电话</span><input value={editing.phone} onChange={(e) => setEditing({...editing,phone:e.target.value})}/></label><label><span>所属部门</span><select value={editing.departmentId ?? ""} onChange={(e) => setEditing({...editing,departmentId:e.target.value ? Number(e.target.value) : null})}><option value="">主席团</option>{data.departments.map((department) => <option key={department.id} value={department.id} disabled={department.name === "科创中心"}>{department.name}{department.name === "科创中心" ? "（部门组）" : ""}</option>)}</select></label><label><span>职务 *</span><select value={editing.position} onChange={(e) => { const position = e.target.value; setEditing({...editing,position,roleLevel:position === "主席" ? "chair" : position === "负责人" ? "leader" : "staff",departmentId:position === "主席" ? null : editing.departmentId}); }}><option>主席</option><option>负责人</option><option>干事</option></select></label></div><footer>{editing.id ? <button className="danger-button" onClick={() => setRemovalTarget(editing)}>移出本届</button> : <span/>}<div><button className="outline-button" onClick={() => setEditing(null)}>取消</button><button className="primary-button" disabled={!editing.name.trim() || !editing.position.trim()} onClick={saveMember}>保存到数据库</button></div></footer></div></div>}
    {removalTarget && <ConfirmActionModal title="移出本届成员" description={`确认将“${removalTarget.name}”从当前届次成员名单中移除吗？该成员的历史任务记录不会被删除。`} confirmText="确认移出" onCancel={() => setRemovalTarget(null)} onConfirm={() => removeMember(removalTarget)}/>} 
    {showTransition && <div className="modal-backdrop"><div className="transition-modal member-import-modal" role="dialog" aria-modal="true" aria-labelledby="member-import-title">
      <header><div><span>换届成员录入</span><h2 id="member-import-title">导入新一届成员名单</h2></div><button className="icon-button" onClick={() => setShowTransition(false)} aria-label="关闭"><X size={18}/></button></header>
      <div className="transition-body">
        <div className="import-top-row"><label><span>届次名称</span><input value={termName} onChange={(event) => { setTermName(event.target.value); setImportFileError(""); }} placeholder="2027-2028届" /></label><a className="template-download" href="/templates/学生联盟成员导入模板.xlsx" download><Download size={16}/><span><strong>下载 Excel 模板</strong><small>含字段说明与下拉选项</small></span></a></div>
        <section className="import-steps" aria-label="导入步骤"><span className="done"><b>1</b>下载模板</span><i/><span className={importFileName ? "done" : "active"}><b>2</b>选择文件</span><i/><span className={importRows.length ? "done" : ""}><b>3</b>检查数据</span><i/><span><b>4</b>确认导入</span></section>
        <div className={`file-drop-zone ${importFileName ? "has-file" : ""}`}><input id="member-import-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { handleMemberImportFile(event.target.files?.[0]); event.currentTarget.value = ""; }} /><label htmlFor="member-import-file"><span className="file-drop-icon"><FileSpreadsheet size={22}/></span><span><strong>{importFileName || "选择已填写的 Excel 名单"}</strong><small>{importFileName ? "点击可重新选择文件" : "支持 .xlsx，文件不超过 5 MB"}</small></span><em>{importFileName ? "重新选择" : "选择文件"}</em></label></div>
        <button className="import-guide-toggle" onClick={() => setShowImportGuide((value) => !value)} aria-expanded={showImportGuide}><span><CircleAlert size={15}/><strong>填写说明</strong></span>{showImportGuide ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}</button>
        {showImportGuide && <div className="import-guide"><span><b>必填字段</b>姓名、所属部门、职务</span><span><b>主席团</b>所属部门填“主席团”，职务填“主席”</span><span><b>部门成员</b>所属部门选择实际部门，科创中心不能作为直属部门</span><span><b>职务选项</b>只能填写主席、负责人、干事</span></div>}
        {importFileError && <div className="import-result error"><CircleAlert size={17}/><span><strong>无法导入</strong><small>{importFileError}</small></span></div>}
        {importRows.length > 0 && <div className="import-preview"><header><div><strong>名单预览</strong><span>{importRows.length} 名成员</span></div><em className={importRows.some((row) => row.errors.length) ? "has-errors" : "ready"}>{importRows.some((row) => row.errors.length) ? `${importRows.filter((row) => row.errors.length).length} 行需修改` : "校验通过"}</em></header><div className="import-preview-table"><div className="import-preview-head"><span>Excel 行</span><span>成员</span><span>班级</span><span>部门 / 职务</span><span>校验结果</span></div>{importRows.slice(0, 8).map((row) => <div key={row.rowNumber} className={row.errors.length ? "invalid" : "valid"}><span>{row.rowNumber}</span><span><strong>{row.name || "未填写"}</strong><small>{row.studentNo || "未填写学号"}</small></span><span>{row.className || "未填写"}</span><span><strong>{row.department || "未填写"}</strong><small>{row.position || "未填写职务"}</small></span><span>{row.errors.length ? row.errors.join("；") : <><CheckCircle2 size={14}/>通过</>}</span></div>)}</div>{importRows.length > 8 && <p className="import-preview-more">另有 {importRows.length - 8} 名成员，将在确认后一起导入</p>}</div>}
        <div className="import-note"><CircleAlert size={16}/><span>导入成功后新届次将设为当前届次，往届成员与历史记录仍然保留。</span></div>
      </div>
      <footer><button className="outline-button" onClick={() => setShowTransition(false)}>取消</button><button className="primary-button" disabled={importingMembers || !importRows.length || importRows.some((row) => row.errors.length)} onClick={startTransition}><Upload size={16}/>{importingMembers ? "正在导入…" : `创建届次并导入${importRows.length ? ` ${importRows.length} 人` : ""}`}</button></footer>
    </div></div>}
  </div>;
}

export function MediaActivities({ onBack, tasks, onOpenTask, role, user, activities, onCreateActivity, onEditActivity, notify }: { onBack: () => void; tasks: Task[]; onOpenTask: (task: Task) => void; role: UserRole; user: DemoUser; activities: ActivityRecord[]; onCreateActivity: () => void; onEditActivity: (activity: ActivityRecord) => void; notify: (message: string) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState("全部");
  const [search, setSearch] = useState("");
  const availableActivities = role === "teacher" ? activities.filter((activity) => activity.teacher === user.name) : role === "leader" || role === "staff" ? activities.filter((activity) => activity.departments.includes(user.department)) : activities;
  const selectedActivity = availableActivities.find((activity) => activity.id === selectedId);
  const visibleActivities = availableActivities.filter((activity) => (stateFilter === "全部" || activity.state === stateFilter) && `${activity.name}${activity.organizer}${activity.category}`.includes(search.trim()));

  if (selectedActivity) {
    const activityTasks = tasks.filter((task) => (task.activityName || currentActivity.name) === selectedActivity.name);
    const finishedTasks = activityTasks.filter((task) => task.status === "已完成").length;
    return <div className="module-page activity-workspace"><div className="activity-detail-nav"><button onClick={() => setSelectedId(null)}><ChevronRight size={15}/>全部活动</button><span>/</span><strong>{selectedActivity.name}</strong></div><section className="activity-detail-head"><div><span className={`activity-state state-${selectedActivity.state}`}>{selectedActivity.state}</span><small>{selectedActivity.category}</small><h1>{selectedActivity.name}</h1><p>{selectedActivity.description}</p></div><div className="activity-detail-actions">{role === "chair" && <button className="outline-button" onClick={() => onEditActivity(selectedActivity)}><Settings size={16}/>活动设置</button>}{selectedActivity.id === "top-singer" && <button className="primary-button" onClick={onBack}><LayoutDashboard size={16}/>进入完整执行台</button>}</div></section><div className="activity-facts"><span><CalendarDays size={17}/><small>活动时间</small><strong>{selectedActivity.date} {selectedActivity.time}</strong></span><span><MapPin size={17}/><small>活动地点</small><strong>{selectedActivity.location}</strong></span><span><Building2 size={17}/><small>主办部门</small><strong>{selectedActivity.organizer}</strong></span><span><UserCheck size={17}/><small>指导教师</small><strong>{selectedActivity.teacher}</strong></span></div><div className="activity-detail-grid"><section className="activity-execution"><header><div><span>执行概况</span><h2>活动任务</h2></div><div className="activity-progress-compact"><b>{selectedActivity.progress}%</b><i><em style={{ width: `${selectedActivity.progress}%` }}/></i></div></header>{activityTasks.length ? <div className="activity-task-list"><div className="activity-task-head"><span>任务</span><span>执行人</span><span>截止时间</span><span>状态</span></div>{activityTasks.map((task) => <button key={task.id} onClick={() => onOpenTask(task)}><span><i className={`type-dot type-${task.kind}`}/><strong>{task.title}</strong><small>{task.department}</small></span><span>{task.person}</span><span>{task.deadline}</span><em className={`status status-${task.status}`}>{task.status}</em></button>)}</div> : <div className="activity-empty-tasks"><ClipboardCheck size={22}/><strong>这个活动还没有发布任务</strong></div>}<footer><span>{activityTasks.length} 项任务 · {finishedTasks} 项完成</span>{role === "chair" && <button onClick={() => notify(`正在为“${selectedActivity.name}”准备新任务`)}><Plus size={15}/>添加任务</button>}</footer></section><aside className="activity-side"><section><header><span>下一关键节点</span><strong>{selectedActivity.nextMilestone}</strong></header><div className="activity-milestones">{selectedActivity.milestones.map((milestone) => <div key={`${milestone.date}-${milestone.title}`} className={milestone.done ? "done" : ""}><i>{milestone.done ? <Check size={12}/> : milestone.date.slice(-3,-1)}</i><span><strong>{milestone.title}</strong><small>{milestone.date} · {milestone.owner}</small></span></div>)}</div></section><section><header><span>参与部门</span><strong>{selectedActivity.departments.length} 个部门参与</strong></header><div className="activity-departments">{selectedActivity.departments.map((department, index) => <span key={department}><i>{department.slice(0,1)}</i><b>{department}</b>{index === 0 && <small>主办</small>}</span>)}</div></section></aside></div></div>;
  }

  const activeCount = availableActivities.filter((activity) => activity.state !== "已结束").length;
  const averageProgress = activeCount ? Math.round(availableActivities.filter((activity) => activity.state !== "已结束").reduce((sum, activity) => sum + activity.progress, 0) / activeCount) : 0;
  return <div className="module-page activity-center"><div className="module-header"><div><span className="module-kicker">本学期活动全景</span><h1>活动中心</h1></div>{role === "chair" && <button className="primary-button" onClick={onCreateActivity}><Plus size={18}/>创建活动</button>}</div><div className="activity-overview-strip"><span><strong>{availableActivities.length}</strong><small>全部活动</small></span><span><strong>{activeCount}</strong><small>正在推进</small></span><span><strong>{availableActivities.reduce((sum, activity) => sum + activity.pending, 0)}</strong><small>待处理事项</small></span><span><strong>{averageProgress}%</strong><small>平均进度</small></span><div><Search size={16}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索活动或主办部门"/></div></div><div className="activity-center-toolbar"><div role="tablist">{["全部","筹备中","策划中","待启动","已结束"].map((state) => <button key={state} className={stateFilter === state ? "active" : ""} onClick={() => setStateFilter(state)}>{state}<span>{state === "全部" ? availableActivities.length : availableActivities.filter((activity) => activity.state === state).length}</span></button>)}</div><span>按活动日期排序</span></div><div className="activity-card-grid">{visibleActivities.map((activity) => <button key={activity.id} className="activity-card" onClick={() => setSelectedId(activity.id)}><header><div className="activity-card-meta"><span className={`activity-state state-${activity.state}`}>{activity.state}</span><small>{activity.category}</small></div><span className="activity-card-date"><CalendarDays size={14}/>{activity.date}</span><ChevronRight size={18}/></header><h2>{activity.name}</h2><p>{activity.description}</p><dl><div><dt><Building2 size={13}/>主办</dt><dd>{activity.organizer}</dd></div><div><dt><MapPin size={13}/>地点</dt><dd>{activity.location}</dd></div></dl><div className="activity-card-progress"><span><small>总体进度</small><strong>{activity.progress}%</strong></span><i><em style={{ width: `${activity.progress}%` }}/></i></div><footer><span>{activity.departments.length} 个协作部门</span><strong>{activity.pending ? `${activity.pending} 项待处理` : "已完成"}</strong></footer></button>)}{!visibleActivities.length && <div className="activity-no-results"><Search size={22}/><strong>没有找到符合条件的活动</strong></div>}</div></div>;
}

export function LoginScreen({ mode = "demo", onLogin, onPasswordLogin, onReset }: { mode?: "demo" | "password"; onLogin: (username: string, password: string) => string | null; onPasswordLogin?: (email: string, password: string) => Promise<string | null>; onReset: () => void }) {
  const [username, setUsername] = useState("chair");
  const [password, setPassword] = useState("123456");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const accounts = seededAccounts;
  const submitDemo = (event: React.FormEvent) => { event.preventDefault(); const result = onLogin(username.trim(), password); setError(result || ""); };
  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!onPasswordLogin) return;
    setSubmitting(true);
    const result = await onPasswordLogin(email.trim(), password);
    setSubmitting(false);
    setError(result || "");
  };

  if (mode === "password") {
    return <main className="login-page"><section className="login-brand"><div className="brand-mark large">CS</div><span>计算学院</span><h1>学生联盟管理系统</h1><p>活动、任务、资料与组织成员管理</p></section><section className="login-panel"><form onSubmit={submitPassword}><header><span>内部系统</span><h2>登录工作台</h2></header><label><span>邮箱</span><input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} placeholder="your@example.edu.cn" /></label><label><span>密码</span><input type="password" value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} /></label>{error && <div className="login-error">{error}</div>}<button className="primary-button login-submit" type="submit" disabled={submitting}><LogIn size={17}/>{submitting ? "登录中…" : "登录系统"}</button><footer><span>账号由管理员开通，不支持公开注册</span></footer></form></section></main>;
  }

  return <main className="login-page"><section className="login-brand"><div className="brand-mark large">CS</div><span>计算学院</span><h1>学生联盟管理系统</h1><p>活动、任务、资料与组织成员管理</p><div className="login-workflow"><span><i>1</i>主席发布主任务</span><span><i>2</i>负责人拆解与验收</span><span><i>3</i>干事执行并提交凭据</span><span><i>4</i>主席审核部门结办</span></div></section><section className="login-panel"><form onSubmit={submitDemo}><header><span>内部系统</span><h2>登录工作台</h2></header><label><span>账号</span><select value={username} onChange={(event) => { setUsername(event.target.value); setError(""); }}>{accounts.filter((account) => account.active).map((account) => <option key={account.username} value={account.username}>{account.role === "admin" ? "系统管理员" : account.role === "chair" ? "主席" : account.role === "leader" ? "部门负责人" : account.role === "teacher" ? "指导教师" : "干事"} · {account.username}</option>)}</select></label><label><span>密码</span><input type="password" value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }}/></label>{error && <div className="login-error">{error}</div>}<button className="primary-button login-submit" type="submit"><LogIn size={17}/>登录系统</button><footer><span>演示密码 <strong>123456</strong></span><button type="button" onClick={() => { setUsername("chair"); onReset(); }}>重置演示数据</button></footer></form></section></main>;
}

export function TextEntryModal({ title, description, label, initialValue, confirmText, onCancel, onConfirm }: { title: string; description: string; label: string; initialValue: string; confirmText: string; onCancel: () => void; onConfirm: (value: string) => void }) {
  const [value, setValue] = useState(initialValue);
  return <div className="modal-backdrop nested"><div className="text-entry-modal" role="dialog" aria-modal="true" aria-labelledby="text-entry-title"><header><div><span>任务处理</span><h2 id="text-entry-title">{title}</h2></div><button className="icon-button" onClick={onCancel} aria-label="关闭"><X size={18}/></button></header><div className="text-entry-body"><p>{description}</p><label><span>{label}</span><textarea rows={4} value={value} onChange={(event) => setValue(event.target.value)} /></label></div><footer><button className="outline-button" onClick={onCancel}>取消</button><button className="primary-button" disabled={!value.trim()} onClick={() => onConfirm(value.trim())}>{confirmText}</button></footer></div></div>;
}

export function ConfirmActionModal({ title, description, confirmText, onCancel, onConfirm }: { title: string; description: string; confirmText: string; onCancel: () => void; onConfirm: () => void }) {
  return <div className="modal-backdrop nested"><div className="confirm-action-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-action-title"><header><div><span>请确认操作</span><h2 id="confirm-action-title">{title}</h2></div><button className="icon-button" onClick={onCancel} aria-label="关闭"><X size={18}/></button></header><div><CircleAlert size={20}/><p>{description}</p></div><footer><button className="outline-button" onClick={onCancel}>取消</button><button className="danger-confirm-button" onClick={onConfirm}>{confirmText}</button></footer></div></div>;
}

export function LeaderTaskWorkspace({ user, accounts, tasks, subtasks, onWorkflowAction, onOpenTask, onStartMain, onSubmitMain, onWithdrawMain, notify, notifications }: { user: DemoUser; accounts: ManagedAccount[]; tasks: Task[]; subtasks: DelegatedTask[]; onWorkflowAction: (payload: WorkflowActionPayload) => Promise<{ ok: boolean; error?: string }>; onOpenTask: (task: Task) => void; onStartMain: (task: Task) => void; onSubmitMain: (task: Task) => void; onWithdrawMain: (task: Task) => void; notify: (message: string) => void; notifications: NotificationItem[] }) {
  const leaderName = user.name;
  const leaderDepartment = user.department;
  const departmentTasks = tasks.filter((task) => task.department === leaderDepartment);
  const departmentSubtasks = subtasks.filter((subtask) => departmentTasks.some((task) => isSubtaskOf(subtask, task)));
  const departmentExecutors = accounts.filter((account) => account.active && account.department === leaderDepartment && ["leader", "staff"].includes(account.role));
  const defaultAssignee = departmentExecutors.find((account) => account.role === "staff")?.name || leaderName;
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showDelegation, setShowDelegation] = useState(false);
  const [rejectionTarget, setRejectionTarget] = useState<DelegatedTask | null>(null);
  const [cancellationTarget, setCancellationTarget] = useState<DelegatedTask | null>(null);
  const [draft, setDraft] = useState({ title: "", assignee: defaultAssignee, deadline: "2026-09-21T10:00", evidence: "设备清单与现场照片" });
  // Keep an open task drawer synchronized with shared task updates.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (selectedTask) setSelectedTask(tasks.find((task) => task.id === selectedTask.id) || null); }, [tasks]);

  function openDelegation() {
    if (!selectedTask) return;
    setDraft({ title: "", assignee: defaultAssignee, deadline: "2026-09-21T10:00", evidence: selectedTask.kind === "技术保障" ? "设备清单、现场照片或测试视频" : "完成照片、交付文件或文字说明" });
    setShowDelegation(true);
  }

  async function submitDelegation() {
    if (!selectedTask || !draft.title.trim()) return;
    const res = await onWorkflowAction({ kind: "subtask", action: "create", parentTaskId: selectedTask.id, title: draft.title, assignee: draft.assignee, deadline: draft.deadline.replace("T", " "), evidence: draft.evidence });
    if (!res.ok) { notify(res.error || "分派失败"); return; }
    setShowDelegation(false);
    notify(`“${draft.title}”已分派给${draft.assignee}`);
  }

  async function completeSubtask(task: DelegatedTask) {
    const res = await onWorkflowAction({ kind: "subtask", id: task.id || "", action: "completeDirect" });
    if (res.ok) notify(`“${task.title}”已由负责人直接办结，操作已记入动态`); else notify(res.error || "办结失败");
  }

  async function cancelSubtask(task: DelegatedTask) {
    const res = await onWorkflowAction({ kind: "subtask", id: task.id || "", action: "cancel" });
    if (res.ok) { setCancellationTarget(null); notify(`“${task.title}”已撤销`); } else notify(res.error || "撤销失败");
  }

  async function reviewSubtask(task: DelegatedTask, approved: boolean, reason = "") {
    if (!approved && !reason) { setRejectionTarget(task); return; }
    const res = await onWorkflowAction({ kind: "subtask", id: task.id || "", action: approved ? "approve" : "reject", reason });
    if (res.ok) notify(approved ? `“${task.title}”已验收通过` : `“${task.title}”已退回修改`); else notify(res.error || "操作失败");
  }

  const selectedSubtasks = selectedTask ? subtasks.filter((task) => isSubtaskOf(task, selectedTask)) : [];
  const directlyAssigned = selectedTask?.person === leaderName;
  return <div className="role-dashboard leader-dashboard">
    <div className="role-welcome"><div><span>部门负责人工作台</span><h1>你好，{leaderName}</h1></div><div className="role-badge"><Users size={18}/><span><strong>{leaderDepartment}</strong>{departmentExecutors.filter((item) => item.role === "leader").length || 1}名负责人 · {departmentExecutors.filter((item) => item.role === "staff").length}名干事</span></div></div>
    <div className="role-stats"><button onClick={() => { const target = departmentTasks.find((task) => task.person === leaderName && !["待验收","已完成"].includes(task.status)); if (target) setSelectedTask(target); }}><span>直接交办给我</span><strong>{departmentTasks.filter((task) => task.person === leaderName && !["待验收","已完成"].includes(task.status)).length}</strong><small>由负责人亲自执行</small></button><button onClick={() => { const running = departmentSubtasks.find((task) => ["进行中","需修改"].includes(task.status)); const target = running ? departmentTasks.find((task) => isSubtaskOf(running,task)) : undefined; if (target) setSelectedTask(target); }}><span>执行中子任务</span><strong>{departmentSubtasks.filter((task) => ["进行中","需修改"].includes(task.status)).length}</strong><small>负责人或干事正在执行</small></button><button onClick={() => { const review = departmentSubtasks.find((task) => task.status === "待验收"); const target = review ? departmentTasks.find((task) => isSubtaskOf(review,task)) : undefined; if (target) setSelectedTask(target); }}><span>待验收</span><strong>{departmentSubtasks.filter((task) => task.status === "待验收").length}</strong><small>检查完成凭据</small></button></div>
    <div className="role-layout"><section><div className="section-head"><div><h2>部门主任务</h2></div></div><div className="leader-master-list">{departmentTasks.map((task) => { const count = subtasks.filter((subtask) => isSubtaskOf(subtask, task)).length; const isMine = task.person === leaderName; return <button key={task.id} onClick={() => setSelectedTask(task)}><i className={`type-dot type-${task.kind}`}/><span><strong>{task.title}</strong><small>{isMine ? "主席直接指派给你" : `主执行人：${task.person}`} · 截止 {task.deadline}</small></span><span><b>{count}</b><small>个子任务</small></span><em className={`status status-${task.status}`}>{task.status}</em><ChevronRight size={16}/></button>; })}</div></section><aside><h2>待处理通知</h2>{notifications.slice(0,3).map((item) => <article key={item.id} className={item.level || ""}><Bell size={16}/><span><strong>{item.title}</strong><p>{item.detail}</p><small>{item.time}</small></span></article>)}</aside></div>
    {selectedTask && <div className="modal-backdrop"><div className="leader-task-modal"><header><div><span>{selectedTask.kind} · 主任务</span><h2>{selectedTask.title}</h2></div><button className="icon-button" onClick={() => setSelectedTask(null)}><X size={18}/></button></header><div className="leader-task-body">{directlyAssigned && <div className="direct-assignment"><UserCheck size={18}/><span><strong>主席直接交办给你</strong><small>你可以亲自完成并提交主席，也可以按实际需要继续拆分给部门成员。</small></span>{selectedTask.status === "待开始" && <button className="primary-button" onClick={() => onStartMain(selectedTask)}>开始执行</button>}{selectedTask.status === "进行中" && <button className="outline-button" onClick={() => { setSelectedTask(null); onOpenTask(selectedTask); }}>上传凭据</button>}</div>}<div className="leader-context"><div><Activity size={16}/><span><small>所属活动</small><strong>{selectedTask.activityName || currentActivity.name}</strong></span></div><div><CalendarDays size={16}/><span><small>活动时间</small><strong>{selectedTask.activityTime || currentActivity.time}</strong></span></div><div><MapPin size={16}/><span><small>活动地点</small><strong>{selectedTask.activityLocation || currentActivity.location}</strong></span></div><div><Clock3 size={16}/><span><small>主任务截止</small><strong>{selectedTask.deadline}</strong></span></div></div><section><h3>主席下发要求</h3><p>{selectedTask.description}</p><div className="leader-parameters">{selectedTask.fields.map((field) => <span key={field.label}><small>{field.label}</small><strong>{field.value}</strong></span>)}</div></section><section><div className="section-inline"><h3>参考附件</h3><button className="text-button" onClick={() => { setSelectedTask(null); onOpenTask(selectedTask); }}>查看全部资料</button></div><div className="leader-files">{(selectedTask.attachments || []).map((file) => <span key={file.name}><FileText size={15}/><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(1)}MB</small></span>)}{!selectedTask.attachments?.length && <span className="empty-file"><Paperclip size={15}/>暂无参考附件</span>}</div></section><section><div className="section-inline"><div><h3>执行分工</h3><span>{selectedSubtasks.length} 个子任务 · 小事项可直接办结</span></div><button className="primary-button" onClick={openDelegation}><Plus size={15}/>新增子任务</button></div><div className="leader-subtasks">{selectedSubtasks.map((task, index) => <article key={task.id || `${task.title}-${index}`}><i><ClipboardCheck size={15}/></i><span><strong>{task.title}</strong><small>{task.lastAction || task.completedBy || `凭据：${task.evidence}`}</small></span><span><b>{task.assignee}</b><small>{task.attachments?.length ? `${task.attachments.length}个凭据` : task.deadline}</small></span><em className={`status status-${task.status}`}>{task.status}</em><div className="subtask-actions">{task.status !== "已完成" && <button className="subtask-cancel" title="撤销子任务" aria-label={`撤销${task.title}`} onClick={() => setCancellationTarget(task)}><Trash2 size={13}/></button>}{task.status === "待验收" ? <><button onClick={() => reviewSubtask(task,false)}>退回</button><button className="approve" onClick={() => reviewSubtask(task,true)}>通过</button></> : task.status !== "已完成" ? <button className="compact-action" onClick={() => completeSubtask(task)}><Check size={13}/>直接办结</button> : <CheckCircle2 size={16}/>}</div></article>)}{!selectedSubtasks.length && <div className="empty-subtasks"><ClipboardCheck size={20}/><strong>还没有执行分工</strong><span>只有需要单独跟踪的工作才拆成子任务；口头即可完成的小事无需录入。</span></div>}</div><div className="leader-submit-bar"><span><strong>部门结办</strong><small>{selectedTask.status === "待验收" ? "已提交主席审核，等待最终确认" : selectedSubtasks.length && selectedSubtasks.some((task) => task.status !== "已完成") ? "全部子任务完成后可提交" : "负责人提交后，由主席最终审核"}</small></span>{selectedTask.status === "待验收" ? <button className="outline-button withdraw-button" onClick={() => onWithdrawMain(selectedTask)}><RotateCcw size={15}/>撤回提交</button> : <button className="primary-button" disabled={Boolean(selectedSubtasks.length && selectedSubtasks.some((task) => task.status !== "已完成"))} onClick={() => onSubmitMain(selectedTask)}><ClipboardCheck size={15}/>提交主席审核</button>}</div></section></div><footer><button className="outline-button" onClick={() => setSelectedTask(null)}>关闭</button><button className="primary-button" onClick={() => { setSelectedTask(null); onOpenTask(selectedTask); }}><Eye size={16}/>查看完整任务资料</button></footer></div></div>}
    {showDelegation && selectedTask && <div className="modal-backdrop nested"><div className="delegation-modal"><header><div><span>来自主任务：{selectedTask.title}</span><h2>新增执行子任务</h2></div><button className="icon-button" onClick={() => setShowDelegation(false)}><X size={18}/></button></header><div className="form-grid"><label className="span-2"><span>子任务名称 *</span><input value={draft.title} onChange={(event) => setDraft({...draft,title:event.target.value})} placeholder="例如：完成无线麦克风电量与频段检查"/></label><label><span>执行人</span><select value={draft.assignee} onChange={(event) => setDraft({...draft,assignee:event.target.value})}>{departmentExecutors.map((account) => <option key={account.username} value={account.name}>{account.name}{account.role === "leader" ? "（负责人）" : ""}</option>)}</select></label><label><span>截止时间</span><input type="datetime-local" value={draft.deadline} onChange={(event) => setDraft({...draft,deadline:event.target.value})}/></label><label className="span-2"><span>完成凭据要求</span><input value={draft.evidence} onChange={(event) => setDraft({...draft,evidence:event.target.value})} placeholder="照片、视频、文件或文字说明"/></label></div><footer><button className="outline-button" onClick={() => setShowDelegation(false)}>取消</button><button className="primary-button" disabled={!draft.title.trim() || !draft.assignee} onClick={submitDelegation}>确认分派</button></footer></div></div>}
    {rejectionTarget && <TextEntryModal title="退回子任务" description={`“${rejectionTarget.title}”将退回给${rejectionTarget.assignee}修改，原因会同步显示在任务动态中。`} label="退回原因" initialValue="请补充更清晰的现场照片" confirmText="确认退回" onCancel={() => setRejectionTarget(null)} onConfirm={(reason) => { reviewSubtask(rejectionTarget, false, reason); setRejectionTarget(null); }}/>} 
    {cancellationTarget && <ConfirmActionModal title="撤销子任务" description={`撤销“${cancellationTarget.title}”后，该任务将从${cancellationTarget.assignee}的执行列表移除，并向其发送撤销通知。`} confirmText="确认撤销" onCancel={() => setCancellationTarget(null)} onConfirm={() => cancelSubtask(cancellationTarget)}/>} 
  </div>;
}

export function StaffDashboard({ user, tasks, subtasks, onWorkflowAction, notify, notifications }: { user: DemoUser; tasks: Task[]; subtasks: DelegatedTask[]; onWorkflowAction: (payload: WorkflowActionPayload) => Promise<{ ok: boolean; error?: string }>; notify: (message: string) => void; notifications: NotificationItem[] }) {
  const [uploadingId, setUploadingId] = useState("");
  const [submissionTarget, setSubmissionTarget] = useState<DelegatedTask | null>(null);
  const mySubtasks = subtasks.filter((task) => task.assignee === user.name);
  const uploadEvidence = async (target: DelegatedTask, files: FileList | null) => {
    if (!files?.length) return;
    setUploadingId(target.id || target.title);
    let uploadedCount = 0; const errors: string[] = [];
    for (const file of Array.from(files)) {
      const form = new FormData(); form.append("file", file);
      const uploadResponse = await fetch("/api/files", { method: "POST", body: form });
      const uploadResult = await uploadResponse.json();
      if (!uploadResponse.ok) { errors.push(`${file.name}：${uploadResult.error || "上传失败"}`); continue; }
      const action = await onWorkflowAction({ kind: "subtask", id: target.id || "", action: "addAttachment", attachment: uploadResult.attachment });
      if (action.ok) uploadedCount++; else errors.push(`${file.name}：${action.error || "附件记录失败"}`);
    }
    setUploadingId(""); notify(errors.length ? errors[0] : `已上传${uploadedCount}个完成凭据`);
  };
  const removeEvidence = async (target: DelegatedTask, file: Attachment) => {
    try {
      await deleteAttachmentObject(file);
      const action = await onWorkflowAction({ kind: "subtask", id: target.id || "", action: "removeAttachment", key: file.key });
      if (action.ok) notify(`已删除“${file.name}”`); else notify(action.error || "附件删除失败");
    } catch (error) { notify(error instanceof Error ? error.message : "附件删除失败"); }
  };
  const submit = (target: DelegatedTask) => {
    setSubmissionTarget(target);
  };
  const start = async (target: DelegatedTask) => {
    const action = await onWorkflowAction({ kind: "subtask", id: target.id || "", action: "start" });
    if (!action.ok) notify(action.error || "操作失败");
  };
  const confirmSubmit = async (target: DelegatedTask, note: string) => {
    const action = await onWorkflowAction({ kind: "subtask", id: target.id || "", action: "submit", note });
    if (!action.ok) { notify(action.error || "提交失败"); return; }
    notify(`“${target.title}”已提交负责人验收`);
    setSubmissionTarget(null);
  };
  const withdrawSubmission = async (target: DelegatedTask) => {
    const action = await onWorkflowAction({ kind: "subtask", id: target.id || "", action: "withdraw" });
    if (action.ok) notify(`“${target.title}”已撤回，可继续修改`); else notify(action.error || "撤回失败");
  };
  const completed = mySubtasks.filter((task) => task.status === "已完成").length;
  return <div className="role-dashboard staff-dashboard"><div className="role-welcome"><div><span>我的执行工作台</span><h1>你好，{user.name}</h1></div><div className="role-badge"><CheckCircle2 size={18}/><span><strong>本期完成 {completed} 项</strong>待处理 {mySubtasks.length - completed} 项</span></div></div><div className="staff-focus"><section><div className="section-head"><div><h2>我的任务</h2></div></div>{mySubtasks.map((task) => { const parent = tasks.find((item) => task.parentTaskId ? item.id === task.parentTaskId : item.title === task.parent); const parentLocked = parent ? ["待验收","已完成"].includes(parent.status) : false; const canSubmit = Boolean(task.attachments?.length); const canEditEvidence = !parentLocked && !["待验收","已完成"].includes(task.status); return <article key={task.id || task.title} className={task.status === "需修改" ? "needs-revision" : ""}><header><span className="tag">来自：{task.parent}</span><i className={`status status-${task.status}`}>{task.status}</i></header><h3>{task.title}</h3><div className="task-context-inline"><span><CalendarDays size={14}/>{parent?.activityTime || currentActivity.time}</span><span><MapPin size={14}/>{parent?.activityLocation || currentActivity.location}</span><span><Clock3 size={14}/>截止 {task.deadline}</span></div><p>{task.status === "需修改" ? task.lastAction : `完成要求：${task.evidence}`}</p>{task.attachments?.length ? <div className="staff-evidence-list">{task.attachments.map((file) => <span key={file.key}><FileText size={13}/><b>{file.name}</b>{canEditEvidence && <button title="删除附件" aria-label={`删除${file.name}`} onClick={() => removeEvidence(task,file)}><X size={12}/></button>}</span>)}</div> : <div className="staff-no-evidence">尚未上传完成凭据</div>}<footer>{canEditEvidence && <label className="outline-button staff-upload"><Paperclip size={14}/>{uploadingId === (task.id || task.title) ? "上传中" : "上传凭据"}<input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip" multiple disabled={Boolean(uploadingId)} onChange={(event) => { const files = event.currentTarget.files; event.currentTarget.value = ""; uploadEvidence(task,files); }}/></label>}{task.status === "待开始" && !parentLocked && <button className="primary-button" onClick={() => start(task)}>开始任务</button>}{["进行中","需修改"].includes(task.status) && !parentLocked && <button className="primary-button" disabled={!canSubmit} onClick={() => submit(task)}><Upload size={15}/>提交负责人</button>}{task.status === "待验收" && <><span>等待负责人验收</span><button className="outline-button" onClick={() => withdrawSubmission(task)}><RotateCcw size={14}/>撤回提交</button></>}{task.status === "已完成" && <span className="completed-label"><CheckCircle2 size={15}/>已完成</span>}{parentLocked && task.status !== "已完成" && <span>主任务已锁定</span>}</footer></article>; })}{!mySubtasks.length && <div className="staff-empty"><ClipboardCheck size={22}/><strong>当前没有分派给你的任务</strong></div>}</section><aside><h2>我的通知</h2>{notifications.slice(0,3).map(item => <article key={item.id} className={item.level || ""}><Bell size={16}/><span><strong>{item.title}</strong><p>{item.detail}</p><small>{item.time}</small></span></article>)}</aside></div>{submissionTarget && <TextEntryModal title="提交完成结果" description={`请说明“${submissionTarget.title}”的实际完成情况，负责人验收时会看到这段说明。`} label="完成说明" initialValue={submissionTarget.completionNote || "已按要求完成并上传凭据"} confirmText="提交负责人验收" onCancel={() => setSubmissionTarget(null)} onConfirm={(note) => confirmSubmit(submissionTarget, note)}/>}</div>;
}

export function TeacherDashboard({ user, tasks, activities, onOpenTask, notify }: { user: DemoUser; tasks: Task[]; activities: ActivityRecord[]; onOpenTask: (task: Task) => void; notify: (message: string) => void }) {
  const guidedActivities = activities.filter((activity) => activity.teacher === user.name).slice(0,3);
  const risks = tasks.filter((task) => task.risk || task.status === "待验收").slice(0,4);
  return <div className="role-dashboard teacher-dashboard"><div className="role-welcome"><div><span>指导教师工作台</span><h1>您好，{user.name}教师</h1></div><div className="role-badge"><ShieldCheck size={18}/><span><strong>指导与监督</strong>仅查看授权活动 · 意见全程留痕</span></div></div><div className="role-stats"><button onClick={() => notify("已打开方案审核，可填写指导意见")}><span>待指导材料</span><strong>2</strong><small>方案与重大变更</small></button><button onClick={() => notify("打开指导活动")}><span>指导活动</span><strong>{guidedActivities.length}</strong><small>按活动授权查看</small></button><div><span>本月已反馈</span><strong>6</strong><small>指导意见与复盘</small></div></div><div className="role-layout"><section><div className="section-head"><div><h2>待指导事项</h2></div></div><div className="teacher-review-list"><article><i className="warning"><CircleAlert size={17}/></i><span><strong>十佳歌手比赛执行方案 V3</strong><small>主席徐介翰提交 · 等待指导意见</small></span><button onClick={() => notify("已打开方案审核，可填写指导意见")}>查看并指导</button></article>{risks.map((task) => <article key={task.id}><i><FileText size={17}/></i><span><strong>{task.title}</strong><small>{task.department} · {task.status}</small></span><button onClick={() => onOpenTask(task)}>查看材料</button></article>)}</div></section><aside><h2>指导活动</h2>{guidedActivities.map((activity) => <article key={activity.id}><Activity size={16}/><span><strong>{activity.name}</strong><p>{activity.date} · {activity.location}</p><small>{activity.state} · {activity.progress}%</small></span></article>)}</aside></div></div>;
}

export function AdminDashboard({ notify, accounts }: { notify: (message: string) => void; accounts: ManagedAccount[] }) {
  return <div className="admin-dashboard"><div className="module-header"><div><span className="module-kicker">系统治理工作台</span><h1>系统管理总览</h1></div><span className="admin-boundary"><ShieldCheck size={16}/>技术权限与业务权限已隔离</span></div><div className="admin-health"><div><span>账号状态</span><strong>{accounts.filter((item) => item.active).length} / {accounts.length}</strong><small>启用账号</small></div><div><span>待分配角色</span><strong>{accounts.filter((item) => !item.active).length}</strong><small>停用账号</small></div><div><span>附件存储</span><strong>正常</strong><small>对象存储可用</small></div><div><span>数据备份</span><strong>已完成</strong><small>每日 23:30</small></div></div><div className="admin-layout"><section><header><div><span>访问控制</span><h2>关键账号与数据范围</h2></div><button onClick={() => notify("已进入账号与权限管理")}>管理全部账号<ChevronRight size={14}/></button></header><div className="admin-account-head"><span>用户</span><span>业务身份</span><span>数据范围</span><span>状态</span></div>{accounts.map((account) => <button key={account.name} onClick={() => notify(`已打开${account.name}的权限信息`)}><span><i>{account.name.slice(0,1)}</i><strong>{account.name}</strong></span><span>{account.role === "admin" ? "系统管理员" : account.role === "chair" ? "主席" : account.role === "leader" ? "负责人" : account.role === "teacher" ? "指导教师" : "干事"}</span><span>{account.scope}</span><em>{account.active ? "正常" : "停用"}</em></button>)}</section><aside><header><span>管理员待办</span><h2>需要处理</h2></header><button onClick={() => notify("已打开待分配角色列表")}><UserPlus size={17}/><span><strong>{accounts.filter((item) => !item.active).length}个账号当前停用</strong><small>账号状态管理</small></span><ChevronRight size={14}/></button><button onClick={() => notify("已打开权限变更记录")}><ShieldCheck size={17}/><span><strong>1项权限变更待复核</strong><small>负责人调整为普通成员</small></span><ChevronRight size={14}/></button><button onClick={() => notify("已打开运行日志")}><FileText size={17}/><span><strong>今日运行记录正常</strong><small>无失败上传和数据异常</small></span><ChevronRight size={14}/></button></aside></div></div>;
}

export function RoleDashboard({ user, accounts, role, tasks, activities, subtasks, onWorkflowAction, onOpenTask, onStartMain, onSubmitMain, onWithdrawMain, notify, notifications }: { user: DemoUser; accounts: ManagedAccount[]; role: UserRole; tasks: Task[]; activities: ActivityRecord[]; subtasks: DelegatedTask[]; onWorkflowAction: (payload: WorkflowActionPayload) => Promise<{ ok: boolean; error?: string }>; onOpenTask: (task: Task) => void; onStartMain: (task: Task) => void; onSubmitMain: (task: Task) => void; onWithdrawMain: (task: Task) => void; notify: (message: string) => void; notifications: NotificationItem[] }) {
  if (role === "admin") return <AdminDashboard notify={notify} accounts={accounts}/>;
  if (role === "leader") return <LeaderTaskWorkspace user={user} accounts={accounts} tasks={tasks} subtasks={subtasks} onWorkflowAction={onWorkflowAction} onOpenTask={onOpenTask} onStartMain={onStartMain} onSubmitMain={onSubmitMain} onWithdrawMain={onWithdrawMain} notify={notify} notifications={notifications}/>;

  if (role === "teacher") return <TeacherDashboard user={user} tasks={tasks} activities={activities} onOpenTask={onOpenTask} notify={notify}/>;
  return <StaffDashboard user={user} tasks={tasks} subtasks={subtasks} onWorkflowAction={onWorkflowAction} notify={notify} notifications={notifications}/>;
}

export function ChairOverview({ tasks, activities, onOpenTask, onOpenActivities, onOpenTasks }: { tasks: Task[]; activities: ActivityRecord[]; onOpenTask: (task: Task) => void; onOpenActivities: () => void; onOpenTasks: () => void }) {
  const activeActivities = activities.filter((activity) => activity.state !== "已结束");
  const reviewTasks = tasks.filter((task) => task.status === "待验收");
  const riskTasks = tasks.filter((task) => task.risk && task.status !== "已完成");
  const attentionTasks = [...reviewTasks, ...riskTasks.filter((task) => !reviewTasks.some((item) => item.id === task.id)), ...tasks.filter((task) => task.status === "待开始")].slice(0, 6);
  const departments = Array.from(new Set(tasks.map((task) => task.department))).map((department) => { const items = tasks.filter((task) => task.department === department); const done = items.filter((task) => task.status === "已完成").length; return { department, total: items.length, done, review: items.filter((task) => task.status === "待验收").length, progress: items.length ? Math.round(done / items.length * 100) : 0 }; }).sort((a,b) => b.total - a.total);
  return <div className="chair-overview-page"><div className="chair-overview-head"><div><span className="module-kicker">全局监督工作台</span><h1>主席总览</h1></div></div><section className="chair-summary-strip"><button onClick={onOpenActivities}><Activity size={19}/><span><strong>{activeActivities.length}</strong><small>正在推进的活动</small></span><ChevronRight size={16}/></button><button onClick={onOpenTasks}><ClipboardCheck size={19}/><span><strong>{reviewTasks.length}</strong><small>等待主席审核</small></span><ChevronRight size={16}/></button><button className={riskTasks.length ? "attention" : ""} onClick={() => riskTasks[0] ? onOpenTask(riskTasks[0]) : onOpenTasks()}><CircleAlert size={19}/><span><strong>{riskTasks.length}</strong><small>风险与阻塞事项</small></span><ChevronRight size={16}/></button><button onClick={onOpenTasks}><Clock3 size={19}/><span><strong>{tasks.filter((task) => task.status === "待开始").length}</strong><small>等待启动的任务</small></span><ChevronRight size={16}/></button></section><div className="chair-overview-grid"><section className="chair-attention"><header><div><span>决策队列</span><h2>需要你处理</h2></div><button onClick={onOpenTasks}>全部任务<ChevronRight size={14}/></button></header><div className="chair-attention-list">{attentionTasks.map((task) => <button key={task.id} onClick={() => onOpenTask(task)}><i className={task.status === "待验收" ? "review" : task.risk ? "risk" : "start"}>{task.status === "待验收" ? <ClipboardCheck size={15}/> : task.risk ? <CircleAlert size={15}/> : <Clock3 size={15}/>}</i><span><strong>{task.title}</strong><small>{task.activityName || currentActivity.name} · {task.department} / {task.person}</small></span><span><b>{task.status === "待验收" ? "审核结果" : task.risk ? "查看风险" : "尚未开始"}</b><small>{task.deadline}</small></span><ChevronRight size={15}/></button>)}{!attentionTasks.length && <div className="chair-all-clear"><CheckCircle2 size={22}/><strong>当前没有待处理事项</strong></div>}</div></section><aside className="chair-activities"><header><div><span>活动进度</span><h2>近期活动</h2></div><button onClick={onOpenActivities}>活动中心<ChevronRight size={14}/></button></header>{activeActivities.slice(0,4).map((activity) => <button key={activity.id} onClick={onOpenActivities}><span className={`activity-state state-${activity.state}`}>{activity.state}</span><span><strong>{activity.name}</strong><small>{activity.date} · {activity.organizer}</small></span><b>{activity.progress}%</b></button>)}</aside></div><section className="chair-department-pulse"><header><div><span>执行监督</span><h2>部门任务概况</h2></div><small>按照当前任务实时汇总</small></header><div className="department-pulse-head"><span>部门</span><span>任务数</span><span>完成进度</span><span>待验收</span></div>{departments.map((item) => <div key={item.department}><strong>{item.department}</strong><span>{item.total} 项</span><span><i><em style={{width:`${item.progress}%`}}/></i><b>{item.progress}%</b></span><span>{item.review ? `${item.review} 项` : "无"}</span></div>)}</section></div>;
}

export function ArchiveWorkspace({ role, records, onUpload }: { role: UserRole; records: ArchiveRecord[]; onUpload: () => void }) {
  const years = ["2026-2027学年", "2025-2026学年", "2024-2025学年"];
  const [academicYear, setAcademicYear] = useState(years[0]);
  const [semester, setSemester] = useState<AcademicSemester>("上学期");
  const [activity, setActivity] = useState("全部活动");
  const [category, setCategory] = useState("全部资料");
  const [search, setSearch] = useState("");
  const [selectedFile, setSelectedFile] = useState<ArchiveRecord | null>(null);
  const periodRecords = records.filter((file) => file.academicYear === academicYear && file.semester === semester);
  const activities = ["全部活动", ...Array.from(new Set(periodRecords.map((file) => file.activity)))];
  const categories = ["全部资料", ...Array.from(new Set(periodRecords.map((file) => file.category)))];
  const visible = periodRecords.filter((file) => (activity === "全部活动" || file.activity === activity) && (category === "全部资料" || file.category === category) && (!search.trim() || `${file.name}${file.owner}${file.activity}`.toLowerCase().includes(search.trim().toLowerCase())));
  const chooseYear = (year: string) => { setAcademicYear(year); setActivity("全部活动"); setCategory("全部资料"); };
  const chooseSemester = (value: AcademicSemester) => { setSemester(value); setActivity("全部活动"); setCategory("全部资料"); };
  return <div className="module-page archive-workspace">
    <div className="module-header"><div><span className="module-kicker">资料中心</span><h1>资料归档</h1></div>{(role === "chair" || role === "leader") && <button className="primary-button" onClick={onUpload}><Plus size={18}/>上传资料</button>}</div>
    <div className="archive-rule-strip"><CalendarDays size={18}/><span><strong>{academicYear} · {semester}</strong><small>每年8月切换学年 · 学期日期按学院校历配置</small></span></div>
    <div className="archive-browser">
      <aside className="archive-year-nav"><header><span>归档目录</span><small>{records.length} 份资料</small></header>{years.map((year) => <button key={year} className={academicYear === year ? "active" : ""} onClick={() => chooseYear(year)}><span><strong>{year}</strong><small>{year === years[0] ? "当前学年" : "历史学年"}</small></span><b>{records.filter((file) => file.academicYear === year).length}</b><ChevronRight size={15}/></button>)}</aside>
      <section className="archive-content">
        <div className="archive-toolbar"><div className="semester-switch" aria-label="选择学期"><button className={semester === "上学期" ? "active" : ""} onClick={() => chooseSemester("上学期")}>上学期</button><button className={semester === "下学期" ? "active" : ""} onClick={() => chooseSemester("下学期")}>下学期</button></div><label><Search size={16}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索资料、活动或部门"/></label></div>
        <div className="archive-filter-row"><label><span>活动</span><select value={activity} onChange={(event) => setActivity(event.target.value)}>{activities.map((item) => <option key={item}>{item}</option>)}</select></label><div>{categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}<small>{item === "全部资料" ? periodRecords.length : periodRecords.filter((file) => file.category === item).length}</small></button>)}</div></div>
        <div className="archive-file-table"><header><span>资料名称</span><span>关联活动</span><span>归档部门</span><span>更新时间</span><span></span></header>{visible.map((file) => <button key={file.id} onClick={() => setSelectedFile(file)}><span><i><FileText size={18}/></i><b>{file.name}</b><small>{file.category} · {file.size}</small></span><span>{file.activity}</span><span>{file.owner}</span><time>{file.time}</time><ChevronRight size={15}/></button>)}{!visible.length && <div className="archive-empty"><FileText size={22}/><strong>当前目录暂无资料</strong></div>}</div>
      </section>
    </div>
    {selectedFile && <div className="modal-backdrop"><div className="quick-flow-modal archive-detail-modal"><header><div><span>{selectedFile.category}</span><h2>{selectedFile.name}</h2></div><button className="icon-button" onClick={() => setSelectedFile(null)} aria-label="关闭"><X size={18}/></button></header><div className="readonly-detail"><dl><div><dt>学年学期</dt><dd>{selectedFile.academicYear} · {selectedFile.semester}</dd></div><div><dt>关联活动</dt><dd>{selectedFile.activity}</dd></div><div><dt>归档部门</dt><dd>{selectedFile.owner}</dd></div><div><dt>更新时间</dt><dd>{selectedFile.time}</dd></div></dl>{selectedFile.description && <p>{selectedFile.description}</p>}</div><footer><button className="outline-button" onClick={() => setSelectedFile(null)}>关闭</button>{selectedFile.key && <button className="primary-button" onClick={() => window.open(`/api/files?key=${encodeURIComponent(selectedFile.key!)}`, "_blank")}><Upload size={16}/>下载文件</button>}</footer></div></div>}
  </div>;
}

export function AccountsWorkspace({ notify, pushNotification }: { notify: (message: string) => void; pushNotification: (draft: NotificationDraft) => void }) {
  const [accounts, setAccounts] = useState<ManagedAccount[]>([]);
  const [editing, setEditing] = useState<ManagedAccount | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(true);
  async function loadAccounts() {
    try {
      const response = await fetch("/api/accounts");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "账号读取失败");
      const next = result.accounts?.length ? result.accounts : seededAccounts;
      setAccounts(next);
      window.dispatchEvent(new CustomEvent("accounts-updated", { detail: next }));
    } catch (error) { notify(error instanceof Error ? error.message : "账号读取失败"); }
    finally { setLoading(false); }
  }
  // Account data comes from the server and is refreshed after every save.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadAccounts(); }, []);
  const save = async () => {
    if (!editing?.email.trim() || !editing.name.trim()) return;
    if (isNew && accounts.some((item) => item.email.toLowerCase() === editing.email.toLowerCase())) return notify("登录邮箱已存在");
    const response = await fetch("/api/accounts", { method: isNew || !editing.id ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editing) });
    const result = await response.json();
    if (!response.ok) return notify(result.error || "账号保存失败");
    pushNotification({ recipientUsernames: [editing.username], title: isNew ? "系统账号已创建" : "账号或权限已更新", detail: isNew ? `你的账号已创建，当前身份为${editing.title}。` : `管理员更新了你的身份、数据范围或登录状态，请重新登录查看。`, level: editing.active ? "info" : "warning", entity: { type: "account", id: editing.username } });
    await loadAccounts(); setEditing(null); setIsNew(false); notify("账号信息已保存");
  };
  const openNew = () => { setIsNew(true); setEditing({ email: "", username: "", name: "", role: "staff", department: "运维部", title: "干事", scope: "本人任务", active: true }); };
  return <div className="module-page"><div className="module-header"><div><span className="module-kicker">{accounts.filter((item) => item.active).length} 个启用账号</span><h1>账号与权限</h1></div><button className="primary-button" onClick={openNew}><UserPlus size={17}/>新增账号</button></div><div className="permission-table"><div><span>账号</span><span>身份</span><span>岗位</span><span>数据范围</span><span>状态</span></div>{!loading && accounts.map((account) => <button key={account.id || account.username} onClick={() => { setIsNew(false); setEditing(account); }}><span><i>{account.name.slice(0,1)}</i><b>{account.name}</b><small>{account.email}</small></span><span>{account.role === "admin" ? "系统管理员" : account.role === "chair" ? "主席" : account.role === "leader" ? "负责人" : account.role === "teacher" ? "指导教师" : "干事"}</span><span>{account.title}</span><span>{account.scope}</span><em>{account.active ? "正常" : "停用"}</em></button>)}</div>
    {editing && <div className="modal-backdrop"><div className="member-modal"><header><div><span>{isNew ? "新增账号" : "账号设置"}</span><h2>{editing.name || "账号信息"}</h2></div><button className="icon-button" onClick={() => setEditing(null)} aria-label="关闭"><X size={18}/></button></header><div className="form-grid"><label><span>登录邮箱 *</span><input type="email" value={editing.email} onChange={(event) => setEditing({...editing,email:event.target.value,username:isNew ? event.target.value : editing.username})}/></label><label><span>姓名 *</span><input value={editing.name} onChange={(event) => setEditing({...editing,name:event.target.value})}/></label><label><span>系统标识</span><input value={editing.username} onChange={(event) => setEditing({...editing,username:event.target.value})}/></label><label><span>身份</span><select value={editing.role} onChange={(event) => { const role = event.target.value as UserRole; setEditing({...editing,role,title:role === "chair" ? "主席" : role === "leader" ? "部门负责人" : role === "teacher" ? "指导教师" : role === "admin" ? "系统管理员" : "干事",scope:role === "chair" ? "当前届次全部业务" : role === "leader" ? `${editing.department}及相关任务` : role === "teacher" ? "受邀指导活动" : role === "admin" ? "系统配置与基础数据" : "本人任务"}); }}><option value="admin">系统管理员</option><option value="chair">主席</option><option value="leader">负责人</option><option value="staff">干事</option><option value="teacher">指导教师</option></select></label><label><span>部门</span><select value={editing.department} onChange={(event) => setEditing({...editing,department:event.target.value,scope:editing.role === "leader" ? `${event.target.value}及相关任务` : editing.scope})}><option>主席团</option><option>运维部</option><option>PC部</option><option>新媒体中心</option><option>文艺部</option><option>心理部</option></select></label><label className="span-2"><span>数据范围</span><input value={editing.scope} onChange={(event) => setEditing({...editing,scope:event.target.value})}/></label><label aria-label="允许登录" className="span-2 simple-check"><input type="checkbox" checked={editing.active} onChange={(event) => setEditing({...editing,active:event.target.checked})}/><span><strong>允许登录</strong></span></label></div><footer><button className="outline-button" onClick={() => setEditing(null)}>取消</button><button className="primary-button" disabled={!editing.email.trim() || !editing.name.trim() || !editing.username.trim()} onClick={() => void save()}>保存</button></footer></div></div>}
  </div>;
}

function auditActionLabel(action: string): string {
  const labels: Record<string, string> = {
    create: "创建子任务", start: "开始", submit: "提交审核", withdraw: "撤回提交",
    approve: "审核通过", reject: "退回修改", completeDirect: "直接办结", cancel: "撤销",
    reopen: "重新打开", addAttachment: "添加附件", removeAttachment: "删除附件",
  };
  return labels[action] || action;
}

export function AuditWorkspace({ notify }: { notify: (message: string) => void }) {
  const [records, setRecords] = useState<Array<{ actor: string; action: string; target: string; time: string; type: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("全部操作");
  // 审计记录来自服务端 workflow_events 表，此处只做展示映射。
  useEffect(() => {
    fetch("/api/audit").then((response) => (response.ok ? response.json() : null)).then((result) => {
      if (Array.isArray(result?.events)) {
        setRecords(result.events.map((event: { action: string; from_status: string; to_status: string; actor_name: string; entity_type: string; entity_id: string; created_at: string }) => ({
          actor: event.actor_name,
          action: `${auditActionLabel(event.action)}：${event.from_status || "新建"} → ${event.to_status}`,
          target: `${event.entity_type === "task" ? "主任务" : "子任务"} #${event.entity_id}`,
          time: new Date(event.created_at).toLocaleString("zh-CN", { hour12: false }),
          type: "业务流转",
        })));
      }
    }).catch(() => undefined).finally(() => setLoading(false));
  }, []);
  const visible = filter === "全部操作" ? records : records.filter((item) => item.type === filter);
  const exportLog = () => {
    const csv = ["操作人,操作,对象,类型,时间", ...visible.map((item) => [item.actor,item.action,item.target,item.type,item.time].map((cell) => `"${cell}"`).join(","))].join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob(["\ufeff",csv], { type: "text/csv;charset=utf-8" })); link.download = "学生联盟审计日志.csv"; link.click(); URL.revokeObjectURL(link.href); notify("审计日志已导出");
  };
  return <div className="module-page"><div className="module-header"><div><span className="module-kicker">服务端审计轨迹</span><h1>审计日志</h1></div><button className="outline-button" onClick={exportLog}><Upload size={16}/>导出日志</button></div><div className="audit-filters">{["全部操作","业务流转"].map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}<span>{loading ? "读取中…" : `${visible.length} 条记录`}</span></div><div className="audit-list">{visible.map((item,index) => <article key={`${item.time}-${index}`}><i><FileText size={15}/></i><span><strong>{item.action}</strong><small>{item.actor} · {item.target}</small></span><em>{item.type}</em><time>{item.time}</time></article>)}{!loading && !visible.length && <div className="archive-empty"><FileText size={22}/><strong>暂无审计记录</strong></div>}</div></div>;
}

export function SettingsWorkspace({ role, notify }: { role: UserRole; notify: (message: string) => void }) {
  const [config, setConfig] = useState<SystemConfig>({ attachmentLimit:"20", academicYearMonth:"8", semesterBoundary:"按学院校历", notificationDays:"180", backupTime:"23:30" });
  const [editingConfig, setEditingConfig] = useState(false);
  const [research, setResearch] = useState<ResearchItem[]>([{id:"venue",name:"场地申请与审批",requester:"办公室",status:"待调研",detail:"梳理场地借用、时间冲突和审批记录。"}, {id:"expense",name:"经费报销与凭证",requester:"运维部",status:"待调研",detail:"记录预算、票据和报销进度。"}, {id:"duty",name:"值班与排班管理",requester:"主席团",status:"评估中",detail:"按活动安排值班人员和签到。"}, {id:"signup",name:"活动报名与签到",requester:"实践部",status:"评估中",detail:"统一报名名单和现场签到。"}]);
  const [editingResearch, setEditingResearch] = useState<ResearchItem | null>(null);
  useEffect(() => {
    void fetch("/api/config").then((response) => response.ok ? response.json() : null).then((result) => { if (result?.config) setConfig(result.config); }).catch(() => undefined);
    void fetch("/api/research").then((response) => response.ok ? response.json() : null).then((result) => { if (Array.isArray(result?.items)) setResearch(result.items); }).catch(() => undefined);
  }, []);
  const saveConfig = () => { void fetch("/api/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config }) }); setEditingConfig(false); notify("系统配置已保存"); };
  const saveResearch = () => { if (!editingResearch?.name.trim()) return; const next = research.some((item) => item.id === editingResearch.id) ? research.map((item) => item.id === editingResearch.id ? editingResearch : item) : [...research, editingResearch]; setResearch(next); void fetch("/api/research", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item: editingResearch }) }); setEditingResearch(null); notify("调研需求已保存"); };
  if (role === "admin") return <div className="module-page"><div className="module-header"><div><span className="module-kicker">平台运行规则</span><h1>系统配置</h1></div><button className="primary-button" onClick={() => setEditingConfig(true)}><Settings size={17}/>编辑配置</button></div><div className="settings-grid">{[{label:"附件单文件限制",value:`${config.attachmentLimit} MB`},{label:"学年切换月份",value:`${config.academicYearMonth} 月`},{label:"学期分界",value:config.semesterBoundary},{label:"通知保留时间",value:`${config.notificationDays} 天`},{label:"每日备份时间",value:config.backupTime}].map((item) => <section key={item.label}><small>{item.label}</small><strong>{item.value}</strong></section>)}</div>{editingConfig && <div className="modal-backdrop"><div className="member-modal"><header><div><span>系统配置</span><h2>运行规则</h2></div><button className="icon-button" onClick={() => setEditingConfig(false)}><X size={18}/></button></header><div className="form-grid"><label><span>附件限制（MB）</span><input type="number" value={config.attachmentLimit} onChange={(e) => setConfig({...config,attachmentLimit:e.target.value})}/></label><label><span>学年切换月份</span><select value={config.academicYearMonth} onChange={(e) => setConfig({...config,academicYearMonth:e.target.value})}>{Array.from({length:12},(_,i) => <option key={i+1} value={String(i+1)}>{i+1}月</option>)}</select></label><label><span>学期分界</span><input value={config.semesterBoundary} onChange={(e) => setConfig({...config,semesterBoundary:e.target.value})}/></label><label><span>通知保留天数</span><input type="number" value={config.notificationDays} onChange={(e) => setConfig({...config,notificationDays:e.target.value})}/></label><label><span>每日备份时间</span><input type="time" value={config.backupTime} onChange={(e) => setConfig({...config,backupTime:e.target.value})}/></label></div><footer><button className="outline-button" onClick={() => setEditingConfig(false)}>取消</button><button className="primary-button" onClick={saveConfig}>保存</button></footer></div></div>}</div>;
  return <div className="module-page"><div className="module-header"><div><span className="module-kicker">{research.length} 项需求</span><h1>功能调研</h1></div><button className="primary-button" onClick={() => setEditingResearch({id:`research-${Date.now()}`,name:"",requester:"主席团",status:"待调研",detail:""})}><Plus size={18}/>新增需求</button></div><div className="research-list">{research.map((item) => <button key={item.id} onClick={() => setEditingResearch(item)}><span><strong>{item.name}</strong><small>{item.requester}</small></span><p>{item.detail}</p><i>{item.status}</i><ChevronRight size={15}/></button>)}</div>{editingResearch && <div className="modal-backdrop"><div className="member-modal"><header><div><span>功能调研</span><h2>{editingResearch.name || "新增需求"}</h2></div><button className="icon-button" onClick={() => setEditingResearch(null)}><X size={18}/></button></header><div className="form-grid"><label className="span-2"><span>需求名称 *</span><input value={editingResearch.name} onChange={(e) => setEditingResearch({...editingResearch,name:e.target.value})}/></label><label><span>提出部门</span><input value={editingResearch.requester} onChange={(e) => setEditingResearch({...editingResearch,requester:e.target.value})}/></label><label><span>状态</span><select value={editingResearch.status} onChange={(e) => setEditingResearch({...editingResearch,status:e.target.value})}><option>待调研</option><option>调研中</option><option>评估中</option><option>已确认</option><option>暂不实施</option></select></label><label className="span-2"><span>调研记录</span><textarea rows={6} value={editingResearch.detail} onChange={(e) => setEditingResearch({...editingResearch,detail:e.target.value})}/></label></div><footer><button className="outline-button" onClick={() => setEditingResearch(null)}>取消</button><button className="primary-button" disabled={!editingResearch.name.trim()} onClick={saveResearch}>保存</button></footer></div></div>}</div>;
}

export function ProductModule({ view, tasks, activities, archiveItems, role, user, onBack, onOpenTask, onCreate, onCreateActivity, onEditActivity, onUploadArchive, notify, pushNotification }: { view: ViewKey; tasks: Task[]; activities: ActivityRecord[]; archiveItems: ArchiveRecord[]; role: UserRole; user: DemoUser; onBack: () => void; onOpenTask: (task: Task) => void; onCreate: () => void; onCreateActivity: () => void; onEditActivity: (activity: ActivityRecord) => void; onUploadArchive: () => void; notify: (message: string) => void; pushNotification: (draft: NotificationDraft) => void }) {
  if (view === "activities") return <MediaActivities onBack={onBack} tasks={tasks} onOpenTask={onOpenTask} role={role} user={user} activities={activities} onCreateActivity={onCreateActivity} onEditActivity={onEditActivity} notify={notify} />;

  if (view === "tasks") return <div className="module-page"><div className="module-header"><div><span className="module-kicker">跨活动任务视图</span><h1>任务中心</h1></div>{role === "chair" && <button className="primary-button" onClick={onCreate}><Plus size={18} />新建任务</button>}</div><div className="stat-strip"><div><span>全部任务</span><strong>{tasks.length}</strong></div><div><span>进行中</span><strong>{tasks.filter(t => t.status === "进行中").length}</strong></div><div><span>待验收</span><strong>{tasks.filter(t => t.status === "待验收").length}</strong></div><div><span>已完成</span><strong>{tasks.filter(t => t.status === "已完成").length}</strong></div></div><div className="product-table"><div className="product-table-head"><span>任务</span><span>所属活动</span><span>负责部门 / 人员</span><span>截止时间</span><span>状态</span></div>{tasks.map(task => <button key={task.id} onClick={() => onOpenTask(task)}><span><i className={`type-dot type-${task.kind}`} /><b>{task.title}</b><small>{task.kind}</small></span><span>{task.activityName || currentActivity.name}</span><span><b>{task.department}</b><small>{task.person}</small></span><span>{task.deadline}</span><i className={`status status-${task.status}`}>{task.status}</i></button>)}</div></div>;

  if (view === "organization") return <OrganizationManager notify={notify} canManage={role === "chair" || role === "admin"} />;

  if (view === "accounts") return <AccountsWorkspace notify={notify} pushNotification={pushNotification}/>;

  if (view === "audit") return <AuditWorkspace notify={notify}/>;

  if (view === "archive") return <ArchiveWorkspace role={role} records={archiveItems} onUpload={onUploadArchive}/>;

  return <SettingsWorkspace role={role} notify={notify}/>;
}

export function QuickFlowModal({ kind, activities, initialData, onClose, onSubmit }: { kind: QuickFlowKind; activities: ActivityRecord[]; initialData?: Record<string,string>; onClose: () => void; onSubmit: (data: Record<string,string>) => void }) {
  const [form, setForm] = useState<Record<string,string>>({ name: "", department: "运维部", time: "2026-10-12T14:00", location: "", teacher: "", state: "策划中", activityCategory: "综合活动", departments: "运维部", title: "", detail: "", deadline: "2026-09-20T20:00", category: "活动方案", activity: currentActivity.name, academicYear: "2026-2027学年", semester: "上学期", fileName: "", requester: "主席团", problem: "", opinion: "", conclusion: "同意推进", ...initialData });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const meta = quickFlowTitles[kind];
  const update = (key: string, value: string) => setForm({...form, [key]: value});
  const canSubmit = kind === "archive" ? Boolean(selectedFile) : kind === "guidance" ? Boolean(form.opinion.trim()) : kind === "timeline" ? true : Boolean((form.name || form.title).trim());
  const submitFlow = async () => {
    if (kind !== "archive" || !selectedFile) return onSubmit(form);
    setSubmitting(true); setError("");
    try {
      const payload = new FormData(); payload.append("file", selectedFile);
      const response = await fetch("/api/files", { method: "POST", body: payload });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "资料上传失败");
      onSubmit({ ...form, key: result.attachment.key, size: String(result.attachment.size), mimeType: result.attachment.type || "" });
    } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : "资料上传失败"); setSubmitting(false); }
  };
  return <div className="modal-backdrop"><div className="quick-flow-modal"><header><div><span>{meta.kicker}</span><h2>{meta.title}</h2></div><button className="icon-button" onClick={onClose}><X size={18}/></button></header><div className="quick-flow-body">
    {kind === "activity" && <div className="form-grid"><label className="span-2"><span>活动名称 *</span><input value={form.name} onChange={(event) => update("name",event.target.value)}/></label><label><span>活动分类</span><input value={form.activityCategory} onChange={(event) => update("activityCategory",event.target.value)}/></label><label><span>活动状态</span><select value={form.state} onChange={(event) => update("state",event.target.value)}><option>策划中</option><option>待启动</option><option>筹备中</option><option>已结束</option></select></label><label><span>主办部门</span><select value={form.department} onChange={(event) => update("department",event.target.value)}><option>运维部</option><option>PC部</option><option>科创中心</option><option>文艺部</option><option>新媒体中心</option><option>职规部</option></select></label><label><span>活动时间</span><input type="datetime-local" value={form.time} onChange={(event) => update("time",event.target.value)}/></label><label><span>活动地点</span><input value={form.location} onChange={(event) => update("location",event.target.value)}/></label><label><span>指导教师</span><input value={form.teacher} onChange={(event) => update("teacher",event.target.value)}/></label><label className="span-2"><span>参与部门</span><input value={form.departments} onChange={(event) => update("departments",event.target.value)} placeholder="多个部门用顿号或逗号分隔"/></label><label className="span-2"><span>活动简介</span><textarea rows={3} value={form.detail} onChange={(event) => update("detail",event.target.value)}/></label></div>}
    {kind === "archive" && <div className="form-grid"><label><span>归属学年</span><select value={form.academicYear} onChange={(event) => update("academicYear",event.target.value)}><option>2026-2027学年</option><option>2025-2026学年</option><option>2024-2025学年</option></select></label><label><span>归属学期</span><select value={form.semester} onChange={(event) => update("semester",event.target.value)}><option>上学期</option><option>下学期</option></select></label><label><span>资料分类</span><select value={form.category} onChange={(event) => update("category",event.target.value)}><option>活动方案</option><option>设备资料</option><option>采购凭证</option><option>宣传素材</option><option>现场素材</option><option>复盘记录</option></select></label><label><span>关联活动</span><select value={form.activity} onChange={(event) => update("activity",event.target.value)}>{activities.map((item) => <option key={item.id}>{item.name}</option>)}</select></label><label className="span-2 file-drop"><Paperclip size={20}/><span>{form.fileName || "选择需要归档的文件"}</span><input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip" onChange={(event) => { const file = event.target.files?.[0] || null; setSelectedFile(file); update("fileName",file?.name || ""); }}/></label>{error && <div className="span-2 form-error">{error}</div>}<label className="span-2"><span>资料说明</span><textarea rows={3} value={form.detail} onChange={(event) => update("detail",event.target.value)}/></label></div>}
    {kind === "guidance" && <div className="form-grid"><div className="span-2 review-context"><FileText size={18}/><span><strong>十佳歌手比赛执行方案 V3</strong><small>主席徐介翰提交 · 当前处于待指导</small></span></div><label className="span-2"><span>指导意见 *</span><textarea rows={6} value={form.opinion} onChange={(event) => update("opinion",event.target.value)} placeholder="填写修改建议、风险提醒或同意意见"/></label><label><span>审核结论</span><select value={form.conclusion} onChange={(event) => update("conclusion",event.target.value)}><option>同意推进</option><option>修改后再提交</option><option>需要线下沟通</option></select></label></div>}
    {kind === "eventSettings" && <div className="form-grid"><label className="span-2"><span>活动名称 *</span><input value={form.name} onChange={(event) => update("name",event.target.value)}/></label><label><span>活动分类</span><input value={form.activityCategory} onChange={(event) => update("activityCategory",event.target.value)}/></label><label><span>活动状态</span><select value={form.state} onChange={(event) => update("state",event.target.value)}><option>策划中</option><option>待启动</option><option>筹备中</option><option>已结束</option></select></label><label><span>主办部门</span><input value={form.department} onChange={(event) => update("department",event.target.value)}/></label><label><span>活动时间</span><input type="datetime-local" value={form.time} onChange={(event) => update("time",event.target.value)}/></label><label><span>活动地点</span><input value={form.location} onChange={(event) => update("location",event.target.value)}/></label><label><span>指导教师</span><input value={form.teacher} onChange={(event) => update("teacher",event.target.value)}/></label><label className="span-2"><span>参与部门</span><input value={form.departments} onChange={(event) => update("departments",event.target.value)}/></label><label className="span-2"><span>活动简介</span><textarea rows={3} value={form.detail} onChange={(event) => update("detail",event.target.value)}/></label></div>}
    {kind === "timeline" && <div className="workflow-timeline"><article className="done"><i><Check size={13}/></i><span><strong>9月19日 · 预热推文发布</strong><small>新媒体中心 · 已完成</small></span></article><article className="active"><i>20</i><span><strong>横幅定稿与下单</strong><small>运维部 · 进行中</small></span></article><article><i>23</i><span><strong>舞台联排</strong><small>19:00 · 学生活动中心报告厅</small></span></article><article><i>25</i><span><strong>正式比赛</strong><small>18:30 · 学生活动中心</small></span></article></div>}
  </div><footer><button className="outline-button" onClick={onClose}>取消</button><button className="primary-button" disabled={!canSubmit || submitting} onClick={() => kind === "timeline" ? onClose() : submitFlow()}>{submitting ? "上传中" : meta.submit}</button></footer></div></div>;
}
