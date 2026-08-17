"use client";

import {
  Activity,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  FileText,
  LayoutDashboard,
  ListTodo,
  LogOut,
  MoreHorizontal,
  PackageCheck,
  Paperclip,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  MapPin,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { aggregateMainTaskStatus, type TaskStatus } from "./workflow/state-machine";
import {
  activityCatalog, archiveRecords, currentActivity, deleteAttachmentObject,
  dynamicSchemas as initialDynamicSchemas, emptyDraft, fallbackAssignees, filters, getControlMode, initialSubtasks,
  initialTasks, isSubtaskOf, roleProfiles, seededAccounts,
  seedNotificationRecords, taskTypes as initialTaskTypes, viewTitles,
  type AcademicSemester, type ActivityRecord, type ArchiveRecord, type Attachment, type ControlMode,
  type DelegatedTask, type DemoUser, type ManagedAccount,
  type NotificationDraft, type NotificationItem, type NotificationRecord,
  type OrgSnapshot, type QuickFlowKind, type Task, type TaskDraft, type UserRole, type ViewKey,
  type WorkflowActionPayload,
} from "./product-model";

import { ChairOverview, ConfirmActionModal, LoginScreen, ProductModule, QuickFlowModal, RoleDashboard, TextEntryModal } from "./views";

const TASK_TYPE_ICONS: Record<string, React.ComponentType<{ size?: number | string }>> = {
  "package-check": PackageCheck,
  "settings": Settings,
  "users": Users,
  "file-text": FileText,
  "activity": Activity,
};

export default function Home() {
  const [tasks, setTasks] = useState(initialTasks);
  const [activities, setActivities] = useState<ActivityRecord[]>(activityCatalog);
  const [archiveItems, setArchiveItems] = useState<ArchiveRecord[]>(archiveRecords);
  const [subtasks, setSubtasks] = useState<DelegatedTask[]>(initialSubtasks);
  const [organizationDirectory, setOrganizationDirectory] = useState<OrgSnapshot | null>(null);
  const [session, setSession] = useState<DemoUser | null>(null);
  const [loginMode, setLoginMode] = useState<"demo" | "password">("demo");
  const [taskTypes, setTaskTypes] = useState(initialTaskTypes);
  const [dynamicSchemas, setDynamicSchemas] = useState<Record<string, { key: string; label: string; placeholder: string; type?: string }[]>>(initialDynamicSchemas);
  const [userRole, setUserRole] = useState<UserRole>("chair");
  const [showNotifications, setShowNotifications] = useState(false);
  const [readNotifications, setReadNotifications] = useState<string[]>([]);
  const [notificationRecords, setNotificationRecords] = useState<NotificationRecord[]>(seedNotificationRecords);
  const [uploading, setUploading] = useState(false);
  const [activeView, setActiveView] = useState<ViewKey>("overview");
  const [eventWorkspaceOpen, setEventWorkspaceOpen] = useState(false);
  const [filter, setFilter] = useState("全部任务");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Task | null>(null);
  const [showTaskActions, setShowTaskActions] = useState(false);
  const [notice, setNotice] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newStep, setNewStep] = useState(1);
  const [draft, setDraft] = useState<TaskDraft>(emptyDraft);
  const [storageReady, setStorageReady] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authMethod, setAuthMethod] = useState<"local" | "identity" | "session">("local");
  const [authError, setAuthError] = useState("");
  const [accountDirectory, setAccountDirectory] = useState<ManagedAccount[]>(seededAccounts);
  const [quickFlow, setQuickFlow] = useState<QuickFlowKind | null>(null);
  const [editingActivity, setEditingActivity] = useState<ActivityRecord | null>(null);
  const [mainRejectionTarget, setMainRejectionTarget] = useState<Task | null>(null);
  const [pendingTaskAction, setPendingTaskAction] = useState<{ task: Task; status: TaskStatus; title: string; description: string; confirmText: string } | null>(null);

  useEffect(() => {
    async function bootstrap() {
      try {
        const sessionResponse = await fetch("/api/session");
        if (sessionResponse.status === 401 || sessionResponse.status === 403) {
          // 自托管：未认证，进入密码登录。
          setLoginMode("password");
          return;
        }
        const [stateResponse, accountsResponse] = await Promise.all([fetch("/api/state"), fetch("/api/accounts")]);
        const sessionResult = await sessionResponse.json();
        const stateResult = stateResponse.ok ? await stateResponse.json() : { state: {} };
        const accountsResult = accountsResponse.ok ? await accountsResponse.json() : { accounts: [] };
        if (!sessionResponse.ok) throw new Error(sessionResult.error || "当前账号无法进入系统");
        setLoginMode("demo");
        setAuthMethod(sessionResult.authMethod || "local");
        if (sessionResult.user) {
          setSession(sessionResult.user as DemoUser);
          setUserRole(sessionResult.user.role as UserRole);
        } else {
          const savedSession = window.localStorage.getItem("union-demo-session-v1");
          if (savedSession) try { const restored = JSON.parse(savedSession) as DemoUser; setSession(restored); setUserRole(restored.role); } catch { window.localStorage.removeItem("union-demo-session-v1"); }
        }
        const shared = stateResult.state || {};
        if (Array.isArray(shared.tasks)) setTasks(shared.tasks);
        if (Array.isArray(shared.subtasks)) setSubtasks(shared.subtasks);
        if (Array.isArray(shared.activities)) setActivities(shared.activities);
        if (Array.isArray(shared.archive)) setArchiveItems(shared.archive);
        if (Array.isArray(shared.notifications)) setNotificationRecords(shared.notifications);
        if (Array.isArray(accountsResult.accounts) && accountsResult.accounts.length) setAccountDirectory(accountsResult.accounts);
        setStorageReady(true);
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : "系统初始化失败");
      } finally { setAuthReady(true); }
    }
    void bootstrap();
  }, []);

  useEffect(() => {
    fetch("/api/organization").then((response) => response.ok ? response.json() : null).then((result) => { if (result) setOrganizationDirectory(result); }).catch(() => undefined);
  }, []);

  useEffect(() => {
    // 任务类型与动态字段模板来自服务端 task_type_schemas，硬编码为兜底。
    fetch("/api/task-types").then((response) => (response.ok ? response.json() : null)).then((result) => {
      if (!Array.isArray(result?.types) || !result.types.length) return;
      setTaskTypes(result.types.map((type: { name: string; note: string; icon: string }) => ({ name: type.name, note: type.note, icon: TASK_TYPE_ICONS[type.icon] || FileText })));
      const schemas: Record<string, { key: string; label: string; placeholder: string; type?: string }[]> = {};
      for (const type of result.types) {
        if (Array.isArray(type.fields)) schemas[type.name] = type.fields;
      }
      setDynamicSchemas(schemas);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const updateAccounts = (event: Event) => setAccountDirectory((event as CustomEvent<ManagedAccount[]>).detail);
    window.addEventListener("accounts-updated", updateAccounts);
    return () => window.removeEventListener("accounts-updated", updateAccounts);
  }, []);

  useEffect(() => {
    // 通知已读状态已迁移到服务端回执表（notification_receipts）。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!storageReady || !session) return setReadNotifications([]);
    const username = encodeURIComponent(session.username);
    void fetch(`/api/notifications/read?username=${username}`).then((response) => (response.ok ? response.json() : null)).then((result) => {
      if (Array.isArray(result?.ids)) setReadNotifications(result.ids);
    }).catch(() => undefined);
  }, [session?.username, storageReady]);

  useEffect(() => {
    if (storageReady && showNew) window.localStorage.setItem("union-task-draft-v1", JSON.stringify(draft));
  }, [draft, showNew, storageReady]);

  useEffect(() => {
    if (!storageReady || !["chair", "leader", "staff"].includes(userRole)) return;
    // 父子状态聚合：任一子任务进入执行，主任务自动转入进行中。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTasks((current) => {
      let changed = false;
      const next = current.map((task) => {
        if (task.status === "已完成" || task.status === "待验收") return task;
        const children = subtasks.filter((child) => isSubtaskOf(child, task));
        const aggregated = aggregateMainTaskStatus(task.status, children.map((child) => child.status));
        if (aggregated !== task.status) {
          changed = true;
          return { ...task, status: aggregated, lastAction: "子任务已开始，主任务自动进入进行中" };
        }
        return task;
      });
      return changed ? next : current;
    });
  }, [subtasks, storageReady, userRole]);

  useEffect(() => {
    if (!selected) return;
    const current = tasks.find((task) => task.id === selected.id);
    // Synchronize the read-only drawer with the latest shared task record.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (current && current !== selected) setSelected(current);
  }, [tasks]);

  // A newly opened task always starts in read-only mode.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setShowTaskActions(false); }, [selected?.id]);

  const visible = useMemo(
    () =>
      tasks.filter(
        (task) =>
          (filter === "全部任务" || task.status === filter) &&
          (task.title.includes(query) || task.department.includes(query) || task.person.includes(query)),
      ),
    [tasks, filter, query],
  );

  const draftAssignees = useMemo(() => {
    if (!organizationDirectory) return fallbackAssignees[draft.department] || [];
    const department = organizationDirectory.departments.find((item) => item.name === draft.department);
    if (!department) return fallbackAssignees[draft.department] || [];
    return organizationDirectory.members
      .filter((member) => member.departmentId === department.id)
      .sort((a, b) => (a.roleLevel === "leader" ? 0 : 1) - (b.roleLevel === "leader" ? 0 : 1));
  }, [organizationDirectory, draft.department]);

  function selectDraftActivity(value: string) {
    if (value === "standalone") {
      setDraft((current) => ({ ...current, activityName: "非活动临时事项", activityTime: "不适用", activityLocation: "不适用", liaisonTeacher: "" }));
      return;
    }
    const activity = activities.find((item) => item.id === value);
    if (!activity) {
      setDraft((current) => ({ ...current, activityName: "", activityTime: "", activityLocation: "", liaisonTeacher: "" }));
      return;
    }
    setDraft((current) => ({ ...current, activityName: activity.name, activityTime: `${activity.date} ${activity.time}`, activityLocation: activity.location, liaisonTeacher: activity.teacher }));
  }

  const progress = Math.round((tasks.filter((task) => task.status === "已完成").length / tasks.length) * 100);
  const selectedOpenSubtasks = selected ? subtasks.filter((item) => isSubtaskOf(item, selected) && item.status !== "已完成") : [];

  function managedAccounts() {
    return accountDirectory;
  }

  function resolveUsernames(options: { names?: string[]; roles?: UserRole[]; department?: string }) {
    const names = options.names || [];
    const roles = options.roles || [];
    return managedAccounts().filter((account) => account.active && (
      names.includes(account.name) ||
      (roles.includes(account.role) && (!options.department || account.department === options.department))
    )).map((account) => account.username);
  }

  async function runWorkflowAction(payload: WorkflowActionPayload) {
    try {
      const response = await fetch("/api/workflow/transition", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return { ok: false, error: result.error || "操作失败" };
      if (Array.isArray(result.subtasks)) setSubtasks(result.subtasks);
      if (Array.isArray(result.tasks)) setTasks(result.tasks);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "网络异常" };
    }
  }

  async function pushNotification(draft: NotificationDraft) {
    const recipients = Array.from(new Set(draft.recipientUsernames)).filter((username) => username && username !== session?.username);
    if (!recipients.length) return;
    const response = await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, recipientUsernames: recipients }) });
    const result = await response.json().catch(() => ({}));
    if (response.ok && result.record) {
      const record = result.record as NotificationRecord;
      setNotificationRecords((current) => [record, ...current.filter((item) => !(
        draft.entity?.type !== "system" && item.entity?.type === draft.entity?.type && item.entity?.id === draft.entity?.id && item.recipientUsernames.some((username) => recipients.includes(username))
      ))].slice(0, 300));
    }
  }

  function relativeNotificationTime(createdAt: string) {
    return new Date(createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
  }

  const notifications = useMemo(() => {
    const dynamic = notificationRecords.filter((item) => session && item.recipientUsernames.includes(session.username)).map((item) => ({ ...item, time: relativeNotificationTime(item.createdAt) }));
    return dynamic;
  }, [userRole, session?.username, notificationRecords]);
  const unreadNotificationCount = notifications.filter((item) => !readNotifications.includes(item.id)).length;

  async function updateStatus(task: Task, status: TaskStatus) {
    const action = status === "已完成"
      ? (task.status === "待验收" ? "approve" : "completeDirect")
      : (task.status === "已完成" ? "reopen" : "start");
    const res = await runWorkflowAction({ kind: "task", id: task.id, action });
    setNotice(res.ok ? `“${task.title}”已更新为${status}` : (res.error || "操作失败"));
    window.setTimeout(() => setNotice(""), 2400);
  }

  function requestTaskStatus(task: Task, status: TaskStatus) {
    if (status === "已完成") return setPendingTaskAction({ task, status, title: "直接办结任务", description: `“${task.title}”将直接标记为已完成并留下操作记录。适用于无需继续拆分或补充凭据的小事项。`, confirmText: "确认办结" });
    if (task.status === "已完成" && status === "进行中") return setPendingTaskAction({ task, status, title: "重新打开任务", description: `“${task.title}”将恢复为进行中，可继续补充材料和安排执行。`, confirmText: "确认重新打开" });
    updateStatus(task, status);
  }

  function login(username: string, password: string) {
    const source = seededAccounts.find((user) => user.username === username && user.password === password && user.active);
    if (!source) return "账号或密码不正确，或账号已停用";
    const account: DemoUser = { username: source.username, name: source.name, role: source.role, title: source.title, department: source.department };
    setSession(account); setUserRole(account.role); setActiveView("overview"); setEventWorkspaceOpen(false); setShowNotifications(false); setReadNotifications([]);
    window.localStorage.setItem("union-demo-session-v1", JSON.stringify(account));
    return null;
  }

  async function passwordLogin(email: string, password: string) {
    try {
      const response = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return result.error || "登录失败";
      window.location.reload();
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "登录失败";
    }
  }

  function logout() {
    if (authMethod === "identity") { window.location.href = "/signout-with-chatgpt?return_to=/"; return; }
    if (authMethod === "session") {
      void fetch("/api/logout", { method: "POST" }).finally(() => window.location.reload());
      return;
    }
    window.localStorage.removeItem("union-demo-session-v1");
    setSession(null); setSelected(null); setQuickFlow(null); setEventWorkspaceOpen(false); setShowNotifications(false); setReadNotifications([]);
  }

  function resetDemo() {
    ["union-product-tasks-v1","union-leader-subtasks-v2","union-activities-v1","union-archive-v1","union-accounts-v1","union-system-config-v1","union-research-v1","union-workflow-records-v1","union-task-draft-v1","union-demo-session-v1","union-notifications-v1"].forEach((key) => window.localStorage.removeItem(key));
    setTasks(initialTasks); setSubtasks(initialSubtasks); setActivities(activityCatalog); setArchiveItems(archiveRecords); setNotificationRecords(seedNotificationRecords); setReadNotifications([]); setSession(null); setUserRole("chair"); setActiveView("overview"); setEventWorkspaceOpen(false); setSelected(null);
  }

  async function startMainAsLeader(task: Task) {
    const res = await runWorkflowAction({ kind: "task", id: task.id, action: "start" });
    setNotice(res.ok ? `“${task.title}”已开始执行` : (res.error || "操作失败"));
    window.setTimeout(() => setNotice(""), 2400);
  }

  async function submitMainForChair(task: Task) {
    const res = await runWorkflowAction({ kind: "task", id: task.id, action: "submit" });
    setNotice(res.ok ? `“${task.title}”已提交主席审核` : (res.error || "操作失败"));
    window.setTimeout(() => setNotice(""), 2400);
  }

  async function withdrawMainForLeader(task: Task) {
    const res = await runWorkflowAction({ kind: "task", id: task.id, action: "withdraw" });
    setNotice(res.ok ? `“${task.title}”已撤回，可继续修改` : (res.error || "操作失败"));
    window.setTimeout(() => setNotice(""), 2400);
  }

  function rejectMainTask(task: Task) {
    setMainRejectionTarget(task);
  }

  async function confirmRejectMainTask(task: Task, reason: string) {
    const res = await runWorkflowAction({ kind: "task", id: task.id, action: "reject", reason });
    setMainRejectionTarget(null);
    setNotice(res.ok ? `“${task.title}”已退回负责人修改` : (res.error || "操作失败"));
    window.setTimeout(() => setNotice(""), 2400);
  }

  function openNewTask() {
    const saved = window.localStorage.getItem("union-task-draft-v1");
    if (saved) {
      try { const restored = JSON.parse(saved); setDraft({ ...emptyDraft, ...restored, activityName: "", activityTime: "", activityLocation: "", liaisonTeacher: "", dynamic: restored.dynamic || {}, attachments: restored.attachments || [] }); } catch { setDraft({ ...emptyDraft, dynamic: {}, attachments: [] }); }
    } else {
      setDraft({ ...emptyDraft, dynamic: {} });
    }
    setNewStep(1);
    setShowNew(true);
  }

  function saveDraft() {
    window.localStorage.setItem("union-task-draft-v1", JSON.stringify(draft));
    setShowNew(false);
    setNotice("任务草稿已保存，下次创建时可继续填写");
    window.setTimeout(() => setNotice(""), 2400);
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    const uploaded: Attachment[] = []; const errors: string[] = [];
    for (const file of Array.from(files)) {
      const form = new FormData(); form.append("file", file);
      const response = await fetch("/api/files", { method: "POST", body: form });
      const result = await response.json();
      if (response.ok) uploaded.push(result.attachment);
      else errors.push(`${file.name}：${result.error || "上传失败"}`);
    }
    setDraft((current) => ({ ...current, attachments: [...(current.attachments || []), ...uploaded] }));
    setUploading(false);
    setNotice(errors.length ? errors[0] : `已上传${uploaded.length}个附件`);
    window.setTimeout(() => setNotice(""), 2400);
  }

  async function uploadSelectedFiles(files: FileList | null) {
    if (!files?.length || !selected) return;
    setUploading(true);
    let uploadedCount = 0; const errors: string[] = [];
    for (const file of Array.from(files)) {
      const form = new FormData(); form.append("file", file);
      const uploadResponse = await fetch("/api/files", { method: "POST", body: form });
      const uploadResult = await uploadResponse.json();
      if (!uploadResponse.ok) { errors.push(`${file.name}：${uploadResult.error || "上传失败"}`); continue; }
      const action = await runWorkflowAction({ kind: "task", id: selected.id, action: "addAttachment", attachment: uploadResult.attachment });
      if (action.ok) uploadedCount++; else errors.push(`${file.name}：${action.error || "附件记录失败"}`);
    }
    setUploading(false);
    setNotice(errors.length ? errors[0] : `已向任务添加${uploadedCount}个附件`);
    window.setTimeout(() => setNotice(""), 2400);
  }

  async function removeDraftAttachment(file: Attachment) {
    try {
      await deleteAttachmentObject(file);
      setDraft((current) => ({ ...current, attachments: current.attachments.filter((item) => item.key !== file.key) }));
      setNotice(`已删除“${file.name}”`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "附件删除失败"); }
    window.setTimeout(() => setNotice(""), 2400);
  }

  async function removeSelectedAttachment(file: Attachment) {
    if (!selected) return;
    try {
      await deleteAttachmentObject(file);
      const action = await runWorkflowAction({ kind: "task", id: selected.id, action: "removeAttachment", key: file.key });
      if (action.ok) setNotice(`已删除“${file.name}”`); else setNotice(action.error || "附件删除失败");
    } catch (error) { setNotice(error instanceof Error ? error.message : "附件删除失败"); }
    window.setTimeout(() => setNotice(""), 2400);
  }

  function closeNewTask() {
    if (draft.title.trim() || draft.description.trim() || draft.attachments.length) {
      window.localStorage.setItem("union-task-draft-v1", JSON.stringify(draft));
      setNotice("任务草稿已自动保存");
      window.setTimeout(() => setNotice(""), 2400);
    }
    setShowNew(false);
    setNewStep(1);
  }

  async function addTask() {
    const schema = dynamicSchemas[draft.kind] || [];
    const dynamicFields = schema
      .filter((field) => draft.dynamic[field.key])
      .map((field) => ({
        label: field.label.replace("（元）", ""),
        value: field.key === "budget" ? `¥${draft.dynamic[field.key]}` : draft.dynamic[field.key],
      }));
    const task: Task = {
      id: Date.now(),
      title: draft.title,
      department: draft.department,
      person: draft.person || "待指派",
      deadline: draft.deadline ? draft.deadline.slice(5).replace("-", "月").replace("T", "日 ") : "未设置",
      status: "待开始",
      kind: draft.kind,
      description: draft.description || "暂无补充说明。",
      activityName: draft.activityName,
      activityTime: draft.activityTime,
      activityLocation: draft.activityLocation,
      liaisonTeacher: draft.liaisonTeacher,
      attachments: draft.attachments,
      controlMode: draft.controlMode,
      fields: [
        ...dynamicFields,
        { label: "优先级", value: draft.priority },
        { label: "管理方式", value: draft.controlMode === "快捷办结" ? "执行人或上级可直接完成" : draft.controlMode === "凭据留痕" ? "提交结果即完成，保留凭据" : `${draft.reviewer}确认后完成` },
      ],
    };
    const res = await runWorkflowAction({ kind: "task", action: "create", task });
    if (res.ok) {
      window.localStorage.removeItem("union-task-draft-v1");
      setSelected(task);
      setShowNew(false);
      setNotice(`“${task.title}”已创建，并通知${task.department}`);
    } else {
      setNotice(res.error || "创建失败");
    }
    window.setTimeout(() => setNotice(""), 2400);
  }

  function handleNotify(message: string) {
    if (message.includes("准备新任务")) {
      const activity = activities.find((item) => message.includes(item.name));
      if (activity) {
        setDraft({ ...emptyDraft, activityName: activity.name, activityTime: `${activity.date} ${activity.time}`, activityLocation: activity.location, liaisonTeacher: activity.teacher, dynamic: {}, attachments: [] });
        setNewStep(1);
        return setShowNew(true);
      }
    }
    if (message.includes("新媒体任务模板")) {
      setDraft({ ...emptyDraft, kind: "新媒体制作", dynamic: {}, attachments: [] });
      setNewStep(1);
      return setShowNew(true);
    }
    if (message.includes("活动立项流程")) return setQuickFlow("activity");
    if (message.includes("上传入口")) return setQuickFlow("archive");
    if (message.includes("新的调研需求") || message.includes("调研卡片")) return setActiveView("settings");
    if (message.includes("方案审核")) return setQuickFlow("guidance");
    if (message.includes("活动空间")) return setActiveView("activities");
    if (message.includes("账号与权限") || message.includes("待分配角色") || message.includes("权限信息")) return setActiveView("accounts");
    if (message.includes("权限变更记录") || message.includes("运行日志")) return setActiveView("audit");
    if (message.includes("指导活动")) return setActiveView("activities");
    if (message.includes("对应任务") || message.includes("风险事项详情")) {
      const target = tasks.find((task) => task.risk) || tasks[0];
      if (target) return setSelected(target);
    }
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2400);
  }

  function openNotification(item: NotificationItem) {
    setReadNotifications((current) => current.includes(item.id) ? current : [...current, item.id]);
    if (session) {
      void fetch("/api/notifications/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: session.username, ids: [item.id] }) }).catch(() => undefined);
    }
    setShowNotifications(false);
    if (item.entity?.type === "task" && item.entity.id !== undefined) {
      const task = tasks.find((candidate) => candidate.id === Number(item.entity?.id));
      if (task) return setSelected(task);
    }
    if (item.entity?.type === "subtask" && item.entity.parentTaskId !== undefined) {
      const parent = tasks.find((candidate) => candidate.id === item.entity?.parentTaskId);
      if (parent) return setSelected(parent);
    }
    if (item.entity?.type === "activity") return setActiveView("activities");
    if (item.entity?.type === "account") {
      if (userRole === "admin") return setActiveView("accounts");
      setNotice(item.detail); window.setTimeout(() => setNotice(""), 2400); return;
    }
    if (item.entity?.type === "archive") return setActiveView("archive");
    const text = `${item.title}${item.detail}`;
    const keyword = ["横幅", "音响", "灯光", "摄影", "视频", "清理"].find((candidate) => text.includes(candidate));
    const target = tasks.find((task) => text.includes(task.title)) || (keyword ? tasks.find((task) => task.title.includes(keyword)) : undefined);
    if (target) {
      setSelected(target);
      return;
    }
    setNotice(`已查看：${item.title}`);
    window.setTimeout(() => setNotice(""), 2400);
  }

  async function submitQuickFlow(data: Record<string,string>) {
    void fetch("/api/workflow-records", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ record: { ...data, kind: quickFlow || "", createdAt: new Date().toISOString() } }) }).catch(() => undefined);
    if (quickFlow === "activity" || quickFlow === "eventSettings") {
      const [datePart = "2026-10-12", timePart = "14:00"] = data.time.split("T");
      const [year, month, day] = datePart.split("-");
      const departments = Array.from(new Set([data.department, ...data.departments.split(/[、,，]/).map((item) => item.trim()).filter(Boolean)]));
      const next: ActivityRecord = {
        id: editingActivity?.id || `activity-${Date.now()}`, name: data.name, category: data.activityCategory || "综合活动", state: data.state as ActivityRecord["state"],
        date: `${year}年${Number(month)}月${Number(day)}日`, day: day.padStart(2,"0"), month: `${Number(month)}月`, time: timePart || "待定", location: data.location || "待定",
        organizer: data.department, teacher: data.teacher || "未指定", progress: editingActivity?.progress || 0, pending: editingActivity?.pending || 0, departments,
        description: data.detail || "", nextMilestone: editingActivity?.nextMilestone || "待安排", milestones: editingActivity?.milestones || [],
      };
      setActivities((current) => editingActivity ? current.map((item) => item.id === editingActivity.id ? next : item) : [next, ...current]);
      void fetch("/api/activities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activity: next }) }).catch(() => undefined);
      const participantLeaders = departments.flatMap((department) => resolveUsernames({ roles: ["leader"], department }));
      const teacherAccounts = next.teacher === "未指定" ? [] : resolveUsernames({ names: [next.teacher] });
      pushNotification({ recipientUsernames: Array.from(new Set([...participantLeaders, ...teacherAccounts])), title: editingActivity ? "活动信息已更新" : "新增活动安排", detail: `${next.name}：${next.date} ${next.time}，地点${next.location}。`, level: editingActivity ? "info" : "warning", entity: { type: "activity", id: next.id } });
      setEditingActivity(null);
    }
    if (quickFlow === "archive") {
      const bytes = Number(data.size || 0);
      const size = bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1,Math.round(bytes / 1024))} KB`;
      const record: ArchiveRecord = { id:`archive-${Date.now()}`, academicYear:data.academicYear, semester:data.semester as AcademicSemester, activity:data.activity, category:data.category, name:data.fileName, owner:session?.department || "主席团", time:new Date().toLocaleString("zh-CN",{hour12:false}), size, key:data.key, description:data.detail };
      setArchiveItems((current) => [record, ...current]);
      void fetch("/api/archive", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ record }) }).catch(() => undefined);
      pushNotification({ recipientUsernames: resolveUsernames({ roles: ["chair"] }), title: "活动资料已归档", detail: `${session?.name || "成员"}已归档“${data.fileName}”，关联活动为${data.activity}。`, level: "info", entity: { type: "archive", id: data.key } });
    }
    if (quickFlow === "guidance") pushNotification({ recipientUsernames: resolveUsernames({ roles: ["chair"] }), title: "指导教师已反馈", detail: `${data.conclusion}：${data.opinion}`, level: data.conclusion === "同意推进" ? "success" : "warning", entity: { type: "activity", id: "top-singer" } });
    const messages: Partial<Record<QuickFlowKind,string>> = { activity: "活动已创建", eventSettings: "活动信息已更新", archive: "资料已归档", guidance: "指导意见已发送给主席" };
    setQuickFlow(null);
    setNotice(messages[quickFlow || "activity"] || "已保存");
    window.setTimeout(() => setNotice(""), 2400);
  }

  function editActivity(activity: ActivityRecord) {
    setEditingActivity(activity);
    setQuickFlow("eventSettings");
  }

  const editingDate = editingActivity?.date.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  const editingClock = editingActivity?.time.match(/\d{2}:\d{2}/)?.[0] || "09:00";
  const quickActivityData = editingActivity ? { name: editingActivity.name, activityCategory: editingActivity.category, state: editingActivity.state, department: editingActivity.organizer, time: editingDate ? `${editingDate[1]}-${editingDate[2].padStart(2,"0")}-${editingDate[3].padStart(2,"0")}T${editingClock}` : "2026-10-12T09:00", location: editingActivity.location, teacher: editingActivity.teacher, departments: editingActivity.departments.join("、"), detail: editingActivity.description } : undefined;

  if (!authReady) return <main className="login-page"><section className="login-panel"><div className="access-state"><strong>正在连接系统</strong></div></section></main>;
  if (authError) return <main className="login-page"><section className="login-panel"><div className="access-state"><CircleAlert size={24}/><h2>无法进入系统</h2><p>{authError}</p><button className="primary-button" onClick={() => window.location.reload()}>重新加载</button></div></section></main>;
  if (!session) return <LoginScreen mode={loginMode} onLogin={login} onPasswordLogin={passwordLogin} onReset={resetDemo}/>;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">CS</div>
          <div><strong>学生联盟管理系统</strong><span>计算学院</span></div>
        </div>
        <nav aria-label="主导航">
          <button className={`nav-item ${activeView === "overview" && !eventWorkspaceOpen ? "active" : ""}`} title="工作台总览" onClick={() => { setActiveView("overview"); setEventWorkspaceOpen(false); }}><LayoutDashboard size={18} />{userRole === "admin" ? "系统总览" : userRole === "chair" ? "主席总览" : userRole === "leader" ? "部门工作台" : userRole === "teacher" ? "指导教师看板" : "我的工作台"}</button>
          {userRole !== "admin" && <button className={`nav-item ${activeView === "activities" || eventWorkspaceOpen ? "active" : ""}`} title="活动管理" onClick={() => { setActiveView("activities"); setEventWorkspaceOpen(false); }}><Activity size={18} />活动管理<span className="nav-count">{activities.length}</span></button>}
          {userRole === "chair" && <button className={`nav-item ${activeView === "tasks" ? "active" : ""}`} title="任务中心" onClick={() => setActiveView("tasks")}><ListTodo size={18} />任务中心<span className="nav-count alert">{tasks.filter(t => t.status !== "已完成").length}</span></button>}
          {(userRole === "chair" || userRole === "admin") && <button className={`nav-item ${activeView === "organization" ? "active" : ""}`} title="组织与成员" onClick={() => setActiveView("organization")}><Users size={18} />组织与成员</button>}
          {userRole !== "admin" && <button className={`nav-item ${activeView === "archive" ? "active" : ""}`} title="资料归档" onClick={() => setActiveView("archive")}><FileText size={18} />资料归档</button>}
          {userRole === "admin" && <button className={`nav-item ${activeView === "accounts" ? "active" : ""}`} title="账号与权限" onClick={() => setActiveView("accounts")}><UserCheck size={18}/>账号与权限{accountDirectory.filter((account) => !account.active).length > 0 && <span className="nav-count alert">{accountDirectory.filter((account) => !account.active).length}</span>}</button>}
          {userRole === "admin" && <button className={`nav-item ${activeView === "audit" ? "active" : ""}`} title="审计日志" onClick={() => setActiveView("audit")}><FileText size={18}/>审计日志</button>}
        </nav>
        <div className="sidebar-bottom">
          {(userRole === "chair" || userRole === "admin") && <button className={`nav-item ${activeView === "settings" ? "active" : ""}`} title={userRole === "admin" ? "系统配置" : "功能调研"} onClick={() => setActiveView("settings")}><Settings size={18} />{userRole === "admin" ? "系统配置" : "功能调研"}</button>}
          <div className="profile">
            <div className="avatar">{roleProfiles[userRole].initial}</div>
            <div><strong>{roleProfiles[userRole].name}</strong><span>{roleProfiles[userRole].title}</span></div>
            <MoreHorizontal size={18} />
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="breadcrumbs"><span>{eventWorkspaceOpen && activeView === "overview" ? "活动管理" : viewTitles[activeView].parent}</span><b>/</b><strong>{eventWorkspaceOpen && activeView === "overview" ? currentActivity.name : activeView === "overview" ? userRole === "admin" ? "系统总览" : userRole === "chair" ? "主席总览" : userRole === "leader" ? "部门工作台" : userRole === "teacher" ? "指导教师看板" : "我的工作台" : viewTitles[activeView].title}</strong></div>
          <div className="top-actions">
            <label className="search"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索任务、部门或负责人" /></label>
            <div className="session-chip"><span>{session.name}</span><small>{session.title}</small></div>
            <button className={`icon-button ${showNotifications ? "active" : ""}`} aria-label={`通知，${unreadNotificationCount}条未读`} onClick={() => setShowNotifications(!showNotifications)}><Bell size={19} />{unreadNotificationCount > 0 && <i />}</button>
            <button className="icon-button" aria-label="退出登录" title="退出登录" onClick={logout}><LogOut size={18}/></button>
            {userRole === "chair" && <button className="primary-button" onClick={openNewTask}><Plus size={18} />发布任务</button>}
          </div>
        </header>

        {showNotifications && <aside className="notification-panel"><header><div><h2>{userRole === "admin" ? "系统通知" : userRole === "chair" ? "主席通知" : userRole === "leader" ? "负责人通知" : userRole === "teacher" ? "指导教师通知" : "我的通知"}</h2><span>{unreadNotificationCount} 条未读</span></div><button className="icon-button" onClick={() => setShowNotifications(false)}><X size={17}/></button></header><div>{notifications.length ? notifications.map((item) => { const isRead = readNotifications.includes(item.id); return <button key={item.id} className={`${item.level || ""} ${isRead ? "read" : ""}`} onClick={() => openNotification(item)}><i/><span><strong>{item.title}</strong><p>{item.detail}</p><small>{item.time}</small></span></button>; }) : <div className="notification-empty"><Bell size={20}/><strong>暂无通知</strong></div>}</div><footer><button disabled={!unreadNotificationCount} onClick={() => { const ids = notifications.map((item) => item.id); setReadNotifications(ids); if (session) void fetch("/api/notifications/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: session.username, ids }) }).catch(() => undefined); setNotice("已将当前通知全部标为已读"); }}>全部标为已读</button></footer></aside>}

        <div className="content">
          {activeView !== "overview" ? <ProductModule user={session} view={activeView} tasks={tasks} activities={activities} archiveItems={archiveItems} role={userRole} onBack={() => { setActiveView("overview"); setEventWorkspaceOpen(userRole === "chair"); }} onOpenTask={setSelected} onCreate={userRole === "chair" ? openNewTask : () => setNotice("只有主席可以发布主任务")} onCreateActivity={() => { setEditingActivity(null); setQuickFlow("activity"); }} onEditActivity={editActivity} onUploadArchive={() => setQuickFlow("archive")} notify={handleNotify} pushNotification={pushNotification} /> : userRole !== "chair" ? <RoleDashboard user={session} accounts={accountDirectory} role={userRole} tasks={tasks} activities={activities} subtasks={subtasks} onWorkflowAction={runWorkflowAction} onOpenTask={setSelected} onStartMain={startMainAsLeader} onSubmitMain={submitMainForChair} onWithdrawMain={withdrawMainForLeader} notify={handleNotify} notifications={notifications} /> : !eventWorkspaceOpen ? <ChairOverview tasks={tasks} activities={activities} onOpenTask={setSelected} onOpenActivities={() => setActiveView("activities")} onOpenTasks={() => setActiveView("tasks")}/> : <>
          <section className="event-head">
            <div className="event-title-row">
              <div><span className="event-kicker">校级文体活动 · 筹备中</span><h1>计算学院十佳歌手比赛</h1></div>
              <div className="event-head-actions"><button className="outline-button" onClick={() => setEventWorkspaceOpen(false)}><ChevronRight size={16}/>返回主席总览</button><button className="outline-button" onClick={() => { const activity = activities.find((item) => item.id === "top-singer"); if (activity) editActivity(activity); }}>活动设置<Settings size={15}/></button></div>
            </div>
            <div className="event-meta">
              <span><CalendarDays size={16} />{currentActivity.time}</span>
              <span><MapPin size={16} />{currentActivity.location}</span>
              <span><Users size={16} />主办：文艺部 · 6个协作部门</span>
              <span><Users size={16} />指导教师：{currentActivity.liaisonTeacher || "未指定"}</span>
            </div>
          </section>

          <section className="overview-grid">
            <div className="progress-panel">
              <div className="panel-label"><span>筹备总进度</span><strong>{progress}%</strong></div>
              <div className="progress-track"><i style={{ width: `${progress}%` }} /></div>
              <div className="progress-foot"><span>{tasks.filter((task) => task.status === "已完成").length} 项已完成</span><span>{tasks.length - tasks.filter((task) => task.status === "已完成").length} 项待推进</span></div>
            </div>
            <button className="metric warning" onClick={() => setFilter("进行中")}><CircleAlert size={20} /><span><strong>1</strong>项存在风险</span><small>横幅经费待确认</small></button>
            <button className="metric" onClick={() => setFilter("待开始")}><Clock3 size={20} /><span><strong>{tasks.filter((task) => task.status === "待开始").length}</strong>项待启动</span><small>待负责人处理</small></button>
            <button className="metric" onClick={() => setFilter("待验收")}><CheckCircle2 size={20} /><span><strong>1</strong>项待验收</span><small>音响设备清单</small></button>
          </section>

          <section className="main-grid">
            <div className="task-area">
              <div className="section-head"><div><h2>任务执行</h2></div><button className="outline-button" onClick={() => setQuickFlow("timeline")}><CalendarDays size={16} />时间线</button></div>
              <div className="filters" role="tablist">
                {filters.map((item) => <button key={item} className={filter === item ? "selected" : ""} onClick={() => setFilter(item)}>{item}{item === "全部任务" && <span>{tasks.length}</span>}</button>)}
              </div>
              <div className="task-table">
                <div className="table-head"><span>任务事项</span><span>负责部门 / 人员</span><span>截止时间</span><span>状态</span></div>
                {visible.map((task) => (
                  <button className={`task-row ${selected?.id === task.id ? "current" : ""}`} key={task.id} onClick={() => setSelected(task)}>
                    <span className="task-name"><i className={`type-dot type-${task.kind}`} /><span><strong>{task.title}</strong><small>{task.kind}{task.risk ? " · 需要关注" : ""}</small></span></span>
                    <span className="owner"><b>{task.department}</b><small>{task.person}</small></span>
                    <span className={task.risk ? "deadline risk" : "deadline"}>{task.deadline}<small>{task.risk ? "可能逾期" : "按计划"}</small></span>
                    <span><i className={`status status-${task.status}`}>{task.status}</i></span>
                  </button>
                ))}
                {visible.length === 0 && <div className="empty">没有找到符合条件的任务</div>}
              </div>
            </div>

            <aside className="coordination execution-focus">
              <div className="section-head compact"><div><h2>执行关注</h2></div></div>
              {tasks.filter((task) => task.risk || task.status === "待验收").slice(0,2).map((task) => <button className={`execution-focus-item ${task.risk ? "urgent" : ""}`} key={task.id} onClick={() => setSelected(task)}><i>{task.risk ? <CircleAlert size={16}/> : <ClipboardCheck size={16}/>}</i><span><strong>{task.title}</strong><small>{task.department} · {task.person} · {task.status}</small></span><ChevronRight size={15}/></button>)}
              <div className="timeline-mini">
                <div className="mini-title"><h3>关键节点</h3><span>本周</span></div>
                <div className="mini-item done"><i><Check size={13} /></i><span><b>预热推文发布</b><small>9月19日 · 已完成</small></span></div>
                <div className="mini-item active"><i>20</i><span><b>横幅定稿与下单</b><small>今天 · 运维部</small></span></div>
                <div className="mini-item"><i>23</i><span><b>舞台联排</b><small>19:00 · 报告厅</small></span></div>
                <div className="mini-item"><i>25</i><span><b>正式比赛</b><small>18:30 · 学生活动中心</small></span></div>
              </div>
            </aside>
          </section>
          </>}
        </div>
      </section>

      {selected && (
        <dialog open className="drawer-backdrop">
          <aside className="drawer">
            <div className="drawer-head"><div><span className="tag">{selected.kind}</span><h2>{selected.title}</h2></div><button className="icon-button" onClick={() => setSelected(null)} aria-label="关闭"><X size={20} /></button></div>
            <div className="drawer-body">
              {selected.risk && <div className="risk-banner"><CircleAlert size={18} /><span><strong>存在阻塞</strong>经费审批尚未完成，可能影响制作周期。</span></div>}
              <section><div className="section-inline"><h3>所属活动</h3></div><div className="activity-context-detail"><div><Activity size={16}/><span><small>活动名称</small><strong>{selected.activityName || currentActivity.name}</strong></span></div><div><CalendarDays size={16}/><span><small>活动时间</small><strong>{selected.activityTime || currentActivity.time}</strong></span></div><div><MapPin size={16}/><span><small>活动地点</small><strong>{selected.activityLocation || currentActivity.location}</strong></span></div><div><Users size={16}/><span><small>指导教师</small><strong>{selected.liaisonTeacher || currentActivity.liaisonTeacher || "未指定"}</strong></span></div></div></section>
              <section><h3>任务说明</h3><p className="description">{selected.description}</p></section>
              <section><h3>执行信息</h3><div className="detail-grid"><div><span>负责部门</span><strong>{selected.department}</strong></div><div><span>执行人</span><strong>{selected.person}</strong></div><div><span>截止时间</span><strong>{selected.deadline}</strong></div><div><span>管理方式</span><strong>{getControlMode(selected)}</strong></div></div></section>
              <section><div className="section-inline"><h3>任务参数</h3></div><div className="dynamic-fields">{selected.fields.map((field) => <div key={field.label}><span>{field.label}</span><strong>{field.value}</strong></div>)}</div></section>
              {userRole === "chair" && <section className="chair-execution-detail"><div className="section-inline"><h3>执行分工</h3></div>{(() => { const children = subtasks.filter((item) => isSubtaskOf(item, selected)); const finished = children.filter((item) => item.status === "已完成").length; return <><div className="execution-summary"><span><strong>{children.length || 1}</strong><small>{children.length ? "项执行分工" : "项直接交办"}</small></span><span><strong>{children.length ? `${finished}/${children.length}` : selected.status}</strong><small>{children.length ? "已完成" : "主任务状态"}</small></span><span><strong>{selected.person}</strong><small>主执行人</small></span></div>{children.length ? <div className="chair-subtask-list">{children.map((item) => <article key={item.id || `${item.parent}-${item.title}`}><header><span><i className="avatar tiny">{item.assignee.slice(0,1)}</i><b>{item.assignee}</b><small>{accountDirectory.find((account) => account.name === item.assignee)?.role === "leader" ? "负责人" : "干事"}</small></span><em className={`status status-${item.status}`}>{item.status}</em></header><h4>{item.title}</h4><dl><div><dt>截止时间</dt><dd>{item.deadline}</dd></div><div><dt>完成要求</dt><dd>{item.evidence}</dd></div></dl>{item.completionNote && <p><strong>完成说明：</strong>{item.completionNote}</p>}{item.lastAction && <p><strong>最新动态：</strong>{item.lastAction}</p>}{item.attachments?.length ? <div className="chair-proof-list">{item.attachments.map((file) => <button key={file.key} onClick={() => window.open(`/api/files?key=${encodeURIComponent(file.key)}`, "_blank")}><Paperclip size={12}/>{file.name}</button>)}</div> : <small className="no-proof">暂无上传凭据</small>}</article>)}</div> : <div className="direct-executor-row"><UserCheck size={18}/><span><strong>{selected.person} · {selected.person === session?.name ? "部门负责人" : "主执行人"}</strong><small>该任务未拆分子任务，由主席直接交办的执行人负责完成。</small></span><em className={`status status-${selected.status}`}>{selected.status}</em></div>}</>; })()}</section>}
              <section><div className="section-inline"><h3>附件资料</h3>{(userRole === "chair" || userRole === "leader") && showTaskActions && selected.status !== "已完成" && <label className="attach-action"><Paperclip size={14}/>{uploading ? "上传中" : "添加附件"}<input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip" multiple disabled={uploading} onChange={(event) => { const files = event.currentTarget.files; event.currentTarget.value = ""; uploadSelectedFiles(files); }}/></label>}</div><div className="attachment-list">{(selected.attachments || []).map((file, index) => <div className="attachment-row" key={`${file.key || file.name}-${index}`}><button className="attachment-open" onClick={() => file.key && window.open(`/api/files?key=${encodeURIComponent(file.key)}`, "_blank")}><FileText size={18}/><span><strong>{file.name}</strong><small>{file.type?.startsWith("image/") ? "图片" : "文件"} · {(file.size / 1024 / 1024).toFixed(file.size > 1024 * 1024 ? 1 : 2)} MB</small></span><span>查看</span></button>{file.key && (userRole === "chair" || userRole === "leader") && showTaskActions && selected.status !== "已完成" && <button className="attachment-delete" title="删除附件" aria-label={`删除${file.name}`} onClick={() => removeSelectedAttachment(file)}><X size={15}/></button>}</div>)}{!selected.attachments?.length && <div className="no-attachments"><Paperclip size={16}/>暂无附件，可上传图片、方案或往届参考资料</div>}</div></section>
              <section><h3>最新动态</h3><div className="activity-line"><div className="avatar small">{selected.lastAction ? roleProfiles[userRole].initial : "陈"}</div><p><strong>{selected.lastAction || "陈雨桐 更新了任务进度"}</strong><small>{selected.lastAction ? "状态变更已留痕，可在活动归档中追溯" : "已确认横幅尺寸，等待办公室完成经费审批 · 35分钟前"}</small></p></div></section>
            </div>
            <div className={`drawer-actions ${showTaskActions ? "action-mode" : "view-mode"}`}>{(userRole === "chair" || userRole === "leader") && !showTaskActions && <><span><strong>当前为查看模式</strong>任务信息不会因浏览而改变</span><button className="outline-button" onClick={() => setSelected(null)}>关闭</button><button className="primary-button" onClick={() => setShowTaskActions(true)}><Settings size={17}/>{userRole === "chair" && selected.status === "待验收" ? "审核与操作" : "任务操作"}</button></>}{userRole === "chair" && showTaskActions && <>{selected.status === "待验收" ? <><span>负责人已提交部门结办，请审核结果与凭据</span><button className="outline-button danger" onClick={() => rejectMainTask(selected)}>退回修改</button><button className="primary-button" onClick={() => updateStatus(selected, "已完成")}><PackageCheck size={18}/>审核通过</button></> : selected.status === "已完成" ? <><span><strong>任务已经完成</strong>如需继续补充工作，可以重新打开</span><button className="outline-button" onClick={() => requestTaskStatus(selected, "进行中")}><Play size={17}/>重新打开</button></> : selected.status === "待开始" ? <><span><strong>任务尚未开始</strong>可启动跟踪，或对无需跟踪的小事项直接办结</span><button className="outline-button" onClick={() => requestTaskStatus(selected, "进行中")}><Play size={17}/>标记开始</button><button className="primary-button" onClick={() => requestTaskStatus(selected, "已完成")}><PackageCheck size={18}/>直接办结</button></> : <><span><strong>任务正在执行</strong>通常等待负责人提交；小事项可由主席直接办结</span><button className="primary-button" onClick={() => requestTaskStatus(selected, "已完成")}><PackageCheck size={18}/>直接办结</button></>}</>}{userRole === "leader" && showTaskActions && <>{selected.person === session?.name && selected.status === "待开始" ? <><span>这是主席直接交办给你的任务，开始后可上传凭据</span><button className="primary-button" onClick={() => startMainAsLeader(selected)}><Play size={17}/>开始执行</button></> : <><span>{selected.status === "待验收" ? "部门结办已提交，等待主席最终审核" : selectedOpenSubtasks.length ? `还有${selectedOpenSubtasks.length}个子任务未完成` : selected.person === session?.name ? "完成后提交主席审核；需要时也可继续拆分" : "验收执行结果后，提交主席审核结办"}</span>{selected.status === "待验收" ? <button className="outline-button withdraw-button" onClick={() => withdrawMainForLeader(selected)}><RotateCcw size={17}/>撤回提交</button> : <button className="primary-button" disabled={selectedOpenSubtasks.length > 0} onClick={() => submitMainForChair(selected)}><ClipboardCheck size={18}/>提交主席审核</button>}</>}</>}{userRole === "staff" && <><span><strong>查看模式</strong>请返回“我的工作台”处理负责人分派的子任务</span><button className="outline-button" onClick={() => setSelected(null)}>关闭</button></>}{userRole === "admin" && <><span><strong>只读查看</strong>系统管理员不参与业务状态处理</span><button className="outline-button" onClick={() => setSelected(null)}>关闭</button></>}{userRole === "teacher" && <><span>教师以查看和指导为主，不直接修改执行状态</span><button className="outline-button" onClick={() => setSelected(null)}>关闭</button><button className="primary-button" onClick={() => { setSelected(null); setQuickFlow("guidance"); }}><ShieldCheck size={18}/>提交指导意见</button></>}</div>
          </aside>
        </dialog>
      )}

      {mainRejectionTarget && <TextEntryModal title="退回部门结办" description={`“${mainRejectionTarget.title}”将退回负责人继续修改，退回原因会同步到负责人通知和任务动态。`} label="退回原因" initialValue="请补充完整的交付凭据" confirmText="确认退回" onCancel={() => setMainRejectionTarget(null)} onConfirm={(reason) => confirmRejectMainTask(mainRejectionTarget, reason)}/>} 
      {pendingTaskAction && <ConfirmActionModal title={pendingTaskAction.title} description={pendingTaskAction.description} confirmText={pendingTaskAction.confirmText} onCancel={() => setPendingTaskAction(null)} onConfirm={() => { updateStatus(pendingTaskAction.task, pendingTaskAction.status); setPendingTaskAction(null); }}/>} 

      {showNew && (
        <div className="modal-backdrop">
          <div className="task-wizard" role="dialog" aria-modal="true" aria-labelledby="wizard-title">
            <header className="wizard-head">
              <div><span>{draft.activityName || "跨活动任务发布"}</span><h2 id="wizard-title">创建新任务</h2></div>
              <button className="icon-button" onClick={closeNewTask} aria-label="关闭"><X size={19} /></button>
            </header>

            <div className="wizard-progress">
              {["所属范围", "基本信息", "参数与管理", "确认发布"].map((label, index) => {
                const step = index + 1;
                return <div key={label} className={newStep === step ? "active" : newStep > step ? "done" : ""}><i>{newStep > step ? <Check size={13} /> : step}</i><span>{label}</span></div>;
              })}
            </div>

            <div className="wizard-body">
              {newStep === 1 && <section className="wizard-section"><div className="wizard-title"><h3>任务范围</h3></div><div className="task-scope-picker"><label><span>所属活动 *</span><select value={draft.activityName === "非活动临时事项" ? "standalone" : activities.find((activity) => activity.name === draft.activityName)?.id || ""} onChange={(event) => selectDraftActivity(event.target.value)}><option value="">请选择活动</option>{activities.filter((activity) => activity.state !== "已结束").map((activity) => <option key={activity.id} value={activity.id}>{activity.name} · {activity.state}</option>)}<option value="standalone">非活动临时事项</option></select></label>{draft.activityName ? <div className="scope-preview"><Activity size={18}/><span><strong>{draft.activityName}</strong><small>{draft.activityName === "非活动临时事项" ? "不进入活动进度，仅在任务中心跟踪" : `${draft.activityTime} · ${draft.activityLocation}`}</small></span><CheckCircle2 size={17}/></div> : <div className="scope-empty"><CircleAlert size={17}/><span>请选择活动后继续</span></div>}</div><div className="wizard-subtitle"><h4>任务类型</h4></div><div className="type-selector compact">{taskTypes.map((type) => { const Icon = type.icon; return <button key={type.name} className={draft.kind === type.name ? "chosen" : ""} onClick={() => setDraft({ ...draft, kind: type.name, dynamic: {} })}><Icon size={20} /><span><strong>{type.name}</strong><small>{type.note}</small></span>{draft.kind === type.name && <CheckCircle2 size={17} className="type-check" />}</button>; })}</div></section>}

              {newStep === 2 && <section className="wizard-section"><div className="wizard-title"><h3>填写任务基本信息</h3></div><div className="form-grid"><label className="span-2"><span>任务名称 *</span><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder={draft.kind === "物资制作" ? "例如：定制活动主题横幅" : "请输入清晰、可执行的任务名称"} /></label><label className="span-2"><span>任务说明</span><textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="说明任务背景、执行要求和交付结果" rows={3} /></label><label><span>负责部门 *</span><select value={draft.department} onChange={(e) => setDraft({ ...draft, department: e.target.value, person: "待指派" })}><option>运维部</option><option>PC部</option><option>心理部</option><option>文艺部</option><option>新媒体中心</option><option>办公室</option></select></label><label><span>执行人（可直接指定负责人）</span><select value={draft.person} onChange={(e) => setDraft({ ...draft, person: e.target.value })}><option>待指派</option>{draftAssignees.map((member) => <option key={`${member.name}-${member.position}`} value={member.name}>{member.name}（{member.position}）</option>)}</select><small className="field-hint">{draftAssignees.length ? `已读取${draft.department}在任成员` : "该部门暂无可指派成员，可先创建后由负责人接收"}</small></label><label><span>截止时间 *</span><input type="datetime-local" value={draft.deadline} onChange={(e) => setDraft({ ...draft, deadline: e.target.value })} /></label><label><span>优先级</span><select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })}><option>普通</option><option>重要</option><option>紧急</option></select></label></div></section>}
              {newStep === 2 && <div className="wizard-activity-context"><div><Activity size={17}/><span><small>所属范围</small><strong>{draft.activityName}</strong></span></div><div><CalendarDays size={17}/><span><small>活动时间</small><strong>{draft.activityTime || "不适用"}</strong></span></div><div><MapPin size={17}/><span><small>活动地点</small><strong>{draft.activityLocation || "不适用"}</strong></span></div><div><UserCheck size={17}/><span><small>指导教师</small><strong>{draft.liaisonTeacher || "未指定"}</strong></span></div></div>}

              {newStep === 3 && <section className="wizard-section"><div className="wizard-title"><h3>{draft.kind}的专属参数</h3></div><div className="form-grid dynamic-form">{dynamicSchemas[draft.kind].map((field, index) => <label key={field.key} className={index === dynamicSchemas[draft.kind].length - 1 && dynamicSchemas[draft.kind].length % 2 === 1 ? "span-2" : ""}><span>{field.label}</span><input type={field.type || "text"} value={draft.dynamic[field.key] || ""} onChange={(e) => setDraft({ ...draft, dynamic: { ...draft.dynamic, [field.key]: e.target.value } })} placeholder={field.placeholder} /></label>)}</div><div className="collab-box"><div><Settings size={19} /><span><strong>选择管理强度</strong></span></div><div className="control-mode-grid">{([{name:"快捷办结",note:"口头安排也能做完的小事"},{name:"凭据留痕",note:"提交照片或文件后自动完成"},{name:"负责人确认",note:"关键交付需要负责人确认"}] as {name:ControlMode;note:string}[]).map((mode) => <button type="button" key={mode.name} className={draft.controlMode === mode.name ? "active" : ""} onClick={() => setDraft({...draft, controlMode:mode.name, acceptance:mode.name === "负责人确认"})}><strong>{mode.name}</strong><small>{mode.note}</small></button>)}</div>{draft.controlMode === "负责人确认" && <label className="reviewer-select"><span>确认人</span><select value={draft.reviewer} onChange={(e) => setDraft({ ...draft, reviewer: e.target.value })}><option>运维部负责人</option><option>活动总负责人</option><option>分管主席（徐介翰）</option><option>文艺部负责人</option></select></label>}</div></section>}
              {newStep === 3 && <div className="wizard-attachment-box"><div><Paperclip size={18}/><span><strong>任务附件</strong><small>支持常见图片、PDF和Office文件，单个不超过20MB</small></span></div><label className="outline-button">{uploading ? "上传中…" : "选择文件"}<input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip" multiple disabled={uploading} onChange={(event) => { const files = event.currentTarget.files; event.currentTarget.value = ""; uploadFiles(files); }}/></label>{draft.attachments?.length > 0 && <div className="wizard-file-list">{draft.attachments.map((file) => <span key={file.key}><FileText size={14}/><strong>{file.name}</strong><b>{(file.size/1024/1024).toFixed(1)}MB</b><button type="button" title="删除附件" aria-label={`删除${file.name}`} onClick={() => removeDraftAttachment(file)}><X size={12}/></button></span>)}</div>}</div>}

              {newStep === 4 && <section className="wizard-section"><div className="wizard-title"><h3>确认任务信息</h3></div><div className="summary-scope"><Activity size={16}/><span><small>所属范围</small><strong>{draft.activityName}</strong></span></div><div className="create-summary"><div className="summary-main"><span className="tag">{draft.kind}</span><h3>{draft.title || "未填写任务名称"}</h3><p>{draft.description || "暂无补充说明。"}</p></div><dl><div><dt>负责部门</dt><dd>{draft.department}</dd></div><div><dt>执行人</dt><dd>{draft.person}</dd></div><div><dt>截止时间</dt><dd>{draft.deadline ? draft.deadline.replace("T", " ") : "未设置"}</dd></div><div><dt>管理方式</dt><dd>{draft.controlMode}</dd></div></dl><div className="summary-fields">{dynamicSchemas[draft.kind].filter((field) => draft.dynamic[field.key]).map((field) => <div key={field.key}><span>{field.label}</span><strong>{draft.dynamic[field.key]}</strong></div>)}</div><div className="notify-preview"><Bell size={17} /><span><strong>创建后自动通知</strong>{draft.department}负责人{draft.person !== "待指派" ? `、${draft.person}` : ""}{draft.controlMode === "负责人确认" ? `和确认人“${draft.reviewer}”` : ""}</span></div></div></section>}
            </div>

            <footer className="wizard-actions">
              <div className="wizard-draft-actions"><span className="autosave-note"><CheckCircle2 size={14}/>内容已自动保存</span><button className="draft-button" onClick={saveDraft}>保存并退出</button></div>
              <div>{newStep > 1 && <button className="outline-button" onClick={() => setNewStep(newStep - 1)}>上一步</button>}{newStep < 4 ? <button className="primary-button" disabled={(newStep === 1 && !draft.activityName) || (newStep === 2 && !draft.title.trim())} onClick={() => setNewStep(newStep + 1)}>下一步</button> : <button className="primary-button" disabled={!draft.title.trim() || !draft.activityName} onClick={addTask}><CheckCircle2 size={18} />确认发布</button>}</div>
            </footer>
          </div>
        </div>
      )}
      {quickFlow && <QuickFlowModal kind={quickFlow} activities={activities} initialData={quickFlow === "eventSettings" ? quickActivityData : undefined} onClose={() => { setQuickFlow(null); setEditingActivity(null); }} onSubmit={submitQuickFlow}/>}
      {notice && <div className="toast"><CheckCircle2 size={18} />{notice}</div>}
    </main>
  );
}
