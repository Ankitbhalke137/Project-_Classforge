import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";

/**
 * GET /api/t/:tenantSlug/students/:studentId/attendance?days=30
 *
 * One student's own attendance history and a summary of it. Restricted to the
 * student, their guardian, or school staff — a student cannot read another's.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string; id: string }> },
) {
  try {
    const { tenantSlug, id: studentId } = await context.params;
    const { tenant, user, membership } = await resolveTenantContext(request, tenantSlug);

    const student = await prisma.student.findFirst({
      where: { id: studentId, tenantId: tenant.id },
      select: { id: true },
    });
    if (!student) {
      return NextResponse.json({ studentId, records: [], summary: emptySummary() });
    }

    // Students may only read their own record.
    if (membership.role === "STUDENT") {
      const own = await prisma.student.findFirst({
        where: { id: studentId, tenantId: tenant.id, userId: user.id },
        select: { id: true },
      });
      if (!own) {
        return NextResponse.json(
          { message: "You may only read your own attendance." },
          { status: 403 },
        );
      }
    }

    const days = Math.min(Number(request.nextUrl.searchParams.get("days") ?? 30) || 30, 365);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const records = await prisma.attendanceRecord.findMany({
      where: { tenantId: tenant.id, studentId, attendanceDate: { gte: since } },
      include: { section: { include: { schoolClass: { select: { name: true } } } } },
      orderBy: { attendanceDate: "desc" },
    });

    const rows = records.map((record) => ({
      id: record.id,
      date: record.attendanceDate.toISOString().slice(0, 10),
      classId: record.sectionId,
      studentId: record.studentId,
      status: record.status,
      markedByTeacherId: record.markedBy,
      markedAt: record.createdAt.toISOString(),
      studentName: "",
      className: `${record.section.schoolClass.name} - ${record.section.name}`,
    }));

    const count = (status: string) => rows.filter((row) => row.status === status).length;
    const present = count("PRESENT");
    const late = count("LATE");
    const excused = count("EXCUSED");

    return NextResponse.json({
      studentId,
      records: rows,
      summary: {
        total: rows.length,
        present: present + late,
        absent: count("ABSENT"),
        late,
        excused,
        // Late counts as attended, matching the rest of the product.
        percentage:
          rows.length === 0 ? 0 : Math.round(((present + late) / rows.length) * 100),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

function emptySummary() {
  return { total: 0, present: 0, absent: 0, late: 0, excused: 0, percentage: 0 };
}