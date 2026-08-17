// 产品数据模型：类型、常量与纯辅助函数（不包含 React 组件）。
// 由 app/page.tsx 拆分而来，作为各视图/组件共享的数据层。

import { Activity, FileText, PackageCheck, Settings, Users } from "lucide-react";
import type { TaskStatus } from "./workflow/state-machine";

export type Attachment = { key: string; name: string; size: number; type?: string };
export type WorkflowActionPayload = { kind: "task" | "subtask"; id?: string | number; action: string; note?: string; reason?: string; attachment?: Attachment; key?: string; parentTaskId?: number; title?: string; assignee?: string; deadline?: string; evidence?: string; task?: Task };

export async function deleteAttachmentObject(file: Attachment) {
  if (!file.key) return;
  const response = await fetch(`/api/files?key=${encodeURIComponent(file.key)}`, { method: "DELETE" });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || "附件删除失败");
  }
}

export type ControlMode = "快捷办结" | "凭据留痕" | "负责人确认";
export type Task = {
  id: number;
  title: string;
  department: string;
  person: string;
  deadline: string;
  status: TaskStatus;
  risk?: boolean;
  kind: string;
  description: string;
  fields: { label: string; value: string }[];
  activityName?: string;
  activityTime?: string;
  activityLocation?: string;
  liaisonTeacher?: string;
  attachments?: Attachment[];
  controlMode?: ControlMode;
  lastAction?: string;
};

export type TaskDraft = {
  kind: string;
  title: string;
  description: string;
  department: string;
  person: string;
  deadline: string;
  priority: string;
  reviewer: string;
  acceptance: boolean;
  controlMode: ControlMode;
  dynamic: Record<string, string>;
  activityName: string;
  activityTime: string;
  activityLocation: string;
  liaisonTeacher: string;
  attachments: Attachment[];
};

export function getControlMode(task: Task): ControlMode {
  if (task.controlMode) return task.controlMode;
  if (task.risk || task.kind === "技术保障") return "负责人确认";
  if (task.kind === "现场服务") return "凭据留痕";
  return "快捷办结";
}

export const currentActivity = {
  name: "计算学院十佳歌手比赛",
  time: "2026年9月25日 18:30–21:30",
  location: "学生活动中心报告厅",
  liaisonTeacher: "王明远",
};

export type ActivityRecord = {
  id: string;
  name: string;
  category: string;
  state: "筹备中" | "策划中" | "待启动" | "已结束";
  date: string;
  day: string;
  month: string;
  time: string;
  location: string;
  organizer: string;
  teacher: string;
  progress: number;
  pending: number;
  departments: string[];
  description: string;
  nextMilestone: string;
  milestones: { date: string; title: string; owner: string; done?: boolean }[];
};

export const activityCatalog: ActivityRecord[] = [
  { id: "top-singer", name: currentActivity.name, category: "文体活动", state: "筹备中", date: "2026年9月25日", day: "25", month: "9月", time: "18:30–21:30", location: currentActivity.location, organizer: "文艺部", teacher: currentActivity.liaisonTeacher, progress: 67, pending: 5, departments: ["文艺部", "运维部", "新媒体中心", "心理部", "办公室", "生活部"], description: "面向全院学生举办的校园歌手赛事，统一协调舞台、宣传、现场服务与赛后报道。", nextMilestone: "9月23日 19:00 舞台联排", milestones: [{ date: "9月19日", title: "预热推文发布", owner: "新媒体中心", done: true }, { date: "9月20日", title: "横幅定稿与下单", owner: "运维部" }, { date: "9月23日", title: "舞台联排", owner: "文艺部、运维部" }, { date: "9月25日", title: "正式比赛", owner: "全体协作部门" }] },
  { id: "photo-exhibition", name: "学院新闻摄影展", category: "品牌宣传", state: "策划中", date: "2026年10月8日", day: "08", month: "10月", time: "全天", location: "计算机楼一楼展厅", organizer: "新媒体中心", teacher: "李静", progress: 35, pending: 7, departments: ["新媒体中心", "办公室", "实践部"], description: "征集并展出学院年度新闻摄影作品，完成作品评审、展陈设计与线上专题推送。", nextMilestone: "9月28日 作品征集截止", milestones: [{ date: "9月18日", title: "发布征集通知", owner: "新媒体中心", done: true }, { date: "9月28日", title: "作品征集截止", owner: "新媒体中心" }, { date: "10月3日", title: "完成评审与排版", owner: "评审组" }, { date: "10月8日", title: "开展与专题发布", owner: "新媒体中心" }] },
  { id: "operation-contest", name: "重大赛事运营策划大赛", category: "创新实践", state: "策划中", date: "2026年10月16日", day: "16", month: "10月", time: "14:00–18:00", location: "计算机楼学术报告厅", organizer: "新媒体中心", teacher: "赵峰", progress: 22, pending: 9, departments: ["新媒体中心", "实践部", "职规部"], description: "以真实赛事为背景开展运营方案设计、路演展示和专家评审。", nextMilestone: "9月26日 完成赛制与评分标准", milestones: [{ date: "9月20日", title: "立项与需求访谈", owner: "新媒体中心", done: true }, { date: "9月26日", title: "赛制与评分标准定稿", owner: "策划组" }, { date: "10月10日", title: "参赛方案收集", owner: "实践部" }, { date: "10月16日", title: "路演评审", owner: "执行组" }] },
  { id: "coding-contest", name: "新生程序设计竞赛", category: "科技竞赛", state: "待启动", date: "2026年10月12日", day: "12", month: "10月", time: "14:00–17:00", location: "计算机实验中心", organizer: "科创中心", teacher: "刘倩", progress: 18, pending: 6, departments: ["PC部", "运维部", "学习部", "新媒体中心"], description: "面向新生的程序设计入门竞赛，覆盖命题、报名、机房环境、监考与成绩发布。", nextMilestone: "9月30日 完成机房环境测试", milestones: [{ date: "9月22日", title: "竞赛通知定稿", owner: "PC部", done: true }, { date: "9月30日", title: "机房环境测试", owner: "运维部" }, { date: "10月8日", title: "报名与考场编排", owner: "PC部" }, { date: "10月12日", title: "正式比赛", owner: "科创中心" }] },
  { id: "career-sharing", name: "秋季校园招聘经验分享会", category: "职业发展", state: "待启动", date: "2026年10月20日", day: "20", month: "10月", time: "19:00–21:00", location: "计算机楼216", organizer: "职规部", teacher: "孙琳", progress: 8, pending: 4, departments: ["职规部", "新媒体中心", "办公室"], description: "邀请高年级同学分享秋招准备、简历优化和面试经验。", nextMilestone: "10月5日 确认分享嘉宾", milestones: [{ date: "10月5日", title: "确认分享嘉宾", owner: "职规部" }, { date: "10月10日", title: "发布报名推送", owner: "新媒体中心" }, { date: "10月18日", title: "场地与材料确认", owner: "办公室" }, { date: "10月20日", title: "现场分享", owner: "职规部" }] },
  { id: "welcome-night", name: "计算学院迎新晚会", category: "文体活动", state: "已结束", date: "2026年9月6日", day: "06", month: "9月", time: "19:00–21:30", location: "大学生活动中心", organizer: "文艺部", teacher: "王明远", progress: 100, pending: 0, departments: ["文艺部", "新媒体中心", "运维部", "生活部"], description: "面向新生的学院迎新晚会，活动执行已完成，当前进入资料归档与复盘阶段。", nextMilestone: "已完成，待复盘归档", milestones: [{ date: "9月2日", title: "节目联排", owner: "文艺部", done: true }, { date: "9月5日", title: "设备与场地验收", owner: "运维部", done: true }, { date: "9月6日", title: "正式演出", owner: "全体协作部门", done: true }, { date: "9月8日", title: "新闻稿与素材归档", owner: "新媒体中心", done: true }] },
];

export const taskTypes = [
  { name: "物资制作", note: "横幅、海报、采购与制作", icon: PackageCheck },
  { name: "技术保障", note: "音响、灯光、网络与设备", icon: Settings },
  { name: "现场服务", note: "签到、清场、秩序与引导", icon: Users },
  { name: "宣传发布", note: "推文、海报、摄影与新闻", icon: FileText },
  { name: "新媒体制作", note: "活动拍摄、新闻稿、推送与视频", icon: Activity },
];

export const dynamicSchemas: Record<string, { key: string; label: string; placeholder: string; type?: string }[]> = {
  物资制作: [
    { key: "content", label: "制作内容", placeholder: "例如：计算学院十佳歌手比赛" },
    { key: "size", label: "规格 / 尺寸", placeholder: "例如：8米 × 0.8米" },
    { key: "budget", label: "预算金额（元）", placeholder: "例如：120", type: "number" },
    { key: "supplier", label: "供应商", placeholder: "例如：校园图文中心" },
    { key: "location", label: "使用 / 悬挂地点", placeholder: "例如：计算机楼一楼入口" },
  ],
  技术保障: [
    { key: "equipment", label: "设备清单", placeholder: "例如：无线麦 × 6、调音台 × 1" },
    { key: "rehearsal", label: "联调 / 彩排时间", placeholder: "例如：9月23日 19:00" },
    { key: "people", label: "现场值守人数", placeholder: "例如：2", type: "number" },
    { key: "backup", label: "备用方案", placeholder: "例如：备用有线麦 × 2" },
  ],
  现场服务: [
    { key: "scope", label: "工作范围", placeholder: "例如：观众席、后台、舞台周边" },
    { key: "people", label: "参与人数", placeholder: "例如：6", type: "number" },
    { key: "standard", label: "完成标准", placeholder: "例如：座椅归位、地面无垃圾" },
    { key: "supplies", label: "所需物资", placeholder: "例如：垃圾袋、手套、扫帚" },
  ],
  宣传发布: [
    { key: "platform", label: "发布平台", placeholder: "例如：学院微信公众号" },
    { key: "publishTime", label: "计划发布时间", placeholder: "例如：9月20日 20:00" },
    { key: "reviewer", label: "内容审核人", placeholder: "例如：新媒体中心负责人" },
    { key: "assets", label: "素材要求", placeholder: "例如：主视觉、选手照片、报名二维码" },
  ],
  新媒体制作: [
    { key: "deliverable", label: "交付类型", placeholder: "活动照片 / 新闻稿 / 推送 / 视频" },
    { key: "shotList", label: "拍摄清单", placeholder: "例如：签到、领导致辞、舞台全景、获奖合影" },
    { key: "newsFocus", label: "新闻稿重点", placeholder: "活动背景、过程亮点、获奖名单、育人成效" },
    { key: "deadline", label: "成稿 / 推送时间", placeholder: "例如：活动结束后24小时内" },
    { key: "platform", label: "发布平台", placeholder: "学院公众号、视频号、官网" },
    { key: "videoBrief", label: "视频脚本要求", placeholder: "如需视频，填写时长、画幅、节奏和字幕要求" },
  ],
};

export const emptyDraft: TaskDraft = {
  kind: "物资制作",
  title: "",
  description: "",
  department: "运维部",
  person: "待指派",
  deadline: "2026-09-24T18:00",
  priority: "普通",
  reviewer: "运维部负责人",
  acceptance: true,
  controlMode: "凭据留痕",
  dynamic: {},
  activityName: "",
  activityTime: "",
  activityLocation: "",
  liaisonTeacher: "",
  attachments: [],
};

export const initialTasks: Task[] = [
  {
    id: 1,
    title: "定制活动主题横幅",
    department: "运维部",
    person: "陈雨桐",
    deadline: "9月20日 18:00",
    status: "进行中",
    risk: true,
    kind: "物资制作",
    description: "完成横幅文案确认、询价、经费审批、制作及到货验收。活动前完成悬挂。",
    fields: [
      { label: "横幅内容", value: "青春唱响 · 计算学院十佳歌手比赛" },
      { label: "尺寸", value: "8米 × 0.8米" },
      { label: "预算", value: "¥120" },
      { label: "悬挂地点", value: "计算机楼一楼入口" },
      { label: "经费审批", value: "待办公室确认" },
      { label: "制作商", value: "校园图文中心" },
    ],
  },
  {
    id: 2,
    title: "舞台音响设备确认",
    department: "运维部",
    person: "林浩然",
    deadline: "9月21日 12:00",
    status: "待验收",
    kind: "技术保障",
    description: "核对设备清单，与场地管理教师确认控制台权限并完成通电测试。",
    fields: [
      { label: "设备清单", value: "无线麦 × 6、调音台 × 1、返听音箱 × 2" },
      { label: "彩排时间", value: "9月23日 19:00" },
      { label: "现场值守", value: "2人" },
      { label: "备用方案", value: "有线麦 × 2、5号电池 × 16" },
    ],
  },
  {
    id: 3,
    title: "灯光控制方案与彩排",
    department: "运维部",
    person: "周子轩",
    deadline: "9月23日 21:30",
    status: "进行中",
    kind: "技术保障",
    description: "按节目单制作灯光提示表，彩排时逐节目确认效果。",
    fields: [
      { label: "节目数量", value: "18个" },
      { label: "彩排时间", value: "9月23日 19:00" },
      { label: "控制台权限", value: "已确认" },
    ],
  },
  {
    id: 4,
    title: "活动结束后场地清理",
    department: "心理部",
    person: "赵可欣",
    deadline: "9月25日 22:00",
    status: "待开始",
    kind: "现场服务",
    description: "活动结束后完成观众席、后台和舞台周边清理，座椅归位。",
    fields: [
      { label: "清理范围", value: "观众席、后台、舞台周边" },
      { label: "参与人数", value: "6人" },
      { label: "完成标准", value: "座椅归位、地面无垃圾、上传照片" },
      { label: "所需物资", value: "垃圾袋、手套、扫帚" },
    ],
  },
  {
    id: 5,
    title: "选手签到与候场引导",
    department: "文艺部",
    person: "宋佳宁",
    deadline: "9月25日 17:30",
    status: "待开始",
    kind: "现场服务",
    description: "完成选手签到、号码核对及候场区秩序维护。",
    fields: [
      { label: "选手人数", value: "18人" },
      { label: "签到地点", value: "报告厅后台入口" },
      { label: "到岗时间", value: "9月25日 16:30" },
    ],
  },
  {
    id: 6,
    title: "活动预热推文发布",
    department: "新媒体中心",
    person: "许言",
    deadline: "9月19日 20:00",
    status: "已完成",
    kind: "宣传发布",
    description: "完成公众号预热推文排版、审核与定时发布。",
    fields: [
      { label: "发布平台", value: "学院微信公众号" },
      { label: "发布时间", value: "9月19日 20:00" },
      { label: "审核人", value: "孙亮杰" },
    ],
  },
  {
    id: 7,
    title: "活动全程摄影与照片交付",
    department: "新媒体中心",
    person: "苏禾",
    deadline: "9月26日 12:00",
    status: "进行中",
    kind: "新媒体制作",
    description: "覆盖签到、舞台表演、嘉宾互动和颁奖环节，活动后完成筛片与分类交付。",
    fields: [
      { label: "交付类型", value: "活动照片" },
      { label: "拍摄清单", value: "签到、舞台全景、选手特写、颁奖合影" },
      { label: "交付标准", value: "精选照片不少于80张，按环节分类" },
      { label: "成稿时间", value: "活动结束后15小时内" },
    ],
  },
  {
    id: 8,
    title: "撰写活动新闻稿并制作推送",
    department: "新媒体中心",
    person: "方可",
    deadline: "9月26日 20:00",
    status: "待开始",
    kind: "新媒体制作",
    description: "依据活动流程和获奖名单撰写新闻稿，完成公众号排版、审核与发布。",
    fields: [
      { label: "交付类型", value: "新闻稿 + 微信推送" },
      { label: "新闻重点", value: "活动亮点、获奖名单、育人成效" },
      { label: "发布平台", value: "学院微信公众号、学院官网" },
      { label: "审核链路", value: "新媒体负责人 → 指导教师" },
    ],
  },
  {
    id: 9,
    title: "十佳歌手赛后短视频",
    department: "新媒体中心",
    person: "顾言",
    deadline: "9月28日 18:00",
    status: "待开始",
    kind: "新媒体制作",
    description: "按照视频需求稿完成素材整理、剪辑、字幕和成片审核。",
    fields: [
      { label: "成片规格", value: "90秒，竖屏 9:16" },
      { label: "内容结构", value: "开场氛围—舞台高光—颁奖—合影" },
      { label: "字幕要求", value: "全程关键对白字幕，统一学院视觉" },
      { label: "发布平台", value: "学院视频号" },
    ],
  },
];

export const filters = ["全部任务", "待开始", "进行中", "待验收", "已完成"];

export type ViewKey = "overview" | "activities" | "tasks" | "organization" | "archive" | "accounts" | "audit" | "settings";

export const viewTitles: Record<ViewKey, { parent: string; title: string }> = {
  overview: { parent: "工作台", title: "主席总览" },
  activities: { parent: "业务管理", title: "活动管理" },
  tasks: { parent: "业务管理", title: "任务中心" },
  organization: { parent: "基础数据", title: "组织与成员" },
  archive: { parent: "知识沉淀", title: "资料归档" },
  accounts: { parent: "系统管理", title: "账号与权限" },
  audit: { parent: "系统管理", title: "审计日志" },
  settings: { parent: "系统管理", title: "功能配置" },
};

export type OrgTerm = { id: number; name: string; startYear: number; endYear: number; isCurrent: boolean };
export type OrgDepartment = { id: number; name: string; groupName: string; parentId: number | null; description: string; sortOrder: number };
export type OrgMember = { id: number; termId: number; departmentId: number | null; name: string; studentNo: string; className: string; grade: string; major: string; phone: string; position: string; roleLevel: string };
export type OrgSnapshot = { terms: OrgTerm[]; departments: OrgDepartment[]; members: OrgMember[]; selectedTermId: number };
export type MemberImportRow = { rowNumber: number; name: string; studentNo: string; className: string; phone: string; department: string; position: string; roleLevel: "chair" | "leader" | "staff" | ""; errors: string[] };

export const importHeaders = {
  name: ["姓名", "name"], studentNo: ["学号", "studentno"], className: ["班级", "classname"], phone: ["联系电话", "手机号", "phone"],
  department: ["所属部门", "部门", "department"], position: ["职务", "position"],
} as const;

export function normalizeImportHeader(value: unknown) { return String(value ?? "").trim().replace(/[\s*＊_()-]/g, "").toLowerCase(); }
export function importCell(value: unknown) { return value === null || value === undefined ? "" : String(value).trim(); }

export function parseMemberImportRows(table: unknown[][], departments: OrgDepartment[]): MemberImportRow[] {
  const normalizedAliases = Object.fromEntries(Object.entries(importHeaders).map(([key, aliases]) => [key, aliases.map(normalizeImportHeader)]));
  const headerRowIndex = table.findIndex((row) => {
    const headers = row.map(normalizeImportHeader);
    return normalizedAliases.name.some((alias) => headers.includes(alias)) && normalizedAliases.department.some((alias) => headers.includes(alias));
  });
  if (headerRowIndex < 0) throw new Error("未找到成员表头，请使用系统提供的模板填写");
  const headers = table[headerRowIndex].map(normalizeImportHeader);
  const column = (key: keyof typeof importHeaders) => headers.findIndex((header) => normalizedAliases[key].includes(header));
  const requiredColumns: Array<keyof typeof importHeaders> = ["name", "department", "position"];
  const missingColumns = requiredColumns.filter((key) => column(key) < 0).map((key) => importHeaders[key][0]);
  if (missingColumns.length) throw new Error(`缺少必需列：${missingColumns.join("、")}`);
  const allowedDepartments = new Set(["主席团", ...departments.filter((department) => department.name !== "科创中心").map((department) => department.name)]);
  const roleMap: Record<string, MemberImportRow["roleLevel"]> = { "主席": "chair", "负责人": "leader", "干事": "staff", chair: "chair", leader: "leader", staff: "staff" };
  const rows = table.slice(headerRowIndex + 1).map((cells, index) => {
    const value = (key: keyof typeof importHeaders) => column(key) < 0 ? "" : importCell(cells[column(key)]);
    const name = value("name");
    const studentNo = value("studentNo");
    const department = value("department");
    const position = value("position");
    const roleLevel: MemberImportRow["roleLevel"] = roleMap[position] || "";
    const errors: string[] = [];
    if (!name) errors.push("姓名不能为空");
    if (!department) errors.push("所属部门不能为空"); else if (!allowedDepartments.has(department)) errors.push(`系统中不存在“${department}”`);
    if (!position) errors.push("职务不能为空");
    if (!roleLevel) errors.push("职务只能填写主席、负责人或干事");
    if (roleLevel === "chair" && department !== "主席团") errors.push("主席的所属部门必须是主席团");
    if (roleLevel && roleLevel !== "chair" && department === "主席团") errors.push("负责人或干事必须选择实际部门");
    return { rowNumber: headerRowIndex + index + 2, name, studentNo, className: value("className"), phone: value("phone"), department, position, roleLevel, errors };
  }).filter((row) => row.name || row.studentNo || row.department || row.position);
  const studentNumbers = new Map<string, number[]>();
  rows.forEach((row, index) => { if (row.studentNo) studentNumbers.set(row.studentNo, [...(studentNumbers.get(row.studentNo) || []), index]); });
  studentNumbers.forEach((indexes) => { if (indexes.length > 1) indexes.forEach((index) => rows[index].errors.push("学号在本次名单中重复")); });
  if (!rows.length) throw new Error("表格中没有可导入的成员数据");
  if (rows.length > 500) throw new Error("单次最多导入 500 名成员");
  return rows;
}

export const blankMember = { id: 0, termId: 0, departmentId: null as number | null, name: "", studentNo: "", className: "", grade: "", major: "", phone: "", position: "干事", roleLevel: "staff" };
export const fallbackAssignees: Record<string, { name: string; position: string; roleLevel: string }[]> = {
  运维部: [{ name: "陈雨桐", position: "负责人", roleLevel: "leader" }, { name: "周子轩", position: "干事", roleLevel: "staff" }],
  PC部: [{ name: "林浩然", position: "负责人", roleLevel: "leader" }],
  心理部: [{ name: "赵可欣", position: "负责人", roleLevel: "leader" }],
  文艺部: [{ name: "宋佳宁", position: "负责人", roleLevel: "leader" }],
  新媒体中心: [{ name: "许言", position: "负责人", roleLevel: "leader" }, { name: "苏禾", position: "干事", roleLevel: "staff" }],
  办公室: [{ name: "蒋明悦", position: "负责人", roleLevel: "leader" }],
};

export type UserRole = "admin" | "chair" | "leader" | "staff" | "teacher";
export type NotificationEntity = { type: "task" | "subtask" | "activity" | "account" | "archive" | "system"; id?: string | number; parentTaskId?: number };
export type NotificationRecord = {
  id: string;
  recipientUsernames: string[];
  title: string;
  detail: string;
  createdAt: string;
  level?: "warning" | "success" | "info";
  entity?: NotificationEntity;
};
export type NotificationDraft = Omit<NotificationRecord, "id" | "createdAt">;
export type NotificationItem = NotificationRecord & { time: string };
export type DemoUser = { id?: number; email?: string; username: string; password?: string; role: UserRole; name: string; title: string; department: string; scope?: string; active?: boolean };
export const demoUsers: DemoUser[] = [
  { username: "admin", password: "123456", role: "admin", name: "系统管理员", title: "系统管理员 · 平台运维", department: "系统管理" },
  { username: "chair", password: "123456", role: "chair", name: "徐介翰", title: "主席 · 全局统筹", department: "主席团" },
  { username: "leader", password: "123456", role: "leader", name: "陈雨桐", title: "运维部负责人", department: "运维部" },
  { username: "staff", password: "123456", role: "staff", name: "周子轩", title: "运维部干事", department: "运维部" },
  { username: "teacher", password: "123456", role: "teacher", name: "王明远", title: "指导教师 · 业务指导", department: "计算学院" },
];
export const roleProfiles: Record<UserRole, { name: string; title: string; initial: string }> = {
  admin: { name: "系统管理员", title: "平台运维与权限管理", initial: "管" },
  chair: { name: "徐介翰", title: "主席 · 全局统筹", initial: "徐" },
  leader: { name: "陈雨桐", title: "运维部负责人", initial: "陈" },
  staff: { name: "周子轩", title: "运维部干事", initial: "周" },
  teacher: { name: "王明远", title: "指导教师 · 业务指导", initial: "王" },
};

export const seedNotificationRecords: NotificationRecord[] = [
  { id: "seed-chair-review-2", recipientUsernames: ["chair"], title: "部门结办等待审核", detail: "运维部已提交“舞台音响设备确认”，请审核结果与凭据。", createdAt: "2026-08-16T09:45:00+08:00", level: "warning", entity: { type: "task", id: 2 } },
  { id: "seed-leader-risk-1", recipientUsernames: ["leader"], title: "主任务需要关注", detail: "“定制活动主题横幅”的经费审批尚未确认。", createdAt: "2026-08-16T09:20:00+08:00", level: "warning", entity: { type: "task", id: 1 } },
  { id: "seed-staff-assignment", recipientUsernames: ["staff"], title: "执行任务进行中", detail: "“核对灯光控台接口”已分派给你，请按要求提交凭据。", createdAt: "2026-08-16T09:10:00+08:00", level: "info", entity: { type: "subtask", id: "seed-light-console", parentTaskId: 3 } },
  { id: "seed-teacher-guidance", recipientUsernames: ["teacher"], title: "活动方案等待指导", detail: "计算学院十佳歌手比赛执行方案等待指导意见。", createdAt: "2026-08-16T08:50:00+08:00", level: "warning", entity: { type: "activity", id: "top-singer" } },
];
export type DelegatedStatus = "待开始" | "进行中" | "待验收" | "需修改" | "已完成";
export type DelegatedTask = { id?: string; parentTaskId?: number; title: string; parent: string; assignee: string; deadline: string; evidence: string; status: DelegatedStatus; completedBy?: string; completionNote?: string; attachments?: Attachment[]; lastAction?: string };

export const isSubtaskOf = (subtask: DelegatedTask, task: Task) => subtask.parentTaskId ? subtask.parentTaskId === task.id : subtask.parent === task.title;
export const initialSubtasks: DelegatedTask[] = [
  { id: "seed-light-console", parentTaskId: 3, title: "核对灯光控台接口", parent: "灯光控制方案与彩排", assignee: "周子轩", deadline: "9月22日 20:00", evidence: "接口照片 + 测试视频", status: "进行中", lastAction: "陈雨桐已分派给周子轩" },
];

export type AcademicSemester = "上学期" | "下学期";
export type ArchiveRecord = { id: string; academicYear: string; semester: AcademicSemester; activity: string; category: string; name: string; owner: string; time: string; size: string; key?: string; description?: string };

export const archiveRecords: ArchiveRecord[] = [
  { id: "a1", academicYear: "2026-2027学年", semester: "上学期", activity: "计算学院迎新晚会", category: "复盘记录", name: "迎新晚会执行复盘与改进清单", owner: "文艺部", time: "2026-09-08 16:40", size: "1.2 MB" },
  { id: "a2", academicYear: "2026-2027学年", semester: "上学期", activity: "十佳歌手比赛", category: "活动方案", name: "十佳歌手比赛执行方案 V3", owner: "文艺部", time: "2026-09-20 10:24", size: "3.8 MB" },
  { id: "a3", academicYear: "2026-2027学年", semester: "上学期", activity: "十佳歌手比赛", category: "设备资料", name: "舞台设备与备件清单", owner: "运维部", time: "2026-09-19 21:18", size: "860 KB" },
  { id: "a4", academicYear: "2026-2027学年", semester: "上学期", activity: "十佳歌手比赛", category: "采购凭证", name: "横幅供应商报价单", owner: "运维部", time: "2026-09-19 18:06", size: "2.1 MB" },
  { id: "a5", academicYear: "2026-2027学年", semester: "上学期", activity: "学院新闻摄影展", category: "宣传素材", name: "摄影展作品征集推文定稿", owner: "新媒体中心", time: "2026-09-18 20:30", size: "5.4 MB" },
  { id: "a6", academicYear: "2025-2026学年", semester: "下学期", activity: "毕业生晚会", category: "现场素材", name: "毕业生晚会现场精选照片", owner: "新媒体中心", time: "2026-06-16 11:20", size: "268 MB" },
  { id: "a7", academicYear: "2025-2026学年", semester: "下学期", activity: "程序设计竞赛", category: "活动方案", name: "竞赛组织方案与机房安排", owner: "PC部", time: "2026-04-12 09:15", size: "2.7 MB" },
  { id: "a8", academicYear: "2025-2026学年", semester: "上学期", activity: "迎新晚会", category: "设备资料", name: "音响灯光接线图与参数", owner: "运维部", time: "2025-09-10 22:05", size: "6.3 MB" },
  { id: "a9", academicYear: "2024-2025学年", semester: "下学期", activity: "十佳歌手比赛", category: "复盘记录", name: "十佳歌手赛后复盘纪要", owner: "主席团", time: "2025-05-28 14:10", size: "740 KB" },
];

export type ManagedAccount = { id?: number; email: string; username: string; password?: string; name: string; role: UserRole; department: string; title: string; scope: string; active: boolean };
export const seededAccounts: ManagedAccount[] = demoUsers.map((user) => ({ ...user, email: `${user.username}@demo.local`, scope: user.role === "admin" ? "系统配置与基础数据" : user.role === "chair" ? "当前届次全部业务" : user.role === "leader" ? `${user.department}及相关任务` : user.role === "teacher" ? "受邀指导活动" : "本人任务", active: true }));

export type SystemConfig = { attachmentLimit: string; academicYearMonth: string; semesterBoundary: string; notificationDays: string; backupTime: string };
export type ResearchItem = { id: string; name: string; requester: string; status: string; detail: string };

export type QuickFlowKind = "activity" | "archive" | "guidance" | "eventSettings" | "timeline";
export const quickFlowTitles: Record<QuickFlowKind, { kicker: string; title: string; submit: string }> = {
  activity: { kicker: "活动管理", title: "创建活动", submit: "保存活动" },
  archive: { kicker: "知识沉淀", title: "上传归档资料", submit: "确认归档" },
  guidance: { kicker: "指导教师工作流", title: "提交指导意见", submit: "发送给主席" },
  eventSettings: { kicker: "活动管理", title: "活动设置", submit: "保存设置" },
  timeline: { kicker: "活动进度", title: "关键时间线", submit: "关闭" },
};
