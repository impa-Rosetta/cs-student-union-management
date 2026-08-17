// 组织与成员端点：读写关系表 terms / departments / members。
// 通过 DatabaseRepository 端口访问数据库（与其余存储模块一致），不再依赖 drizzle 查询构造器。

import { getDb } from "../../db.ts";
import { authErrorResponse, requireRole } from "../../server-auth.ts";
import { ensureOrganizationSchema } from "../../../db/organization.ts";

const db = getDb();

interface TermRow { id: number; name: string; start_year: number; end_year: number; is_current: number; created_at: string; }
interface DepartmentRow { id: number; name: string; group_name: string; parent_id: number | null; description: string; sort_order: number; }
interface MemberRow { id: number; term_id: number; department_id: number | null; name: string; student_no: string; class_name: string; grade: string; major: string; phone: string; position: string; role_level: string; status: string; sort_order: number; }

function mapTerm(row: TermRow) {
  return { id: row.id, name: row.name, startYear: row.start_year, endYear: row.end_year, isCurrent: Boolean(row.is_current), createdAt: row.created_at };
}
function mapDepartment(row: DepartmentRow) {
  return { id: row.id, name: row.name, groupName: row.group_name, parentId: row.parent_id, description: row.description, sortOrder: row.sort_order };
}
function mapMember(row: MemberRow) {
  return { id: row.id, termId: row.term_id, departmentId: row.department_id, name: row.name, studentNo: row.student_no, className: row.class_name, grade: row.grade, major: row.major, phone: row.phone, position: row.position, roleLevel: row.role_level, status: row.status, sortOrder: row.sort_order };
}

async function snapshot(termId?: number) {
  await ensureOrganizationSchema();
  const termRows = (await db.prepare("SELECT * FROM terms ORDER BY start_year ASC").all<TermRow>()).results;
  const terms = termRows.map(mapTerm);
  const selected = termId || terms.find((term) => term.isCurrent)?.id || terms.at(-1)?.id;
  const departmentRows = (await db.prepare("SELECT * FROM departments ORDER BY sort_order ASC").all<DepartmentRow>()).results;
  const departments = departmentRows.map(mapDepartment);
  const memberRows = selected
    ? (await db.prepare("SELECT * FROM members WHERE term_id = ? AND status = 'active' ORDER BY sort_order ASC, id ASC").bind(selected).all<MemberRow>()).results
    : [];
  const members = memberRows.map(mapMember);
  return { terms, departments, members, selectedTermId: selected };
}

export async function GET(request: Request) {
  try {
    await requireRole(request);
    const termId = Number(new URL(request.url).searchParams.get("term")) || undefined;
    return Response.json(await snapshot(termId));
  } catch (error) {
    return authErrorResponse(error, "读取组织数据失败");
  }
}

export async function POST(request: Request) {
  try {
    await requireRole(request, ["admin", "chair"]);
    await ensureOrganizationSchema();
    const body = await request.json() as Record<string, unknown>;

    if (body.action === "transitionImport") {
      const name = String(body.name || "").trim();
      const startYear = Number(body.startYear);
      const endYear = Number(body.endYear);
      const rows = Array.isArray(body.rows) ? body.rows as Array<Record<string, unknown>> : [];
      if (!/^20\d{2}-20\d{2}(?:届|学年)?$/.test(name) || endYear !== startYear + 1) return Response.json({ error: "届次名称格式不正确" }, { status: 400 });
      if (!rows.length || rows.length > 500) return Response.json({ error: "成员数量应在 1 至 500 人之间" }, { status: 400 });
      const existingTerm = await db.prepare("SELECT id FROM terms WHERE name = ?").bind(name).all<{ id: number }>();
      if (existingTerm.results.length) return Response.json({ error: `届次“${name}”已经存在，请更换届次名称` }, { status: 409 });
      const departmentRows = (await db.prepare("SELECT * FROM departments").all<DepartmentRow>()).results;
      const departmentLookup = new Map(departmentRows.filter((department) => department.name !== "科创中心").map((department) => [department.name, department.id]));
      const roleLookup: Record<string, "chair" | "leader" | "staff"> = { "主席": "chair", "负责人": "leader", "干事": "staff", chair: "chair", leader: "leader", staff: "staff" };
      const studentNumbers = new Set<string>();
      const values: Array<{ departmentId: number | null; name: string; studentNo: string; className: string; phone: string; position: string; roleLevel: string; sortOrder: number }> = [];
      for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        const memberName = String(row.name || "").trim();
        const departmentName = String(row.department || "").trim();
        const position = String(row.position || "").trim();
        const roleLevel = roleLookup[position];
        const studentNo = String(row.studentNo || "").trim();
        const sortOrder = index + 1;
        if (!memberName || !departmentName || !position) return Response.json({ error: `第 ${index + 1} 条成员数据缺少必填字段` }, { status: 400 });
        if (!roleLevel) return Response.json({ error: `第 ${index + 1} 条成员的职务只能是主席、负责人或干事` }, { status: 400 });
        if (roleLevel === "chair" && departmentName !== "主席团") return Response.json({ error: `第 ${index + 1} 条主席成员必须归属主席团` }, { status: 400 });
        if (roleLevel !== "chair" && (departmentName === "主席团" || !departmentLookup.has(departmentName))) return Response.json({ error: `第 ${index + 1} 条成员的所属部门无效` }, { status: 400 });
        if (studentNo && studentNumbers.has(studentNo)) return Response.json({ error: `学号 ${studentNo} 在名单中重复` }, { status: 400 });
        if (studentNo) studentNumbers.add(studentNo);
        values.push({ departmentId: roleLevel === "chair" ? null : departmentLookup.get(departmentName)!, name: memberName, studentNo, className: String(row.className || "").trim(), phone: String(row.phone || "").trim(), position, roleLevel, sortOrder });
      }
      await db.batch([
        db.prepare("UPDATE terms SET is_current = 0"),
        db.prepare("INSERT INTO terms (name, start_year, end_year, is_current) VALUES (?, ?, ?, 1)").bind(name, startYear, endYear),
        ...values.map((member) => db.prepare("INSERT INTO members (term_id, department_id, name, student_no, class_name, phone, position, role_level, sort_order) VALUES ((SELECT id FROM terms WHERE name = ?), ?, ?, ?, ?, ?, ?, ?, ?)").bind(name, member.departmentId, member.name, member.studentNo, member.className, member.phone, member.position, member.roleLevel, member.sortOrder)),
      ]);
      const term = await db.prepare("SELECT id FROM terms WHERE name = ?").bind(name).first<{ id: number }>();
      return Response.json(await snapshot(term?.id), { status: 201 });
    }

    if (body.action === "createTerm") {
      await db.prepare("UPDATE terms SET is_current = 0").run();
      await db.prepare("INSERT INTO terms (name, start_year, end_year, is_current) VALUES (?, ?, ?, 1)").bind(String(body.name), Number(body.startYear), Number(body.endYear)).run();
      const term = await db.prepare("SELECT * FROM terms WHERE name = ?").bind(String(body.name)).first<TermRow>();
      return Response.json({ term: term ? mapTerm(term) : null, ...(await snapshot(term?.id)) }, { status: 201 });
    }

    if (body.action === "bulkImport") {
      const rows = Array.isArray(body.rows) ? body.rows as Array<Record<string, unknown>> : [];
      const departmentRows = (await db.prepare("SELECT * FROM departments").all<DepartmentRow>()).results;
      const lookup = new Map(departmentRows.map((department) => [department.name, department.id]));
      const values = rows.filter((row) => row.name && row.position).map((row, index) => ({
        termId: Number(body.termId), departmentId: lookup.get(String(row.department)) ?? null,
        name: String(row.name), studentNo: String(row.studentNo || ""), className: String(row.className || ""), grade: String(row.grade || ""), major: String(row.major || ""), phone: String(row.phone || ""),
        position: String(row.position), roleLevel: String(row.roleLevel || (String(row.position).includes("主席") ? "chair" : String(row.position).includes("负责人") ? "leader" : "staff")), sortOrder: index + 1,
      }));
      if (values.length) {
        await db.batch(values.map((value) => db.prepare("INSERT INTO members (term_id, department_id, name, student_no, class_name, grade, major, phone, position, role_level, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(value.termId, value.departmentId, value.name, value.studentNo, value.className, value.grade, value.major, value.phone, value.position, value.roleLevel, value.sortOrder)));
      }
      return Response.json(await snapshot(Number(body.termId)), { status: 201 });
    }

    await db.prepare("INSERT INTO members (term_id, department_id, name, student_no, class_name, grade, major, phone, position, role_level, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(Number(body.termId), body.departmentId ? Number(body.departmentId) : null, String(body.name), String(body.studentNo || ""), String(body.className || ""), String(body.grade || ""), String(body.major || ""), String(body.phone || ""), String(body.position), String(body.roleLevel || "staff"), Number(body.sortOrder || 0)).run();
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error, "保存组织数据失败");
  }
}

export async function PUT(request: Request) {
  try {
    await requireRole(request, ["admin", "chair"]);
    await ensureOrganizationSchema();
    const body = await request.json() as Record<string, unknown>;
    await db.prepare("UPDATE members SET department_id = ?, name = ?, student_no = ?, class_name = ?, grade = ?, major = ?, phone = ?, position = ?, role_level = ?, updated_at = ? WHERE id = ?")
      .bind(body.departmentId ? Number(body.departmentId) : null, String(body.name), String(body.studentNo || ""), String(body.className || ""), String(body.grade || ""), String(body.major || ""), String(body.phone || ""), String(body.position), String(body.roleLevel), new Date().toISOString(), Number(body.id)).run();
    return Response.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error, "更新成员失败");
  }
}

export async function DELETE(request: Request) {
  try {
    await requireRole(request, ["admin", "chair"]);
    await ensureOrganizationSchema();
    const id = Number(new URL(request.url).searchParams.get("id"));
    await db.prepare("UPDATE members SET status = 'inactive', updated_at = ? WHERE id = ?").bind(new Date().toISOString(), id).run();
    return Response.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error, "移除成员失败");
  }
}
