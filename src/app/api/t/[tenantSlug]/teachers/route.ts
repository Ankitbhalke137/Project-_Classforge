import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";

/**
 * GET /api/t/:tenantSlug/teachers
 *
 * Reads the `teachers` table. The database stores fewer columns than the app's
 * `Teacher` type asks for, so the fields with no column behind them come back
 * empty rather than being invented — a blank phone number is honest, a made-up
 * one is not.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ tenantSlug: string }> }) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
      "TEACHER",
    ]);

    const teachers = await prisma.teacher.findMany({
      where: { tenantId: tenant.id },
      include: {
        user: { select: { email: true } },
        teachingAssignments: {
          select: { sectionId: true, subjectId: true },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    const data = teachers.map((teacher) => ({
      id: teacher.id,
      name: `${teacher.firstName} ${teacher.lastName}`.trim(),
      email: teacher.user?.email ?? "",
      employeeNo: teacher.employeeNo ?? "",
      // No column exists for these yet.
      phone: "",
      qualification: "",
      designation: "",
      joinedOn: teacher.createdAt.toISOString(),
      subject: "",
      subjectIds: [...new Set(teacher.teachingAssignments.map((row) => row.subjectId))],
      classIds: [...new Set(teacher.teachingAssignments.map((row) => row.sectionId))],
    }));

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}