import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext, withTenant } from "@/lib/tenant-context";
import { ForbiddenError, NotFoundError, handleApiError } from "@/lib/errors";
import { getTeacherAssignedSectionIds } from "@/lib/services/student-service";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertValidId(id: string) {
  if (!UUID_PATTERN.test(id)) throw new NotFoundError("Student not found.");
}

/**
 * GET /api/t/:tenantSlug/students/:studentId/attendance?days=30
 *
 * One student's own attendance history and a summary of it. Restricted to the
 * student or school staff assigned to the student's class.
 * Cross-tenant student access returns 404 to avoid disclosing existence in other schools.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string; id: string }> },
) {
  try {
    const { tenantSlug, id: studentId } = await context.params;
    assertValidId(studentId);

    const { tenant, user, membership } = await resolveTenantContext(
      request,
      tenantSlug,
      ["SCHOOL_ADMIN", "TEACHER", "STUDENT"],
    );

    return await withTenant(tenant.id, async (tx) => {
      const student = await tx.student.findFirst({
        where: { id: studentId, tenantId: tenant.id },
        include: {
          enrolments: {
            where: { status: "ACTIVE" },
            select: { sectionId: true },
          },
        },
      });

      if (!student) {
        throw new NotFoundError("Student not found.");
      }

      // Teachers may only view attendance for students in classes assigned to them
      if (membership.role === "TEACHER") {
        const assignedSectionIds = await getTeacherAssignedSectionIds(
          tx,
          tenant.id,
          user.id,
        );
        const isAssigned = student.enrolments.some((e) =>
          assignedSectionIds.includes(e.sectionId),
        );
        if (!isAssigned) {
          throw new ForbiddenError(
            "You may only view attendance for students in classes assigned to you.",
          );
        }
      }

      // Students may only read their own record
      if (membership.role === "STUDENT") {
        if (student.userId !== user.id) {
          throw new ForbiddenError("You may only read your own attendance.");
        }
      }

      const days = Math.min(Number(request.nextUrl.searchParams.get("days") ?? 30) || 30, 365);
      const since = new Date();
      since.setDate(since.getDate() - days);

      const records = await tx.attendanceRecord.findMany({
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
    });
  } catch (error) {
    return handleApiError(error);
  }
}