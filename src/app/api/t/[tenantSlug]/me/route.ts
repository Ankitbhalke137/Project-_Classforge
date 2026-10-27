import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext, withTenant } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";

/**
 * GET /api/t/:tenantSlug/me?email=&role=
 *
 * Who the signed-in account is inside this school: their student record, their
 * teacher record, or their children.
 *
 * When the account holds multiple roles in this school, pass ?role= to select
 * which role's profile to return. Without it, the first active membership is
 * used.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ tenantSlug: string }> }) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant, user, membership } = await resolveTenantContext(request, tenantSlug);

    // Which role's profile to return: the requested role, or the active
    // membership's role as a fallback.
    const requestedRole = (request.nextUrl.searchParams.get("role") ?? "") as string;
    const role = requestedRole || membership.role;

    const isParent = role === "PARENT";
    const isStudent = role === "STUDENT";
    const isTeacher = role === "TEACHER";

    const { student, teacher, dbChildren, homeroomClasses } = await withTenant(
      tenant.id,
      async (tx) => {
        const student = isStudent
          ? await tx.student.findFirst({
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
            })
          : null;

        const teacher = isTeacher
          ? await tx.teacher.findFirst({
              where: { tenantId: tenant.id, userId: user.id },
              include: {
                teachingAssignments: {
                  include: {
                    subject: { select: { name: true } },
                  },
                },
              },
            })
          : null;

        const dbChildren = isParent
          ? await tx.student.findMany({
              where: {
                tenantId: tenant.id,
                OR: [
                  { guardianName: { contains: user.name, mode: "insensitive" } },
                  { guardianPhone: user.email },
                  { userId: user.id },
                ],
              },
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
              take: 5,
            })
          : [];

        // A teacher's assigned classes = sections they teach + sections of classes
        // they are homeroom teacher of. A homeroom-only teacher (no assignments yet)
        // still needs to see their class on the dashboard.
        const homeroomClasses = teacher
          ? await tx.schoolClass.findMany({
              where: { tenantId: tenant.id, homeroomTeacherId: teacher.id },
              select: { sections: { select: { id: true } } },
            })
          : [];

        return { student, teacher, dbChildren, homeroomClasses };
      },
    );

    const formattedChildren = dbChildren.map((st) => ({
      id: st.id,
      name: `${st.firstName} ${st.lastName}`.trim(),
      email: user.email,
      admissionNo: st.admissionNo,
      className: st.enrolments[0]
        ? `${st.enrolments[0].section.schoolClass.name} - ${st.enrolments[0].section.name}`
        : "Class 10 - A",
      status: "ACTIVE" as const,
      classId: st.enrolments[0]?.sectionId ?? "",
      grade: st.enrolments[0]?.section.schoolClass.name ?? "",
      section: st.enrolments[0]?.section.name ?? "",
      gender: "OTHER" as const,
      dateOfBirth: st.dateOfBirth?.toISOString() ?? "",
      phone: st.phone ?? "",
      address: "",
      bloodGroup: "",
      parentId: user.id,
      admittedOn: st.createdAt.toISOString(),
    }));

    return NextResponse.json({
      role,
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
      children: formattedChildren,
      teacher: teacher
        ? {
            id: teacher.id,
            name: `${teacher.firstName} ${teacher.lastName}`.trim(),
            email: user.email,
            employeeNo: teacher.employeeNo ?? "",
            subject: [
              ...new Set(
                teacher.teachingAssignments
                  .map((row) => row.subject?.name)
                  .filter((name): name is string => Boolean(name)),
              ),
            ].join(", "),
            phone: "",
            qualification: "",
            designation: "",
            joinedOn: teacher.createdAt.toISOString(),
            subjectIds: [
              ...new Set(teacher.teachingAssignments.map((row) => row.subjectId)),
            ],
            classIds: [
              ...new Set([
                ...teacher.teachingAssignments.map((row) => row.sectionId),
                ...homeroomClasses.flatMap((c) => c.sections.map((s) => s.id)),
              ]),
            ],
          }
        : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
