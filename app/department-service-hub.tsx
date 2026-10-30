"use client";

import { ArrowLeft, Building2, ChevronRight, ClipboardCheck, Clock3, FileText, Users } from "lucide-react";
import { useEffect, useState } from "react";
import type { ActivityRecord, DemoUser, OrgDepartment, OrgSnapshot, UserRole } from "./product-model";
import { OfficeWorkspace } from "./office-workspace";
import { LifeDepartmentWorkspace } from "./life-department-workspace";
import { OrganizationDepartmentWorkspace } from "./organization-department-workspace";

const FALLBACK_DEPARTMENTS = [
  "办公室", "实践部", "生活部", "党员之家", "组织部", "心理部", "科创中心",
  "职规部", "学习部", "体育部", "文艺部", "新媒体中心", "校友部",
].map((name, index) => ({ id: index + 1, name, groupName: "学生联盟", parentId: null, description: "", sortOrder: index + 1 }));

const departmentDescriptions: Record<string, string> = {
  办公室: "场地审核办理、例会通报收集与汇总",
  实践部: "志愿活动、三课学分与时长补录",
  生活部: "物资采购、寝室检查与失物招领",
  体育部: "赛事组织、场地器材与人员考勤",
  学习部: "晚自习管理、课堂活动与学业服务",
  文艺部: "文艺活动、节目筹备与策划材料",
  新媒体中心: "推文、摄影、视频与宣传材料",
  校友部: "校友活动接待、签到与现场保障",
  心理部: "心理活动、剧本协作与材料审批",
  职规部: "职业规划活动与就业服务",
  党员之家: "党建材料、党校培训与档案管理",
  组织部: "组织建设与团学事务",
  科创中心: "科创项目、程序设计竞赛、设备保障与技术支持",
};

export function DepartmentServiceHub({ user, role, activities, notify }: { user: DemoUser; role: UserRole; activities: ActivityRecord[]; notify: (message: string) => void }) {
  const [departments, setDepartments] = useState<OrgDepartment[]>(FALLBACK_DEPARTMENTS);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);

  // 首次进入时读取当前组织架构，失败时使用与组织种子一致的兜底名单。
  useEffect(() => { void fetch("/api/organization").then((response) => response.ok ? response.json() : null).then((result: OrgSnapshot | null) => { if (result?.departments?.length) setDepartments(result.departments.slice().sort((a, b) => a.sortOrder - b.sortOrder)); }).catch(() => undefined); }, []);

  if (selectedDepartment === "办公室") {
    return <OfficeWorkspace user={user} role={role} activities={activities} notify={notify} onBack={() => setSelectedDepartment(null)}/>;
  }

  if (selectedDepartment === "生活部") {
    return <LifeDepartmentWorkspace user={user} role={role} activities={activities} notify={notify} onBack={() => setSelectedDepartment(null)}/>;
  }

  if (selectedDepartment === "组织部") {
    return <OrganizationDepartmentWorkspace user={user} role={role} notify={notify} onBack={() => setSelectedDepartment(null)}/>;
  }

  if (selectedDepartment) {
    return <div className="module-page department-placeholder">
      <button className="department-back" onClick={() => setSelectedDepartment(null)}><ArrowLeft size={15}/>返回全部部门</button>
      <section className="department-placeholder-card"><i>{selectedDepartment.slice(0, 1)}</i><span className="module-kicker">{selectedDepartment}专属工作区</span><h1>{selectedDepartment}办事中心</h1><p>{departmentDescriptions[selectedDepartment] || "该部门的办事流程正在梳理中。"}</p><div><Clock3 size={18}/><span><strong>功能筹备中</strong><small>后续确认该部门适合信息化的业务后，将在这里接入申请、审核和留痕流程。</small></span></div><button className="outline-button" onClick={() => setSelectedDepartment(null)}><Building2 size={16}/>选择其他部门</button></section>
    </div>;
  }

  const availableDepartments = new Set(["办公室", "生活部", "组织部"]);
  const availableCount = departments.filter((department) => availableDepartments.has(department.name)).length;
  return <div className="module-page department-service-hub">
    <div className="module-header"><div><span className="module-kicker">学生联盟统一服务入口</span><h1>部门办事中心</h1><p>选择需要办理业务的部门，进入对应的专属办事工作区。</p></div><div className="department-hub-summary"><ClipboardCheck size={18}/><span><strong>{availableCount} 个中心已上线</strong><small>{departments.length} 个部门持续建设中</small></span></div></div>
    <section className="department-guide"><FileText size={18}/><div><strong>按业务归口选择部门</strong><span>办公室负责场地审核办理和例会通报汇总；场地申请本身已作为全体部门可用的独立功能放在主导航。生活部支持采购、查寝和失物招领，组织部支持成员异动、考核与组织事务。</span></div></section>
    <div className="department-card-grid">{departments.map((department) => {
      const ready = availableDepartments.has(department.name);
      return <button key={department.id} className={ready ? "ready" : "planned"} onClick={() => setSelectedDepartment(department.name)}><i>{department.name.slice(0, 1)}</i><span><strong>{department.name}</strong><small>{departmentDescriptions[department.name] || "专属办事流程待梳理"}</small><em>{ready ? "已上线" : "筹备中"}</em></span><ChevronRight size={17}/></button>;
    })}</div>
    <footer className="department-hub-footer"><Users size={16}/><span>部门名单与“组织与成员”中的当前组织架构保持一致</span></footer>
  </div>;
}
