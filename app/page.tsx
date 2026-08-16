"use client";

import {
  Activity,
  Bell,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  ListTodo,
  LogIn,
  LogOut,
  MoreHorizontal,
  PackageCheck,
  Paperclip,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  MapPin,
  Upload,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import readXlsxFile from "read-excel-file";
import { useEffect, useMemo, useState } from "react";

type TaskStatus = "待开始" | "进行中" | "待验收" | "已完成";
type Attachment = { key: string; name: string; size: number; type?: string };
async function deleteAttachmentObject(file: Attachment) {
  if (!file.key) return;
  const response = await fetch(`/api/files?key=${encodeURIComponent(file.key)}`, { method: "DELETE" });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || "附件删除失败");
  }
}
type ControlMode = "快捷办结" | "凭据留痕" | "负责人确认";
type Task = {
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

type TaskDraft = {
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

function getControlMode(task: Task): ControlMode {
  if (task.controlMode) return task.controlMode;
  if (task.risk || task.kind === "技术保障") return "负责人确认";
  if (task.kind === "现场服务") return "凭据留痕";
  return "快捷办结";
}

const currentActivity = {
  name: "计算学院十佳歌手比赛",
  time: "2026年9月25日 18:30–21:30",
  location: "学生活动中心报告厅",
  liaisonTeacher: "王明远",
};

type ActivityRecord = {
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

const activityCatalog: ActivityRecord[] = [
  { id: "top-singer", name: currentActivity.name, category: "文体活动", state: "筹备中", date: "2026年9月25日", day: "25", month: "9月", time: "18:30–21:30", location: currentActivity.location, organizer: "文艺部", teacher: currentActivity.liaisonTeacher, progress: 67, pending: 5, departments: ["文艺部", "运维部", "新媒体中心", "心理部", "办公室", "生活部"], description: "面向全院学生举办的校园歌手赛事，统一协调舞台、宣传、现场服务与赛后报道。", nextMilestone: "9月23日 19:00 舞台联排", milestones: [{ date: "9月19日", title: "预热推文发布", owner: "新媒体中心", done: true }, { date: "9月20日", title: "横幅定稿与下单", owner: "运维部" }, { date: "9月23日", title: "舞台联排", owner: "文艺部、运维部" }, { date: "9月25日", title: "正式比赛", owner: "全体协作部门" }] },
  { id: "photo-exhibition", name: "学院新闻摄影展", category: "品牌宣传", state: "策划中", date: "2026年10月8日", day: "08", month: "10月", time: "全天", location: "计算机楼一楼展厅", organizer: "新媒体中心", teacher: "李静", progress: 35, pending: 7, departments: ["新媒体中心", "办公室", "实践部"], description: "征集并展出学院年度新闻摄影作品，完成作品评审、展陈设计与线上专题推送。", nextMilestone: "9月28日 作品征集截止", milestones: [{ date: "9月18日", title: "发布征集通知", owner: "新媒体中心", done: true }, { date: "9月28日", title: "作品征集截止", owner: "新媒体中心" }, { date: "10月3日", title: "完成评审与排版", owner: "评审组" }, { date: "10月8日", title: "开展与专题发布", owner: "新媒体中心" }] },
  { id: "operation-contest", name: "重大赛事运营策划大赛", category: "创新实践", state: "策划中", date: "2026年10月16日", day: "16", month: "10月", time: "14:00–18:00", location: "计算机楼学术报告厅", organizer: "新媒体中心", teacher: "赵峰", progress: 22, pending: 9, departments: ["新媒体中心", "实践部", "职规部"], description: "以真实赛事为背景开展运营方案设计、路演展示和专家评审。", nextMilestone: "9月26日 完成赛制与评分标准", milestones: [{ date: "9月20日", title: "立项与需求访谈", owner: "新媒体中心", done: true }, { date: "9月26日", title: "赛制与评分标准定稿", owner: "策划组" }, { date: "10月10日", title: "参赛方案收集", owner: "实践部" }, { date: "10月16日", title: "路演评审", owner: "执行组" }] },
  { id: "coding-contest", name: "新生程序设计竞赛", category: "科技竞赛", state: "待启动", date: "2026年10月12日", day: "12", month: "10月", time: "14:00–17:00", location: "计算机实验中心", organizer: "科创中心", teacher: "刘倩", progress: 18, pending: 6, departments: ["PC部", "运维部", "学习部", "新媒体中心"], description: "面向新生的程序设计入门竞赛，覆盖命题、报名、机房环境、监考与成绩发布。", nextMilestone: "9月30日 完成机房环境测试", milestones: [{ date: "9月22日", title: "竞赛通知定稿", owner: "PC部", done: true }, { date: "9月30日", title: "机房环境测试", owner: "运维部" }, { date: "10月8日", title: "报名与考场编排", owner: "PC部" }, { date: "10月12日", title: "正式比赛", owner: "科创中心" }] },
  { id: "career-sharing", name: "秋季校园招聘经验分享会", category: "职业发展", state: "待启动", date: "2026年10月20日", day: "20", month: "10月", time: "19:00–21:00", location: "计算机楼216", organizer: "职规部", teacher: "孙琳", progress: 8, pending: 4, departments: ["职规部", "新媒体中心", "办公室"], description: "邀请高年级同学分享秋招准备、简历优化和面试经验。", nextMilestone: "10月5日 确认分享嘉宾", milestones: [{ date: "10月5日", title: "确认分享嘉宾", owner: "职规部" }, { date: "10月10日", title: "发布报名推送", owner: "新媒体中心" }, { date: "10月18日", title: "场地与材料确认", owner: "办公室" }, { date: "10月20日", title: "现场分享", owner: "职规部" }] },
  { id: "welcome-night", name: "计算学院迎新晚会", category: "文体活动", state: "已结束", date: "2026年9月6日", day: "06", month: "9月", time: "19:00–21:30", location: "大学生活动中心", organizer: "文艺部", teacher: "王明远", progress: 100, pending: 0, departments: ["文艺部", "新媒体中心", "运维部", "生活部"], description: "面向新生的学院迎新晚会，活动执行已完成，当前进入资料归档与复盘阶段。", nextMilestone: "已完成，待复盘归档", milestones: [{ date: "9月2日", title: "节目联排", owner: "文艺部", done: true }, { date: "9月5日", title: "设备与场地验收", owner: "运维部", done: true }, { date: "9月6日", title: "正式演出", owner: "全体协作部门", done: true }, { date: "9月8日", title: "新闻稿与素材归档", owner: "新媒体中心", done: true }] },
];

const taskTypes = [
  { name: "物资制作", note: "横幅、海报、采购与制作", icon: PackageCheck },
  { name: "技术保障", note: "音响、灯光、网络与设备", icon: Settings },
  { name: "现场服务", note: "签到、清场、秩序与引导", icon: Users },
  { name: "宣传发布", note: "推文、海报、摄影与新闻", icon: FileText },
  { name: "新媒体制作", note: "活动拍摄、新闻稿、推送与视频", icon: Activity },
];

const dynamicSchemas: Record<string, { key: string; label: string; placeholder: string; type?: string }[]> = {
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

const emptyDraft: TaskDraft = {
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

const initialTasks: Task[] = [
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

const filters = ["全部任务", "待开始", "进行中", "待验收", "已完成"];

type ViewKey = "overview" | "activities" | "tasks" | "organization" | "archive" | "accounts" | "audit" | "settings";

const viewTitles: Record<ViewKey, { parent: string; title: string }> = {
  overview: { parent: "工作台", title: "主席总览" },
  activities: { parent: "业务管理", title: "活动管理" },
  tasks: { parent: "业务管理", title: "任务中心" },
  organization: { parent: "基础数据", title: "组织与成员" },
  archive: { parent: "知识沉淀", title: "资料归档" },
  accounts: { parent: "系统管理", title: "账号与权限" },
  audit: { parent: "系统管理", title: "审计日志" },
  settings: { parent: "系统管理", title: "功能配置" },
};

type OrgTerm = { id: number; name: string; startYear: number; endYear: number; isCurrent: boolean };
type OrgDepartment = { id: number; name: string; groupName: string; parentId: number | null; description: string; sortOrder: number };
type OrgMember = { id: number; termId: number; departmentId: number | null; name: string; studentNo: string; className: string; grade: string; major: string; phone: string; position: string; roleLevel: string };
type OrgSnapshot = { terms: OrgTerm[]; departments: OrgDepartment[]; members: OrgMember[]; selectedTermId: number };
type MemberImportRow = { rowNumber: number; name: string; studentNo: string; className: string; phone: string; department: string; position: string; roleLevel: "chair" | "leader" | "staff" | ""; errors: string[] };

const importHeaders = {
  name: ["姓名", "name"], studentNo: ["学号", "studentno"], className: ["班级", "classname"], phone: ["联系电话", "手机号", "phone"],
  department: ["所属部门", "部门", "department"], position: ["职务", "position"],
} as const;

function normalizeImportHeader(value: unknown) { return String(value ?? "").trim().replace(/[\s*＊_()-]/g, "").toLowerCase(); }
function importCell(value: unknown) { return value === null || value === undefined ? "" : String(value).trim(); }

function parseMemberImportRows(table: unknown[][], departments: OrgDepartment[]) {
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
    const roleLevel = roleMap[position] || "";
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

const blankMember = { id: 0, termId: 0, departmentId: null as number | null, name: "", studentNo: "", className: "", grade: "", major: "", phone: "", position: "干事", roleLevel: "staff" };
const fallbackAssignees: Record<string, { name: string; position: string; roleLevel: string }[]> = {
  运维部: [{ name: "陈雨桐", position: "负责人", roleLevel: "leader" }, { name: "周子轩", position: "干事", roleLevel: "staff" }],
  PC部: [{ name: "林浩然", position: "负责人", roleLevel: "leader" }],
  心理部: [{ name: "赵可欣", position: "负责人", roleLevel: "leader" }],
  文艺部: [{ name: "宋佳宁", position: "负责人", roleLevel: "leader" }],
  新媒体中心: [{ name: "许言", position: "负责人", roleLevel: "leader" }, { name: "苏禾", position: "干事", roleLevel: "staff" }],
  办公室: [{ name: "蒋明悦", position: "负责人", roleLevel: "leader" }],
};

function OrganizationManager({ notify, canManage = true }: { notify: (message: string) => void; canManage?: boolean }) {
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

function MediaActivities({ onBack, tasks, onOpenTask, role, user, activities, onCreateActivity, onEditActivity }: { onBack: () => void; tasks: Task[]; onOpenTask: (task: Task) => void; role: UserRole; user: DemoUser; activities: ActivityRecord[]; onCreateActivity: () => void; onEditActivity: (activity: ActivityRecord) => void }) {
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

type UserRole = "admin" | "chair" | "leader" | "staff" | "teacher";
type NotificationEntity = { type: "task" | "subtask" | "activity" | "account" | "archive" | "system"; id?: string | number; parentTaskId?: number };
type NotificationRecord = {
  id: string;
  recipientUsernames: string[];
  title: string;
  detail: string;
  createdAt: string;
  level?: "warning" | "success" | "info";
  entity?: NotificationEntity;
};
type NotificationDraft = Omit<NotificationRecord, "id" | "createdAt">;
type NotificationItem = NotificationRecord & { time: string };
type DemoUser = { id?: number; email?: string; username: string; password?: string; role: UserRole; name: string; title: string; department: string; scope?: string; active?: boolean };
const demoUsers: DemoUser[] = [
  { username: "admin", password: "123456", role: "admin", name: "系统管理员", title: "系统管理员 · 平台运维", department: "系统管理" },
  { username: "chair", password: "123456", role: "chair", name: "徐介翰", title: "主席 · 全局统筹", department: "主席团" },
  { username: "leader", password: "123456", role: "leader", name: "陈雨桐", title: "运维部负责人", department: "运维部" },
  { username: "staff", password: "123456", role: "staff", name: "周子轩", title: "运维部干事", department: "运维部" },
  { username: "teacher", password: "123456", role: "teacher", name: "王明远", title: "指导教师 · 业务指导", department: "计算学院" },
];
const roleProfiles: Record<UserRole, { name: string; title: string; initial: string }> = {
  admin: { name: "系统管理员", title: "平台运维与权限管理", initial: "管" },
  chair: { name: "徐介翰", title: "主席 · 全局统筹", initial: "徐" },
  leader: { name: "陈雨桐", title: "运维部负责人", initial: "陈" },
  staff: { name: "周子轩", title: "运维部干事", initial: "周" },
  teacher: { name: "王明远", title: "指导教师 · 业务指导", initial: "王" },
};

function LoginScreen({ onLogin, onReset }: { onLogin: (username: string, password: string) => string | null; onReset: () => void }) {
  const [username, setUsername] = useState("chair");
  const [password, setPassword] = useState("123456");
  const [error, setError] = useState("");
  const accounts = seededAccounts;
  const submit = (event: React.FormEvent) => { event.preventDefault(); const result = onLogin(username.trim(), password); setError(result || ""); };
  return <main className="login-page"><section className="login-brand"><div className="brand-mark large">CS</div><span>计算学院</span><h1>学生联盟管理系统</h1><p>活动、任务、资料与组织成员管理</p><div className="login-workflow"><span><i>1</i>主席发布主任务</span><span><i>2</i>负责人拆解与验收</span><span><i>3</i>干事执行并提交凭据</span><span><i>4</i>主席审核部门结办</span></div></section><section className="login-panel"><form onSubmit={submit}><header><span>内部系统</span><h2>登录工作台</h2></header><label><span>账号</span><select value={username} onChange={(event) => { setUsername(event.target.value); setError(""); }}>{accounts.filter((account) => account.active).map((account) => <option key={account.username} value={account.username}>{account.role === "admin" ? "系统管理员" : account.role === "chair" ? "主席" : account.role === "leader" ? "部门负责人" : account.role === "teacher" ? "指导教师" : "干事"} · {account.username}</option>)}</select></label><label><span>密码</span><input type="password" value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }}/></label>{error && <div className="login-error">{error}</div>}<button className="primary-button login-submit" type="submit"><LogIn size={17}/>登录系统</button><footer><span>演示密码 <strong>123456</strong></span><button type="button" onClick={() => { setUsername("chair"); onReset(); }}>重置演示数据</button></footer></form></section></main>;
}

const seedNotificationRecords: NotificationRecord[] = [
  { id: "seed-chair-review-2", recipientUsernames: ["chair"], title: "部门结办等待审核", detail: "运维部已提交“舞台音响设备确认”，请审核结果与凭据。", createdAt: "2026-08-16T09:45:00+08:00", level: "warning", entity: { type: "task", id: 2 } },
  { id: "seed-leader-risk-1", recipientUsernames: ["leader"], title: "主任务需要关注", detail: "“定制活动主题横幅”的经费审批尚未确认。", createdAt: "2026-08-16T09:20:00+08:00", level: "warning", entity: { type: "task", id: 1 } },
  { id: "seed-staff-assignment", recipientUsernames: ["staff"], title: "执行任务进行中", detail: "“核对灯光控台接口”已分派给你，请按要求提交凭据。", createdAt: "2026-08-16T09:10:00+08:00", level: "info", entity: { type: "subtask", id: "seed-light-console", parentTaskId: 3 } },
  { id: "seed-teacher-guidance", recipientUsernames: ["teacher"], title: "活动方案等待指导", detail: "计算学院十佳歌手比赛执行方案等待指导意见。", createdAt: "2026-08-16T08:50:00+08:00", level: "warning", entity: { type: "activity", id: "top-singer" } },
];
type DelegatedStatus = "待开始" | "进行中" | "待验收" | "需修改" | "已完成";
type DelegatedTask = { id?: string; parentTaskId?: number; title: string; parent: string; assignee: string; deadline: string; evidence: string; status: DelegatedStatus; completedBy?: string; completionNote?: string; attachments?: Attachment[]; lastAction?: string };

function TextEntryModal({ title, description, label, initialValue, confirmText, onCancel, onConfirm }: { title: string; description: string; label: string; initialValue: string; confirmText: string; onCancel: () => void; onConfirm: (value: string) => void }) {
  const [value, setValue] = useState(initialValue);
  return <div className="modal-backdrop nested"><div className="text-entry-modal" role="dialog" aria-modal="true" aria-labelledby="text-entry-title"><header><div><span>任务处理</span><h2 id="text-entry-title">{title}</h2></div><button className="icon-button" onClick={onCancel} aria-label="关闭"><X size={18}/></button></header><div className="text-entry-body"><p>{description}</p><label><span>{label}</span><textarea rows={4} value={value} onChange={(event) => setValue(event.target.value)} /></label></div><footer><button className="outline-button" onClick={onCancel}>取消</button><button className="primary-button" disabled={!value.trim()} onClick={() => onConfirm(value.trim())}>{confirmText}</button></footer></div></div>;
}

function ConfirmActionModal({ title, description, confirmText, onCancel, onConfirm }: { title: string; description: string; confirmText: string; onCancel: () => void; onConfirm: () => void }) {
  return <div className="modal-backdrop nested"><div className="confirm-action-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-action-title"><header><div><span>请确认操作</span><h2 id="confirm-action-title">{title}</h2></div><button className="icon-button" onClick={onCancel} aria-label="关闭"><X size={18}/></button></header><div><CircleAlert size={20}/><p>{description}</p></div><footer><button className="outline-button" onClick={onCancel}>取消</button><button className="danger-confirm-button" onClick={onConfirm}>{confirmText}</button></footer></div></div>;
}

const isSubtaskOf = (subtask: DelegatedTask, task: Task) => subtask.parentTaskId ? subtask.parentTaskId === task.id : subtask.parent === task.title;
const initialSubtasks: DelegatedTask[] = [
  { id: "seed-light-console", parentTaskId: 3, title: "核对灯光控台接口", parent: "灯光控制方案与彩排", assignee: "周子轩", deadline: "9月22日 20:00", evidence: "接口照片 + 测试视频", status: "进行中", lastAction: "陈雨桐已分派给周子轩" },
];

function LeaderTaskWorkspace({ user, accounts, tasks, subtasks, setSubtasks, onOpenTask, onStartMain, onSubmitMain, onWithdrawMain, notify, pushNotification, resolveUsernames, notifications }: { user: DemoUser; accounts: ManagedAccount[]; tasks: Task[]; subtasks: DelegatedTask[]; setSubtasks: React.Dispatch<React.SetStateAction<DelegatedTask[]>>; onOpenTask: (task: Task) => void; onStartMain: (task: Task) => void; onSubmitMain: (task: Task) => void; onWithdrawMain: (task: Task) => void; notify: (message: string) => void; pushNotification: (draft: NotificationDraft) => void; resolveUsernames: (options: { names?: string[]; roles?: UserRole[]; department?: string }) => string[]; notifications: NotificationItem[] }) {
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

  function submitDelegation() {
    if (!selectedTask || !draft.title.trim()) return;
    const id = `subtask-${Date.now()}`;
    setSubtasks((current) => [...current, { ...draft, id, parentTaskId: selectedTask.id, parent: selectedTask.title, deadline: draft.deadline.replace("T", " "), status: "待开始" }]);
    pushNotification({ recipientUsernames: resolveUsernames({ names: [draft.assignee] }), title: "收到新的执行任务", detail: `负责人${leaderName}将“${draft.title}”分派给你，截止${draft.deadline.replace("T", " ")}。`, level: "warning", entity: { type: "subtask", id, parentTaskId: selectedTask.id } });
    setShowDelegation(false);
    notify(`“${draft.title}”已分派给${draft.assignee}`);
  }

  function completeSubtask(task: DelegatedTask) {
    setSubtasks((current) => current.map((item) => (item.id || `${item.parent}-${item.title}`) === (task.id || `${task.parent}-${task.title}`) ? { ...item, status: "已完成", completedBy: "负责人直接办结", lastAction: `${leaderName}刚刚直接办结` } : item));
    pushNotification({ recipientUsernames: resolveUsernames({ names: [task.assignee] }), title: "子任务已由负责人办结", detail: `“${task.title}”已直接标记为完成，无需继续提交。`, level: "success", entity: { type: "subtask", id: task.id, parentTaskId: task.parentTaskId } });
    notify(`“${task.title}”已由负责人直接办结，操作已记入动态`);
  }

  function cancelSubtask(task: DelegatedTask) {
    setSubtasks((current) => current.filter((item) => (item.id || `${item.parent}-${item.title}`) !== (task.id || `${task.parent}-${task.title}`)));
    pushNotification({ recipientUsernames: resolveUsernames({ names: [task.assignee] }), title: "子任务已撤销", detail: `负责人已撤销“${task.title}”，无需继续执行或提交。`, level: "warning", entity: { type: "subtask", id: task.id, parentTaskId: task.parentTaskId } });
    setCancellationTarget(null);
    notify(`“${task.title}”已撤销`);
  }

  function reviewSubtask(task: DelegatedTask, approved: boolean, reason = "") {
    if (!approved && !reason) {
      setRejectionTarget(task);
      return;
    }
    setSubtasks((current) => current.map((item) => (item.id || `${item.parent}-${item.title}`) === (task.id || `${task.parent}-${task.title}`) ? { ...item, status: approved ? "已完成" : "需修改", completedBy: approved ? "负责人验收通过" : undefined, lastAction: approved ? `${leaderName}刚刚验收通过` : `${leaderName}退回：${reason}` } : item));
    pushNotification({ recipientUsernames: resolveUsernames({ names: [task.assignee] }), title: approved ? "子任务验收通过" : "子任务被退回修改", detail: approved ? `“${task.title}”已由负责人验收通过。` : `“${task.title}”需要修改：${reason}`, level: approved ? "success" : "warning", entity: { type: "subtask", id: task.id, parentTaskId: task.parentTaskId } });
    notify(approved ? `“${task.title}”已验收通过` : `“${task.title}”已退回修改`);
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

function StaffDashboard({ user, tasks, subtasks, setSubtasks, notify, pushNotification, resolveUsernames, notifications }: { user: DemoUser; tasks: Task[]; subtasks: DelegatedTask[]; setSubtasks: React.Dispatch<React.SetStateAction<DelegatedTask[]>>; notify: (message: string) => void; pushNotification: (draft: NotificationDraft) => void; resolveUsernames: (options: { names?: string[]; roles?: UserRole[]; department?: string }) => string[]; notifications: NotificationItem[] }) {
  const [uploadingId, setUploadingId] = useState("");
  const [submissionTarget, setSubmissionTarget] = useState<DelegatedTask | null>(null);
  const mySubtasks = subtasks.filter((task) => task.assignee === user.name);
  const updateSubtask = (target: DelegatedTask, patch: Partial<DelegatedTask>) => setSubtasks((current) => current.map((item) => (item.id || `${item.parent}-${item.title}`) === (target.id || `${target.parent}-${target.title}`) ? { ...item, ...patch } : item));
  const uploadEvidence = async (target: DelegatedTask, files: FileList | null) => {
    if (!files?.length) return;
    setUploadingId(target.id || target.title);
    const uploaded: Attachment[] = []; const errors: string[] = [];
    for (const file of Array.from(files)) {
      const form = new FormData(); form.append("file", file);
      const response = await fetch("/api/files", { method: "POST", body: form });
      const result = await response.json();
      if (response.ok) uploaded.push(result.attachment); else errors.push(`${file.name}：${result.error || "上传失败"}`);
    }
    updateSubtask(target, { attachments: [...(target.attachments || []), ...uploaded], status: target.status === "待开始" ? "进行中" : target.status, lastAction: `${user.name}刚刚上传${uploaded.length}个凭据` });
    setUploadingId(""); notify(errors.length ? errors[0] : `已上传${uploaded.length}个完成凭据`);
  };
  const removeEvidence = async (target: DelegatedTask, file: Attachment) => {
    try {
      await deleteAttachmentObject(file);
      updateSubtask(target, { attachments: (target.attachments || []).filter((item) => item.key !== file.key), lastAction: `${user.name}刚刚删除附件“${file.name}”` });
      notify(`已删除“${file.name}”`);
    } catch (error) { notify(error instanceof Error ? error.message : "附件删除失败"); }
  };
  const submit = (target: DelegatedTask) => {
    setSubmissionTarget(target);
  };
  const start = (target: DelegatedTask) => {
    updateSubtask(target, { status: "进行中", lastAction: `${user.name}刚刚开始执行` });
    pushNotification({ recipientUsernames: resolveUsernames({ roles: ["leader"], department: user.department }), title: "子任务已开始", detail: `${user.name}已开始执行“${target.title}”。`, level: "info", entity: { type: "subtask", id: target.id, parentTaskId: target.parentTaskId } });
  };
  const confirmSubmit = (target: DelegatedTask, note: string) => {
    updateSubtask(target, { status: "待验收", completionNote: note, lastAction: `${user.name}刚刚提交负责人验收` });
    pushNotification({ recipientUsernames: resolveUsernames({ roles: ["leader"], department: user.department }), title: "子任务等待验收", detail: `${user.name}已提交“${target.title}”，请检查完成说明和凭据。`, level: "warning", entity: { type: "subtask", id: target.id, parentTaskId: target.parentTaskId } });
    notify(`“${target.title}”已提交负责人验收`);
    setSubmissionTarget(null);
  };
  const withdrawSubmission = (target: DelegatedTask) => {
    updateSubtask(target, { status: "进行中", lastAction: `${user.name}刚刚撤回验收申请，继续修改` });
    pushNotification({ recipientUsernames: resolveUsernames({ roles: ["leader"], department: user.department }), title: "执行人已撤回提交", detail: `${user.name}撤回了“${target.title}”的验收申请，将修改后再次提交。`, level: "info", entity: { type: "subtask", id: target.id, parentTaskId: target.parentTaskId } });
    notify(`“${target.title}”已撤回，可继续修改`);
  };
  const completed = mySubtasks.filter((task) => task.status === "已完成").length;
  return <div className="role-dashboard staff-dashboard"><div className="role-welcome"><div><span>我的执行工作台</span><h1>你好，{user.name}</h1></div><div className="role-badge"><CheckCircle2 size={18}/><span><strong>本期完成 {completed} 项</strong>待处理 {mySubtasks.length - completed} 项</span></div></div><div className="staff-focus"><section><div className="section-head"><div><h2>我的任务</h2></div></div>{mySubtasks.map((task) => { const parent = tasks.find((item) => task.parentTaskId ? item.id === task.parentTaskId : item.title === task.parent); const parentLocked = parent ? ["待验收","已完成"].includes(parent.status) : false; const canSubmit = Boolean(task.attachments?.length); const canEditEvidence = !parentLocked && !["待验收","已完成"].includes(task.status); return <article key={task.id || task.title} className={task.status === "需修改" ? "needs-revision" : ""}><header><span className="tag">来自：{task.parent}</span><i className={`status status-${task.status}`}>{task.status}</i></header><h3>{task.title}</h3><div className="task-context-inline"><span><CalendarDays size={14}/>{parent?.activityTime || currentActivity.time}</span><span><MapPin size={14}/>{parent?.activityLocation || currentActivity.location}</span><span><Clock3 size={14}/>截止 {task.deadline}</span></div><p>{task.status === "需修改" ? task.lastAction : `完成要求：${task.evidence}`}</p>{task.attachments?.length ? <div className="staff-evidence-list">{task.attachments.map((file) => <span key={file.key}><FileText size={13}/><b>{file.name}</b>{canEditEvidence && <button title="删除附件" aria-label={`删除${file.name}`} onClick={() => removeEvidence(task,file)}><X size={12}/></button>}</span>)}</div> : <div className="staff-no-evidence">尚未上传完成凭据</div>}<footer>{canEditEvidence && <label className="outline-button staff-upload"><Paperclip size={14}/>{uploadingId === (task.id || task.title) ? "上传中" : "上传凭据"}<input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip" multiple disabled={Boolean(uploadingId)} onChange={(event) => { const files = event.currentTarget.files; event.currentTarget.value = ""; uploadEvidence(task,files); }}/></label>}{task.status === "待开始" && !parentLocked && <button className="primary-button" onClick={() => start(task)}>开始任务</button>}{["进行中","需修改"].includes(task.status) && !parentLocked && <button className="primary-button" disabled={!canSubmit} onClick={() => submit(task)}><Upload size={15}/>提交负责人</button>}{task.status === "待验收" && <><span>等待负责人验收</span><button className="outline-button" onClick={() => withdrawSubmission(task)}><RotateCcw size={14}/>撤回提交</button></>}{task.status === "已完成" && <span className="completed-label"><CheckCircle2 size={15}/>已完成</span>}{parentLocked && task.status !== "已完成" && <span>主任务已锁定</span>}</footer></article>; })}{!mySubtasks.length && <div className="staff-empty"><ClipboardCheck size={22}/><strong>当前没有分派给你的任务</strong></div>}</section><aside><h2>我的通知</h2>{notifications.slice(0,3).map(item => <article key={item.id} className={item.level || ""}><Bell size={16}/><span><strong>{item.title}</strong><p>{item.detail}</p><small>{item.time}</small></span></article>)}</aside></div>{submissionTarget && <TextEntryModal title="提交完成结果" description={`请说明“${submissionTarget.title}”的实际完成情况，负责人验收时会看到这段说明。`} label="完成说明" initialValue={submissionTarget.completionNote || "已按要求完成并上传凭据"} confirmText="提交负责人验收" onCancel={() => setSubmissionTarget(null)} onConfirm={(note) => confirmSubmit(submissionTarget, note)}/>}</div>;
}

function TeacherDashboard({ user, tasks, activities, onOpenTask, notify }: { user: DemoUser; tasks: Task[]; activities: ActivityRecord[]; onOpenTask: (task: Task) => void; notify: (message: string) => void }) {
  const guidedActivities = activities.filter((activity) => activity.teacher === user.name).slice(0,3);
  const risks = tasks.filter((task) => task.risk || task.status === "待验收").slice(0,4);
  return <div className="role-dashboard teacher-dashboard"><div className="role-welcome"><div><span>指导教师工作台</span><h1>您好，{user.name}教师</h1></div><div className="role-badge"><ShieldCheck size={18}/><span><strong>指导与监督</strong>仅查看授权活动 · 意见全程留痕</span></div></div><div className="role-stats"><button onClick={() => notify("已打开方案审核，可填写指导意见")}><span>待指导材料</span><strong>2</strong><small>方案与重大变更</small></button><button onClick={() => notify("打开指导活动")}><span>指导活动</span><strong>{guidedActivities.length}</strong><small>按活动授权查看</small></button><div><span>本月已反馈</span><strong>6</strong><small>指导意见与复盘</small></div></div><div className="role-layout"><section><div className="section-head"><div><h2>待指导事项</h2></div></div><div className="teacher-review-list"><article><i className="warning"><CircleAlert size={17}/></i><span><strong>十佳歌手比赛执行方案 V3</strong><small>主席徐介翰提交 · 等待指导意见</small></span><button onClick={() => notify("已打开方案审核，可填写指导意见")}>查看并指导</button></article>{risks.map((task) => <article key={task.id}><i><FileText size={17}/></i><span><strong>{task.title}</strong><small>{task.department} · {task.status}</small></span><button onClick={() => onOpenTask(task)}>查看材料</button></article>)}</div></section><aside><h2>指导活动</h2>{guidedActivities.map((activity) => <article key={activity.id}><Activity size={16}/><span><strong>{activity.name}</strong><p>{activity.date} · {activity.location}</p><small>{activity.state} · {activity.progress}%</small></span></article>)}</aside></div></div>;
}

function AdminDashboard({ notify, accounts }: { notify: (message: string) => void; accounts: ManagedAccount[] }) {
  return <div className="admin-dashboard"><div className="module-header"><div><span className="module-kicker">系统治理工作台</span><h1>系统管理总览</h1></div><span className="admin-boundary"><ShieldCheck size={16}/>技术权限与业务权限已隔离</span></div><div className="admin-health"><div><span>账号状态</span><strong>{accounts.filter((item) => item.active).length} / {accounts.length}</strong><small>启用账号</small></div><div><span>待分配角色</span><strong>{accounts.filter((item) => !item.active).length}</strong><small>停用账号</small></div><div><span>附件存储</span><strong>正常</strong><small>对象存储可用</small></div><div><span>数据备份</span><strong>已完成</strong><small>每日 23:30</small></div></div><div className="admin-layout"><section><header><div><span>访问控制</span><h2>关键账号与数据范围</h2></div><button onClick={() => notify("已进入账号与权限管理")}>管理全部账号<ChevronRight size={14}/></button></header><div className="admin-account-head"><span>用户</span><span>业务身份</span><span>数据范围</span><span>状态</span></div>{accounts.map((account) => <button key={account.name} onClick={() => notify(`已打开${account.name}的权限信息`)}><span><i>{account.name.slice(0,1)}</i><strong>{account.name}</strong></span><span>{account.role === "admin" ? "系统管理员" : account.role === "chair" ? "主席" : account.role === "leader" ? "负责人" : account.role === "teacher" ? "指导教师" : "干事"}</span><span>{account.scope}</span><em>{account.active ? "正常" : "停用"}</em></button>)}</section><aside><header><span>管理员待办</span><h2>需要处理</h2></header><button onClick={() => notify("已打开待分配角色列表")}><UserPlus size={17}/><span><strong>{accounts.filter((item) => !item.active).length}个账号当前停用</strong><small>账号状态管理</small></span><ChevronRight size={14}/></button><button onClick={() => notify("已打开权限变更记录")}><ShieldCheck size={17}/><span><strong>1项权限变更待复核</strong><small>负责人调整为普通成员</small></span><ChevronRight size={14}/></button><button onClick={() => notify("已打开运行日志")}><FileText size={17}/><span><strong>今日运行记录正常</strong><small>无失败上传和数据异常</small></span><ChevronRight size={14}/></button></aside></div></div>;
}

function RoleDashboard({ user, accounts, role, tasks, activities, subtasks, setSubtasks, onOpenTask, onStartMain, onSubmitMain, onWithdrawMain, notify, pushNotification, resolveUsernames, notifications }: { user: DemoUser; accounts: ManagedAccount[]; role: UserRole; tasks: Task[]; activities: ActivityRecord[]; subtasks: DelegatedTask[]; setSubtasks: React.Dispatch<React.SetStateAction<DelegatedTask[]>>; onOpenTask: (task: Task) => void; onStartMain: (task: Task) => void; onSubmitMain: (task: Task) => void; onWithdrawMain: (task: Task) => void; notify: (message: string) => void; pushNotification: (draft: NotificationDraft) => void; resolveUsernames: (options: { names?: string[]; roles?: UserRole[]; department?: string }) => string[]; notifications: NotificationItem[] }) {
  if (role === "admin") return <AdminDashboard notify={notify} accounts={accounts}/>;
  if (role === "leader") return <LeaderTaskWorkspace user={user} accounts={accounts} tasks={tasks} subtasks={subtasks} setSubtasks={setSubtasks} onOpenTask={onOpenTask} onStartMain={onStartMain} onSubmitMain={onSubmitMain} onWithdrawMain={onWithdrawMain} notify={notify} pushNotification={pushNotification} resolveUsernames={resolveUsernames} notifications={notifications}/>;

  if (role === "teacher") return <TeacherDashboard user={user} tasks={tasks} activities={activities} onOpenTask={onOpenTask} notify={notify}/>;
  return <StaffDashboard user={user} tasks={tasks} subtasks={subtasks} setSubtasks={setSubtasks} notify={notify} pushNotification={pushNotification} resolveUsernames={resolveUsernames} notifications={notifications}/>;
}

function ChairOverview({ tasks, activities, onOpenTask, onOpenActivities, onOpenTasks, onCreateTask }: { tasks: Task[]; activities: ActivityRecord[]; onOpenTask: (task: Task) => void; onOpenActivities: () => void; onOpenTasks: () => void; onCreateTask: () => void }) {
  const activeActivities = activities.filter((activity) => activity.state !== "已结束");
  const reviewTasks = tasks.filter((task) => task.status === "待验收");
  const riskTasks = tasks.filter((task) => task.risk && task.status !== "已完成");
  const attentionTasks = [...reviewTasks, ...riskTasks.filter((task) => !reviewTasks.some((item) => item.id === task.id)), ...tasks.filter((task) => task.status === "待开始")].slice(0, 6);
  const departments = Array.from(new Set(tasks.map((task) => task.department))).map((department) => { const items = tasks.filter((task) => task.department === department); const done = items.filter((task) => task.status === "已完成").length; return { department, total: items.length, done, review: items.filter((task) => task.status === "待验收").length, progress: items.length ? Math.round(done / items.length * 100) : 0 }; }).sort((a,b) => b.total - a.total);
  return <div className="chair-overview-page"><div className="chair-overview-head"><div><span className="module-kicker">全局监督工作台</span><h1>主席总览</h1></div><button className="primary-button" onClick={onCreateTask}><Plus size={17}/>发布任务</button></div><section className="chair-summary-strip"><button onClick={onOpenActivities}><Activity size={19}/><span><strong>{activeActivities.length}</strong><small>正在推进的活动</small></span><ChevronRight size={16}/></button><button onClick={onOpenTasks}><ClipboardCheck size={19}/><span><strong>{reviewTasks.length}</strong><small>等待主席审核</small></span><ChevronRight size={16}/></button><button className={riskTasks.length ? "attention" : ""} onClick={() => riskTasks[0] ? onOpenTask(riskTasks[0]) : onOpenTasks()}><CircleAlert size={19}/><span><strong>{riskTasks.length}</strong><small>风险与阻塞事项</small></span><ChevronRight size={16}/></button><button onClick={onOpenTasks}><Clock3 size={19}/><span><strong>{tasks.filter((task) => task.status === "待开始").length}</strong><small>等待启动的任务</small></span><ChevronRight size={16}/></button></section><div className="chair-overview-grid"><section className="chair-attention"><header><div><span>决策队列</span><h2>需要你处理</h2></div><button onClick={onOpenTasks}>全部任务<ChevronRight size={14}/></button></header><div className="chair-attention-list">{attentionTasks.map((task) => <button key={task.id} onClick={() => onOpenTask(task)}><i className={task.status === "待验收" ? "review" : task.risk ? "risk" : "start"}>{task.status === "待验收" ? <ClipboardCheck size={15}/> : task.risk ? <CircleAlert size={15}/> : <Clock3 size={15}/>}</i><span><strong>{task.title}</strong><small>{task.activityName || currentActivity.name} · {task.department} / {task.person}</small></span><span><b>{task.status === "待验收" ? "审核结果" : task.risk ? "查看风险" : "尚未开始"}</b><small>{task.deadline}</small></span><ChevronRight size={15}/></button>)}{!attentionTasks.length && <div className="chair-all-clear"><CheckCircle2 size={22}/><strong>当前没有待处理事项</strong></div>}</div></section><aside className="chair-activities"><header><div><span>活动进度</span><h2>近期活动</h2></div><button onClick={onOpenActivities}>活动中心<ChevronRight size={14}/></button></header>{activeActivities.slice(0,4).map((activity) => <button key={activity.id} onClick={onOpenActivities}><span className={`activity-state state-${activity.state}`}>{activity.state}</span><span><strong>{activity.name}</strong><small>{activity.date} · {activity.organizer}</small></span><b>{activity.progress}%</b></button>)}</aside></div><section className="chair-department-pulse"><header><div><span>执行监督</span><h2>部门任务概况</h2></div><small>按照当前任务实时汇总</small></header><div className="department-pulse-head"><span>部门</span><span>任务数</span><span>完成进度</span><span>待验收</span></div>{departments.map((item) => <div key={item.department}><strong>{item.department}</strong><span>{item.total} 项</span><span><i><em style={{width:`${item.progress}%`}}/></i><b>{item.progress}%</b></span><span>{item.review ? `${item.review} 项` : "无"}</span></div>)}</section></div>;
}

type AcademicSemester = "上学期" | "下学期";
type ArchiveRecord = { id: string; academicYear: string; semester: AcademicSemester; activity: string; category: string; name: string; owner: string; time: string; size: string; key?: string; description?: string };

const archiveRecords: ArchiveRecord[] = [
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

function ArchiveWorkspace({ role, records, onUpload }: { role: UserRole; records: ArchiveRecord[]; onUpload: () => void }) {
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

type ManagedAccount = { id?: number; email: string; username: string; password?: string; name: string; role: UserRole; department: string; title: string; scope: string; active: boolean };
const seededAccounts: ManagedAccount[] = demoUsers.map((user) => ({ ...user, email: `${user.username}@demo.local`, scope: user.role === "admin" ? "系统配置与基础数据" : user.role === "chair" ? "当前届次全部业务" : user.role === "leader" ? `${user.department}及相关任务` : user.role === "teacher" ? "受邀指导活动" : "本人任务", active: true }));

function AccountsWorkspace({ notify, pushNotification }: { notify: (message: string) => void; pushNotification: (draft: NotificationDraft) => void }) {
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

const auditRecords = [
  { actor:"系统管理员", action:"为新成员分配干事权限", target:"周子轩", time:"今天 10:32", type:"权限变更" },
  { actor:"主席徐介翰", action:"审核通过部门结办", target:"舞台音响设备确认", time:"今天 09:48", type:"业务审核" },
  { actor:"运维部负责人陈雨桐", action:"直接办结子任务", target:"确认备用麦克风", time:"昨天 21:16", type:"业务审核" },
  { actor:"系统管理员", action:"完成当前届次数据备份", target:"2026-2027届", time:"昨天 23:30", type:"数据维护" },
];

function AuditWorkspace({ notify }: { notify: (message: string) => void }) {
  const [filter, setFilter] = useState("全部操作");
  const visible = filter === "全部操作" ? auditRecords : auditRecords.filter((item) => item.type === filter);
  const exportLog = () => {
    const csv = ["操作人,操作,对象,类型,时间", ...visible.map((item) => [item.actor,item.action,item.target,item.type,item.time].map((cell) => `"${cell}"`).join(","))].join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob(["\ufeff",csv], { type: "text/csv;charset=utf-8" })); link.download = "学生联盟审计日志.csv"; link.click(); URL.revokeObjectURL(link.href); notify("审计日志已导出");
  };
  return <div className="module-page"><div className="module-header"><div><span className="module-kicker">最近30天</span><h1>审计日志</h1></div><button className="outline-button" onClick={exportLog}><Upload size={16}/>导出日志</button></div><div className="audit-filters">{["全部操作","权限变更","业务审核","数据维护"].map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}<span>{visible.length} 条记录</span></div><div className="audit-list">{visible.map((item,index) => <article key={`${item.time}-${index}`}><i><FileText size={15}/></i><span><strong>{item.action}</strong><small>{item.actor} · {item.target}</small></span><em>{item.type}</em><time>{item.time}</time></article>)}{!visible.length && <div className="archive-empty"><FileText size={22}/><strong>当前筛选没有记录</strong></div>}</div></div>;
}

type SystemConfig = { attachmentLimit: string; academicYearMonth: string; semesterBoundary: string; notificationDays: string; backupTime: string };
type ResearchItem = { id: string; name: string; requester: string; status: string; detail: string };
function SettingsWorkspace({ role, notify }: { role: UserRole; notify: (message: string) => void }) {
  const [config, setConfig] = useState<SystemConfig>({ attachmentLimit:"20", academicYearMonth:"8", semesterBoundary:"按学院校历", notificationDays:"180", backupTime:"23:30" });
  const [editingConfig, setEditingConfig] = useState(false);
  const [research, setResearch] = useState<ResearchItem[]>([{id:"venue",name:"场地申请与审批",requester:"办公室",status:"待调研",detail:"梳理场地借用、时间冲突和审批记录。"}, {id:"expense",name:"经费报销与凭证",requester:"运维部",status:"待调研",detail:"记录预算、票据和报销进度。"}, {id:"duty",name:"值班与排班管理",requester:"主席团",status:"评估中",detail:"按活动安排值班人员和签到。"}, {id:"signup",name:"活动报名与签到",requester:"实践部",status:"评估中",detail:"统一报名名单和现场签到。"}]);
  const [editingResearch, setEditingResearch] = useState<ResearchItem | null>(null);
  useEffect(() => { fetch("/api/state").then((response) => response.ok ? response.json() : null).then((result) => { if (result?.state?.systemConfig) setConfig(result.state.systemConfig); if (Array.isArray(result?.state?.research)) setResearch(result.state.research); }).catch(() => undefined); }, []);
  const saveConfig = () => { void fetch("/api/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "systemConfig", value: config }) }); setEditingConfig(false); notify("系统配置已保存"); };
  const saveResearch = () => { if (!editingResearch?.name.trim()) return; const next = research.some((item) => item.id === editingResearch.id) ? research.map((item) => item.id === editingResearch.id ? editingResearch : item) : [...research, editingResearch]; setResearch(next); void fetch("/api/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "research", value: next }) }); setEditingResearch(null); notify("调研需求已保存"); };
  if (role === "admin") return <div className="module-page"><div className="module-header"><div><span className="module-kicker">平台运行规则</span><h1>系统配置</h1></div><button className="primary-button" onClick={() => setEditingConfig(true)}><Settings size={17}/>编辑配置</button></div><div className="settings-grid">{[{label:"附件单文件限制",value:`${config.attachmentLimit} MB`},{label:"学年切换月份",value:`${config.academicYearMonth} 月`},{label:"学期分界",value:config.semesterBoundary},{label:"通知保留时间",value:`${config.notificationDays} 天`},{label:"每日备份时间",value:config.backupTime}].map((item) => <section key={item.label}><small>{item.label}</small><strong>{item.value}</strong></section>)}</div>{editingConfig && <div className="modal-backdrop"><div className="member-modal"><header><div><span>系统配置</span><h2>运行规则</h2></div><button className="icon-button" onClick={() => setEditingConfig(false)}><X size={18}/></button></header><div className="form-grid"><label><span>附件限制（MB）</span><input type="number" value={config.attachmentLimit} onChange={(e) => setConfig({...config,attachmentLimit:e.target.value})}/></label><label><span>学年切换月份</span><select value={config.academicYearMonth} onChange={(e) => setConfig({...config,academicYearMonth:e.target.value})}>{Array.from({length:12},(_,i) => <option key={i+1} value={String(i+1)}>{i+1}月</option>)}</select></label><label><span>学期分界</span><input value={config.semesterBoundary} onChange={(e) => setConfig({...config,semesterBoundary:e.target.value})}/></label><label><span>通知保留天数</span><input type="number" value={config.notificationDays} onChange={(e) => setConfig({...config,notificationDays:e.target.value})}/></label><label><span>每日备份时间</span><input type="time" value={config.backupTime} onChange={(e) => setConfig({...config,backupTime:e.target.value})}/></label></div><footer><button className="outline-button" onClick={() => setEditingConfig(false)}>取消</button><button className="primary-button" onClick={saveConfig}>保存</button></footer></div></div>}</div>;
  return <div className="module-page"><div className="module-header"><div><span className="module-kicker">{research.length} 项需求</span><h1>功能调研</h1></div><button className="primary-button" onClick={() => setEditingResearch({id:`research-${Date.now()}`,name:"",requester:"主席团",status:"待调研",detail:""})}><Plus size={18}/>新增需求</button></div><div className="research-list">{research.map((item) => <button key={item.id} onClick={() => setEditingResearch(item)}><span><strong>{item.name}</strong><small>{item.requester}</small></span><p>{item.detail}</p><i>{item.status}</i><ChevronRight size={15}/></button>)}</div>{editingResearch && <div className="modal-backdrop"><div className="member-modal"><header><div><span>功能调研</span><h2>{editingResearch.name || "新增需求"}</h2></div><button className="icon-button" onClick={() => setEditingResearch(null)}><X size={18}/></button></header><div className="form-grid"><label className="span-2"><span>需求名称 *</span><input value={editingResearch.name} onChange={(e) => setEditingResearch({...editingResearch,name:e.target.value})}/></label><label><span>提出部门</span><input value={editingResearch.requester} onChange={(e) => setEditingResearch({...editingResearch,requester:e.target.value})}/></label><label><span>状态</span><select value={editingResearch.status} onChange={(e) => setEditingResearch({...editingResearch,status:e.target.value})}><option>待调研</option><option>调研中</option><option>评估中</option><option>已确认</option><option>暂不实施</option></select></label><label className="span-2"><span>调研记录</span><textarea rows={6} value={editingResearch.detail} onChange={(e) => setEditingResearch({...editingResearch,detail:e.target.value})}/></label></div><footer><button className="outline-button" onClick={() => setEditingResearch(null)}>取消</button><button className="primary-button" disabled={!editingResearch.name.trim()} onClick={saveResearch}>保存</button></footer></div></div>}</div>;
}

function ProductModule({ view, tasks, activities, archiveItems, role, user, onBack, onOpenTask, onCreate, onCreateActivity, onEditActivity, onUploadArchive, notify, pushNotification }: { view: ViewKey; tasks: Task[]; activities: ActivityRecord[]; archiveItems: ArchiveRecord[]; role: UserRole; user: DemoUser; onBack: () => void; onOpenTask: (task: Task) => void; onCreate: () => void; onCreateActivity: () => void; onEditActivity: (activity: ActivityRecord) => void; onUploadArchive: () => void; notify: (message: string) => void; pushNotification: (draft: NotificationDraft) => void }) {
  if (view === "activities") return <MediaActivities onBack={onBack} tasks={tasks} onOpenTask={onOpenTask} role={role} user={user} activities={activities} onCreateActivity={onCreateActivity} onEditActivity={onEditActivity} />;

  if (view === "tasks") return <div className="module-page"><div className="module-header"><div><span className="module-kicker">跨活动任务视图</span><h1>任务中心</h1></div>{role === "chair" && <button className="primary-button" onClick={onCreate}><Plus size={18} />新建任务</button>}</div><div className="stat-strip"><div><span>全部任务</span><strong>{tasks.length}</strong></div><div><span>进行中</span><strong>{tasks.filter(t => t.status === "进行中").length}</strong></div><div><span>待验收</span><strong>{tasks.filter(t => t.status === "待验收").length}</strong></div><div><span>已完成</span><strong>{tasks.filter(t => t.status === "已完成").length}</strong></div></div><div className="product-table"><div className="product-table-head"><span>任务</span><span>所属活动</span><span>负责部门 / 人员</span><span>截止时间</span><span>状态</span></div>{tasks.map(task => <button key={task.id} onClick={() => onOpenTask(task)}><span><i className={`type-dot type-${task.kind}`} /><b>{task.title}</b><small>{task.kind}</small></span><span>{task.activityName || currentActivity.name}</span><span><b>{task.department}</b><small>{task.person}</small></span><span>{task.deadline}</span><i className={`status status-${task.status}`}>{task.status}</i></button>)}</div></div>;

  if (view === "organization") return <OrganizationManager notify={notify} canManage={role === "chair" || role === "admin"} />;

  if (view === "accounts") return <AccountsWorkspace notify={notify} pushNotification={pushNotification}/>;

  if (view === "audit") return <AuditWorkspace notify={notify}/>;

  if (view === "archive") return <ArchiveWorkspace role={role} records={archiveItems} onUpload={onUploadArchive}/>;

  return <SettingsWorkspace role={role} notify={notify}/>;
}

type QuickFlowKind = "activity" | "archive" | "guidance" | "eventSettings" | "timeline";

const quickFlowTitles: Record<QuickFlowKind, { kicker: string; title: string; submit: string }> = {
  activity: { kicker: "活动管理", title: "创建活动", submit: "保存活动" },
  archive: { kicker: "知识沉淀", title: "上传归档资料", submit: "确认归档" },
  guidance: { kicker: "指导教师工作流", title: "提交指导意见", submit: "发送给主席" },
  eventSettings: { kicker: "活动管理", title: "活动设置", submit: "保存设置" },
  timeline: { kicker: "活动进度", title: "关键时间线", submit: "关闭" },
};

function QuickFlowModal({ kind, activities, initialData, onClose, onSubmit }: { kind: QuickFlowKind; activities: ActivityRecord[]; initialData?: Record<string,string>; onClose: () => void; onSubmit: (data: Record<string,string>) => void }) {
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

export default function Home() {
  const [tasks, setTasks] = useState(initialTasks);
  const [activities, setActivities] = useState<ActivityRecord[]>(activityCatalog);
  const [archiveItems, setArchiveItems] = useState<ArchiveRecord[]>(archiveRecords);
  const [subtasks, setSubtasks] = useState<DelegatedTask[]>(initialSubtasks);
  const [organizationDirectory, setOrganizationDirectory] = useState<OrgSnapshot | null>(null);
  const [session, setSession] = useState<DemoUser | null>(null);
  const [userRole, setUserRole] = useState<UserRole>("chair");
  const [showNotifications, setShowNotifications] = useState(false);
  const [readNotifications, setReadNotifications] = useState<string[]>([]);
  const [notificationRecords, setNotificationRecords] = useState<NotificationRecord[]>(seedNotificationRecords);
  const [workflowRecords, setWorkflowRecords] = useState<Array<Record<string,string>>>([]);
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
  const [hostedAuth, setHostedAuth] = useState(false);
  const [authError, setAuthError] = useState("");
  const [accountDirectory, setAccountDirectory] = useState<ManagedAccount[]>(seededAccounts);
  const [quickFlow, setQuickFlow] = useState<QuickFlowKind | null>(null);
  const [editingActivity, setEditingActivity] = useState<ActivityRecord | null>(null);
  const [mainRejectionTarget, setMainRejectionTarget] = useState<Task | null>(null);
  const [pendingTaskAction, setPendingTaskAction] = useState<{ task: Task; status: TaskStatus; title: string; description: string; confirmText: string } | null>(null);

  useEffect(() => {
    async function bootstrap() {
      try {
        const [sessionResponse, stateResponse, accountsResponse] = await Promise.all([fetch("/api/session"), fetch("/api/state"), fetch("/api/accounts")]);
        const sessionResult = await sessionResponse.json();
        const stateResult = stateResponse.ok ? await stateResponse.json() : { state: {} };
        const accountsResult = accountsResponse.ok ? await accountsResponse.json() : { accounts: [] };
        if (!sessionResponse.ok) throw new Error(sessionResult.error || "当前账号无法进入系统");
        setHostedAuth(!sessionResult.localMode);
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
        if (Array.isArray(shared.workflows)) setWorkflowRecords(shared.workflows);
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

  function persistSharedState(key: string, value: unknown) {
    void fetch("/api/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, value }) })
      .then(async (response) => { if (!response.ok) { const result = await response.json(); throw new Error(result.error || "共享数据保存失败"); } })
      .catch((error) => { setNotice(error instanceof Error ? error.message : "共享数据保存失败"); window.setTimeout(() => setNotice(""), 3000); });
  }

  useEffect(() => { if (!storageReady || userRole === "teacher") return; const timer = window.setTimeout(() => persistSharedState("tasks", tasks), 300); return () => window.clearTimeout(timer); }, [tasks, storageReady, userRole]);
  useEffect(() => { if (!storageReady || userRole === "teacher") return; const timer = window.setTimeout(() => persistSharedState("subtasks", subtasks), 300); return () => window.clearTimeout(timer); }, [subtasks, storageReady, userRole]);
  useEffect(() => { if (!storageReady || !["admin", "chair"].includes(userRole)) return; const timer = window.setTimeout(() => persistSharedState("activities", activities), 300); return () => window.clearTimeout(timer); }, [activities, storageReady, userRole]);
  useEffect(() => { if (!storageReady) return; const timer = window.setTimeout(() => persistSharedState("archive", archiveItems), 300); return () => window.clearTimeout(timer); }, [archiveItems, storageReady]);
  useEffect(() => { if (!storageReady) return; const timer = window.setTimeout(() => persistSharedState("notifications", notificationRecords.slice(0, 300)), 300); return () => window.clearTimeout(timer); }, [notificationRecords, storageReady]);
  useEffect(() => { if (!storageReady) return; const timer = window.setTimeout(() => persistSharedState("workflows", workflowRecords.slice(-500)), 300); return () => window.clearTimeout(timer); }, [workflowRecords, storageReady]);

  useEffect(() => {
    const updateAccounts = (event: Event) => setAccountDirectory((event as CustomEvent<ManagedAccount[]>).detail);
    window.addEventListener("accounts-updated", updateAccounts);
    return () => window.removeEventListener("accounts-updated", updateAccounts);
  }, []);

  useEffect(() => {
    // Notification read state is intentionally private to the current browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!storageReady || !session) return setReadNotifications([]);
    const saved = window.localStorage.getItem(`union-notification-read-v1:${session.username}`);
    if (saved) try { return setReadNotifications(JSON.parse(saved)); } catch { window.localStorage.removeItem(`union-notification-read-v1:${session.username}`); }
    setReadNotifications([]);
  }, [session?.username, storageReady]);

  useEffect(() => {
    if (storageReady && session) window.localStorage.setItem(`union-notification-read-v1:${session.username}`, JSON.stringify(readNotifications));
  }, [readNotifications, session?.username, storageReady]);

  useEffect(() => {
    if (storageReady && showNew) window.localStorage.setItem("union-task-draft-v1", JSON.stringify(draft));
  }, [draft, showNew, storageReady]);

  useEffect(() => {
    if (!storageReady || !["chair", "leader", "staff"].includes(userRole)) return;
    // Parent status follows child execution so every dashboard stays consistent.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTasks((current) => {
      let changed = false;
      const next = current.map((task) => {
        const children = subtasks.filter((child) => isSubtaskOf(child, task));
        if (!children.length || task.status === "已完成" || task.status === "待验收") return task;
        const hasStartedChild = children.some((child) => child.status !== "待开始");
        if (hasStartedChild && task.status === "待开始") {
          changed = true;
          return { ...task, status: "进行中" as TaskStatus, lastAction: "子任务已开始，主任务自动进入进行中" };
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

  function pushNotification(draft: NotificationDraft) {
    const recipients = Array.from(new Set(draft.recipientUsernames)).filter((username) => username && username !== session?.username);
    if (!recipients.length) return;
    const record = { ...draft, recipientUsernames: recipients, id: `notice-${Date.now()}-${Math.random().toString(36).slice(2,7)}`, createdAt: new Date().toISOString() };
    setNotificationRecords((current) => [record, ...current.filter((item) => !(
      draft.entity?.type !== "system" && item.entity?.type === draft.entity?.type && item.entity?.id === draft.entity?.id && item.recipientUsernames.some((username) => recipients.includes(username))
    ))].slice(0, 300));
  }

  function relativeNotificationTime(createdAt: string) {
    return new Date(createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
  }

  const notifications = useMemo(() => {
    const dynamic = notificationRecords.filter((item) => session && item.recipientUsernames.includes(session.username)).map((item) => ({ ...item, time: relativeNotificationTime(item.createdAt) }));
    return dynamic;
  }, [userRole, session?.username, notificationRecords]);
  const unreadNotificationCount = notifications.filter((item) => !readNotifications.includes(item.id)).length;

  function updateStatus(task: Task, status: TaskStatus) {
    const actor = userRole === "admin" ? "系统管理员" : `${session?.title || "成员"}${session?.name || ""}`;
    const updated = { ...task, status, risk: status === "已完成" ? false : task.risk, lastAction: `${actor}于刚刚${status === "已完成" ? "直接办结" : `更新为${status}`}` };
    setTasks((current) => current.map((item) => (item.id === task.id ? updated : item)));
    setSelected(updated);
    if (userRole === "chair") {
      pushNotification({ recipientUsernames: Array.from(new Set([...resolveUsernames({ roles: ["leader"], department: task.department }), ...resolveUsernames({ names: [task.person] })])), title: status === "已完成" ? "主任务审核通过" : status === "进行中" && task.status === "已完成" ? "主任务已重新打开" : "主任务状态已更新", detail: `主席已将“${task.title}”更新为${status}。`, level: status === "已完成" ? "success" : "info", entity: { type: "task", id: task.id } });
    }
    setNotice(`“${task.title}”已更新为${status}`);
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

  function logout() {
    if (hostedAuth) { window.location.href = "/signout-with-chatgpt?return_to=/"; return; }
    window.localStorage.removeItem("union-demo-session-v1");
    setSession(null); setSelected(null); setQuickFlow(null); setEventWorkspaceOpen(false); setShowNotifications(false); setReadNotifications([]);
  }

  function resetDemo() {
    ["union-product-tasks-v1","union-leader-subtasks-v2","union-activities-v1","union-archive-v1","union-accounts-v1","union-system-config-v1","union-research-v1","union-workflow-records-v1","union-task-draft-v1","union-demo-session-v1","union-notifications-v1",...seededAccounts.map((account) => `union-notification-read-v1:${account.username}`)].forEach((key) => window.localStorage.removeItem(key));
    setTasks(initialTasks); setSubtasks(initialSubtasks); setActivities(activityCatalog); setArchiveItems(archiveRecords); setNotificationRecords(seedNotificationRecords); setReadNotifications([]); setSession(null); setUserRole("chair"); setActiveView("overview"); setEventWorkspaceOpen(false); setSelected(null);
  }

  function startMainAsLeader(task: Task) {
    if (task.person !== session?.name || task.status !== "待开始") return;
    const updated = { ...task, status: "进行中" as TaskStatus, lastAction: `${session.department}负责人${session.name}于刚刚开始亲自执行` };
    setTasks((current) => current.map((item) => item.id === task.id ? updated : item));
    if (selected?.id === task.id) setSelected(updated);
    pushNotification({ recipientUsernames: resolveUsernames({ roles: ["chair"] }), title: "负责人已开始主任务", detail: `${session.department}负责人${session.name}已开始执行“${task.title}”。`, level: "info", entity: { type: "task", id: task.id } });
    setNotice(`“${task.title}”已开始执行`);
    window.setTimeout(() => setNotice(""), 2400);
  }

  function submitMainForChair(task: Task) {
    const unfinished = subtasks.filter((item) => isSubtaskOf(item, task) && item.status !== "已完成");
    if (unfinished.length) {
      setNotice(`还有${unfinished.length}个子任务未完成，暂不能提交主席审核`);
      window.setTimeout(() => setNotice(""), 2400);
      return;
    }
    const updated = { ...task, status: "待验收" as TaskStatus, lastAction: `${session?.department || task.department}负责人${session?.name || task.person}于刚刚提交主席审核` };
    setTasks((current) => current.map((item) => item.id === task.id ? updated : item));
    if (selected?.id === task.id) setSelected(updated);
    pushNotification({ recipientUsernames: resolveUsernames({ roles: ["chair"] }), title: "部门结办等待审核", detail: `${task.department}已提交“${task.title}”，请审核结果与凭据。`, level: "warning", entity: { type: "task", id: task.id } });
    setNotice(`“${task.title}”已提交主席审核`);
    window.setTimeout(() => setNotice(""), 2400);
  }

  function withdrawMainForLeader(task: Task) {
    if (task.status !== "待验收") return;
    const updated = { ...task, status: "进行中" as TaskStatus, lastAction: `${session?.department || task.department}负责人${session?.name || task.person}于刚刚撤回主席审核申请` };
    setTasks((current) => current.map((item) => item.id === task.id ? updated : item));
    if (selected?.id === task.id) setSelected(updated);
    pushNotification({ recipientUsernames: resolveUsernames({ roles: ["chair"] }), title: "负责人已撤回结办申请", detail: `${task.department}撤回了“${task.title}”的审核申请，将修改后再次提交。`, level: "info", entity: { type: "task", id: task.id } });
    setNotice(`“${task.title}”已撤回，可继续修改`);
    window.setTimeout(() => setNotice(""), 2400);
  }

  function rejectMainTask(task: Task) {
    setMainRejectionTarget(task);
  }

  function confirmRejectMainTask(task: Task, reason: string) {
    const updated = { ...task, status: "进行中" as TaskStatus, lastAction: `主席徐介翰刚刚退回：${reason}` };
    setTasks((current) => current.map((item) => item.id === task.id ? updated : item));
    pushNotification({ recipientUsernames: Array.from(new Set([...resolveUsernames({ roles: ["leader"], department: task.department }), ...resolveUsernames({ names: [task.person] })])), title: "主任务被退回修改", detail: `主席退回“${task.title}”：${reason}`, level: "warning", entity: { type: "task", id: task.id } });
    setSelected(updated); setMainRejectionTarget(null); setNotice(`“${task.title}”已退回负责人修改`);
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
    const uploaded: Attachment[] = []; const errors: string[] = [];
    for (const file of Array.from(files)) {
      const form = new FormData(); form.append("file", file);
      const response = await fetch("/api/files", { method: "POST", body: form });
      const result = await response.json();
      if (response.ok) uploaded.push(result.attachment); else errors.push(`${file.name}：${result.error || "上传失败"}`);
    }
    const updated = { ...selected, attachments: [...(selected.attachments || []), ...uploaded] };
    setTasks((current) => current.map((task) => task.id === selected.id ? updated : task));
    setSelected(updated); setUploading(false);
    if (uploaded.length) pushNotification({ recipientUsernames: Array.from(new Set([...resolveUsernames({ roles: ["leader"], department: selected.department }), ...resolveUsernames({ names: [selected.person] })])), title: "任务新增参考附件", detail: `“${selected.title}”新增${uploaded.length}个附件：${uploaded.map((file) => file.name).join("、")}。`, level: "info", entity: { type: "task", id: selected.id } });
    setNotice(errors.length ? errors[0] : `已向任务添加${uploaded.length}个附件`);
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
      const updated = { ...selected, attachments: (selected.attachments || []).filter((item) => item.key !== file.key) };
      setTasks((current) => current.map((task) => task.id === selected.id ? updated : task));
      setSelected(updated); setNotice(`已删除“${file.name}”`);
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

  function addTask() {
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
    setTasks((current) => [...current, task]);
    pushNotification({ recipientUsernames: Array.from(new Set([...resolveUsernames({ roles: ["leader"], department: task.department }), ...resolveUsernames({ names: [task.person] })])), title: task.person !== "待指派" ? "主席交办新任务" : "部门收到新任务", detail: `“${task.title}”已发布，截止${task.deadline}。`, level: "warning", entity: { type: "task", id: task.id } });
    window.localStorage.removeItem("union-task-draft-v1");
    setSelected(task);
    setShowNew(false);
    setNotice(`“${task.title}”已创建，并通知${task.department}`);
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

  function submitQuickFlow(data: Record<string,string>) {
    setWorkflowRecords((current) => [...current, { ...data, kind: quickFlow || "", createdAt: new Date().toISOString() }]);
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
      const participantLeaders = departments.flatMap((department) => resolveUsernames({ roles: ["leader"], department }));
      const teacherAccounts = next.teacher === "未指定" ? [] : resolveUsernames({ names: [next.teacher] });
      pushNotification({ recipientUsernames: Array.from(new Set([...participantLeaders, ...teacherAccounts])), title: editingActivity ? "活动信息已更新" : "新增活动安排", detail: `${next.name}：${next.date} ${next.time}，地点${next.location}。`, level: editingActivity ? "info" : "warning", entity: { type: "activity", id: next.id } });
      setEditingActivity(null);
    }
    if (quickFlow === "archive") {
      const bytes = Number(data.size || 0);
      const size = bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1,Math.round(bytes / 1024))} KB`;
      setArchiveItems((current) => [{ id:`archive-${Date.now()}`, academicYear:data.academicYear, semester:data.semester as AcademicSemester, activity:data.activity, category:data.category, name:data.fileName, owner:session?.department || "主席团", time:new Date().toLocaleString("zh-CN",{hour12:false}), size, key:data.key, description:data.detail }, ...current]);
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
  if (!session) return <LoginScreen onLogin={login} onReset={resetDemo}/>;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">CS</div>
          <div><strong>学生联盟管理系统</strong><span>计算学院</span></div>
        </div>
        <nav aria-label="主导航">
          <button className={`nav-item ${activeView === "overview" && !eventWorkspaceOpen ? "active" : ""}`} onClick={() => { setActiveView("overview"); setEventWorkspaceOpen(false); }}><LayoutDashboard size={18} />{userRole === "admin" ? "系统总览" : userRole === "chair" ? "主席总览" : userRole === "leader" ? "部门工作台" : userRole === "teacher" ? "指导教师看板" : "我的工作台"}</button>
          {userRole !== "admin" && <button className={`nav-item ${activeView === "activities" || eventWorkspaceOpen ? "active" : ""}`} onClick={() => { setActiveView("activities"); setEventWorkspaceOpen(false); }}><Activity size={18} />活动管理<span className="nav-count">{activities.length}</span></button>}
          {userRole === "chair" && <button className={`nav-item ${activeView === "tasks" ? "active" : ""}`} onClick={() => setActiveView("tasks")}><ListTodo size={18} />任务中心<span className="nav-count alert">{tasks.filter(t => t.status !== "已完成").length}</span></button>}
          {(userRole === "chair" || userRole === "admin") && <button className={`nav-item ${activeView === "organization" ? "active" : ""}`} onClick={() => setActiveView("organization")}><Users size={18} />组织与成员</button>}
          {userRole !== "admin" && <button className={`nav-item ${activeView === "archive" ? "active" : ""}`} onClick={() => setActiveView("archive")}><FileText size={18} />资料归档</button>}
          {userRole === "admin" && <button className={`nav-item ${activeView === "accounts" ? "active" : ""}`} onClick={() => setActiveView("accounts")}><UserCheck size={18}/>账号与权限<span className="nav-count alert">3</span></button>}
          {userRole === "admin" && <button className={`nav-item ${activeView === "audit" ? "active" : ""}`} onClick={() => setActiveView("audit")}><FileText size={18}/>审计日志</button>}
        </nav>
        <div className="sidebar-bottom">
          {(userRole === "chair" || userRole === "admin") && <button className={`nav-item ${activeView === "settings" ? "active" : ""}`} onClick={() => setActiveView("settings")}><Settings size={18} />{userRole === "admin" ? "系统配置" : "功能调研"}</button>}
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

        {showNotifications && <aside className="notification-panel"><header><div><h2>{userRole === "admin" ? "系统通知" : userRole === "chair" ? "主席通知" : userRole === "leader" ? "负责人通知" : userRole === "teacher" ? "指导教师通知" : "我的通知"}</h2><span>{unreadNotificationCount} 条未读</span></div><button className="icon-button" onClick={() => setShowNotifications(false)}><X size={17}/></button></header><div>{notifications.length ? notifications.map((item) => { const isRead = readNotifications.includes(item.id); return <button key={item.id} className={`${item.level || ""} ${isRead ? "read" : ""}`} onClick={() => openNotification(item)}><i/><span><strong>{item.title}</strong><p>{item.detail}</p><small>{item.time}</small></span></button>; }) : <div className="notification-empty"><Bell size={20}/><strong>暂无通知</strong></div>}</div><footer><button disabled={!unreadNotificationCount} onClick={() => { setReadNotifications(notifications.map((item) => item.id)); setNotice("已将当前通知全部标为已读"); }}>全部标为已读</button></footer></aside>}

        <div className="content">
          {activeView !== "overview" ? <ProductModule user={session} view={activeView} tasks={tasks} activities={activities} archiveItems={archiveItems} role={userRole} onBack={() => { setActiveView("overview"); setEventWorkspaceOpen(userRole === "chair"); }} onOpenTask={setSelected} onCreate={userRole === "chair" ? openNewTask : () => setNotice("只有主席可以发布主任务")} onCreateActivity={() => { setEditingActivity(null); setQuickFlow("activity"); }} onEditActivity={editActivity} onUploadArchive={() => setQuickFlow("archive")} notify={handleNotify} pushNotification={pushNotification} /> : userRole !== "chair" ? <RoleDashboard user={session} accounts={accountDirectory} role={userRole} tasks={tasks} activities={activities} subtasks={subtasks} setSubtasks={setSubtasks} onOpenTask={setSelected} onStartMain={startMainAsLeader} onSubmitMain={submitMainForChair} onWithdrawMain={withdrawMainForLeader} notify={handleNotify} pushNotification={pushNotification} resolveUsernames={resolveUsernames} notifications={notifications} /> : !eventWorkspaceOpen ? <ChairOverview tasks={tasks} activities={activities} onOpenTask={setSelected} onOpenActivities={() => setActiveView("activities")} onOpenTasks={() => setActiveView("tasks")} onCreateTask={openNewTask}/> : <>
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
