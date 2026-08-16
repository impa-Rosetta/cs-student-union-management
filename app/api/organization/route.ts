import { and, asc, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../db";
import { departments, members, terms } from "../../../db/schema";
import { ensureOrganizationSchema } from "../../../db/organization";
import { authErrorResponse, requireRole } from "../../server-auth";

async function snapshot(termId?: number) {
  await ensureOrganizationSchema();
  const db = getDb();
  const termRows = await db.select().from(terms).orderBy(asc(terms.startYear));
  const selected = termId || termRows.find((term) => term.isCurrent)?.id || termRows.at(-1)?.id;
  const departmentRows = await db.select().from(departments).orderBy(asc(departments.sortOrder));
  const memberRows = selected ? await db.select().from(members).where(and(eq(members.termId, selected), eq(members.status, "active"))).orderBy(asc(members.sortOrder), asc(members.id)) : [];
  return { terms: termRows, departments: departmentRows, members: memberRows, selectedTermId: selected };
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
    const db = getDb();
    const body = await request.json() as Record<string, unknown>;
    if (body.action === "transitionImport") {
      const name = String(body.name || "").trim();
      const startYear = Number(body.startYear);
      const endYear = Number(body.endYear);
      const rows = Array.isArray(body.rows) ? body.rows as Array<Record<string, unknown>> : [];
      if (!/^20\d{2}-20\d{2}(?:届|学年)?$/.test(name) || endYear !== startYear + 1) return Response.json({ error: "届次名称格式不正确" }, { status: 400 });
      if (!rows.length || rows.length > 500) return Response.json({ error: "成员数量应在 1 至 500 人之间" }, { status: 400 });
      const existingTerm = await db.select({ id: terms.id }).from(terms).where(eq(terms.name, name));
      if (existingTerm.length) return Response.json({ error: `届次“${name}”已经存在，请更换届次名称` }, { status: 409 });
      const departmentRows = await db.select().from(departments);
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
      const d1 = env.DB;
      await d1.batch([
        d1.prepare("UPDATE terms SET is_current = 0"),
        d1.prepare("INSERT INTO terms (name, start_year, end_year, is_current) VALUES (?, ?, ?, 1)").bind(name, startYear, endYear),
        ...values.map((member) => d1.prepare("INSERT INTO members (term_id, department_id, name, student_no, class_name, phone, position, role_level, sort_order) VALUES ((SELECT id FROM terms WHERE name = ?), ?, ?, ?, ?, ?, ?, ?, ?)").bind(name, member.departmentId, member.name, member.studentNo, member.className, member.phone, member.position, member.roleLevel, member.sortOrder)),
      ]);
      const term = await db.select().from(terms).where(eq(terms.name, name));
      return Response.json(await snapshot(term[0].id), { status: 201 });
    }
    if (body.action === "createTerm") {
      await db.update(terms).set({ isCurrent: false });
      const [term] = await db.insert(terms).values({ name: String(body.name), startYear: Number(body.startYear), endYear: Number(body.endYear), isCurrent: true }).returning();
      return Response.json({ term, ...(await snapshot(term.id)) }, { status: 201 });
    }
    if (body.action === "bulkImport") {
      const rows = Array.isArray(body.rows) ? body.rows as Array<Record<string, unknown>> : [];
      const departmentRows = await db.select().from(departments);
      const lookup = new Map(departmentRows.map((department) => [department.name, department.id]));
      const values = rows.filter((row) => row.name && row.position).map((row, index) => ({
        termId: Number(body.termId), departmentId: lookup.get(String(row.department)) ?? null,
        name: String(row.name), studentNo: String(row.studentNo || ""), className: String(row.className || ""), grade: String(row.grade || ""), major: String(row.major || ""), phone: String(row.phone || ""),
        position: String(row.position), roleLevel: String(row.roleLevel || (String(row.position).includes("主席") ? "chair" : String(row.position).includes("负责人") ? "leader" : "staff")), sortOrder: index + 1,
      }));
      if (values.length) await db.insert(members).values(values);
      return Response.json(await snapshot(Number(body.termId)), { status: 201 });
    }
    const [member] = await db.insert(members).values({
      termId: Number(body.termId), departmentId: body.departmentId ? Number(body.departmentId) : null,
      name: String(body.name), studentNo: String(body.studentNo || ""), className: String(body.className || ""), grade: String(body.grade || ""), major: String(body.major || ""), phone: String(body.phone || ""),
      position: String(body.position), roleLevel: String(body.roleLevel || "staff"), sortOrder: Number(body.sortOrder || 0),
    }).returning();
    return Response.json({ member }, { status: 201 });
  } catch (error) {
    return authErrorResponse(error, "保存组织数据失败");
  }
}

export async function PUT(request: Request) {
  try {
    await requireRole(request, ["admin", "chair"]);
    await ensureOrganizationSchema();
    const db = getDb();
    const body = await request.json() as Record<string, unknown>;
    const [member] = await db.update(members).set({ departmentId: body.departmentId ? Number(body.departmentId) : null, name: String(body.name), studentNo: String(body.studentNo || ""), className: String(body.className || ""), grade: String(body.grade || ""), major: String(body.major || ""), phone: String(body.phone || ""), position: String(body.position), roleLevel: String(body.roleLevel), updatedAt: new Date().toISOString() }).where(eq(members.id, Number(body.id))).returning();
    return Response.json({ member });
  } catch (error) {
    return authErrorResponse(error, "更新成员失败");
  }
}

export async function DELETE(request: Request) {
  try {
    await requireRole(request, ["admin", "chair"]);
    await ensureOrganizationSchema();
    const db = getDb();
    const id = Number(new URL(request.url).searchParams.get("id"));
    await db.update(members).set({ status: "inactive", updatedAt: new Date().toISOString() }).where(eq(members.id, id));
    return Response.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error, "移除成员失败");
  }
}
