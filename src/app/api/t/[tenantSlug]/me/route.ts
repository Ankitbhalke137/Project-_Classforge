import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";

/**
 * GET /api/t/:tenantSlug/me?email=
 *
 * Who the signed-in account is inside this school: their student record, their
 * teacher record, or their children.
 *
 * Guardians have no table in the schema yet, so `children` is always empty —
 * a parent sees an empty list rather than another family's children.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ tenantSlug: string }> }) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant, user, membership } = await resolveTenantContext(request, tenantSlug);

    const [student, teacher] = await Promise.all([
      prisma.student.findFirst({
        where: { tenantId: tenant.id, userId: user.id },
        include: {
          enrolments: {
            where: { status: "ACTIVE" },
            take: 1,
            select: {
              sectionId: true,
              section: {
                select: {
                  name: true,
                  schoolClass: { select: { name: true } },
                },
              },
            },
          },
        },
      }),
      prisma.teacher.findFirst({
        where: { tenantId: tenant.id, userId: user.id },
      }),
    ]);

    return NextResponse.json({
      role: membership.role,
      student: student
        ? {
            id: student.id,
            name: `${student.firstName} ${student.lastName}`.trim(),
            email: user.email,
            admissionNo: student.admissionNo,
            className: student.enrolments[0]
              ? `${student.enrolments[0].section.schoolClass.name} - ${student.enrolments[0].section.name}`
              : "",
            status: "ACTIVE",
            classId: student.enrolments[0]?.sectionId ?? "",
            grade: "",
            section: "",
            gender: "OTHER",
            dateOfBirth: student.dateOfBirth?.toISOString() ?? "",
            phone: "",
            address: "",
            bloodGroup: "",
            parentId: null,
            admittedOn: student.createdAt.toISOString(),
          }
        : null,
      // No guardian table yet, so nothing to list.
      children: [] as unknown[],
      teacher: teacher
        ? {
            id: teacher.id,
            name: `${teacher.firstName} ${teacher.lastName}`.trim(),
            email: user.email,
            employeeNo: teacher.employeeNo ?? "",
            subject: "",
            phone: "",
            qualification: "",
            designation: "",
            joinedOn: teacher.createdAt.toISOString(),
            subjectIds: [],
            classIds: [],
          }
        : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}