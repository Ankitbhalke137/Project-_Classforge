import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/t/:tenantSlug/parents/:id/children
 *
 * Returns the real children of a specific parent/guardian in the database.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string; id: string }> },
) {
  try {
    const { tenantSlug, id } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug);

    const cleanId = id.replace(/^par_/, "");
    const isUuid = UUID.test(cleanId);

    const students = await prisma.student.findMany({
      where: {
        tenantId: tenant.id,
        OR: [
          ...(isUuid ? [{ id: cleanId }, { userId: cleanId }] : []),
          { guardianPhone: cleanId },
          { guardianName: { contains: cleanId, mode: "insensitive" } },
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
    });

    const formatted = students.map((st) => ({
      id: st.id,
      name: `${st.firstName} ${st.lastName}`.trim(),
      email: `${st.firstName.toLowerCase()}.${st.lastName.toLowerCase()}@${tenantSlug}.edu`,
      admissionNo: st.admissionNo,
      className: st.enrolments[0]
        ? `${st.enrolments[0].section.schoolClass.name} - ${st.enrolments[0].section.name}`
        : "",
      status: "ACTIVE" as const,
      classId: st.enrolments[0]?.sectionId ?? "",
      grade: st.enrolments[0]?.section.schoolClass.name ?? "",
      section: st.enrolments[0]?.section.name ?? "",
      gender: "OTHER" as const,
      dateOfBirth: st.dateOfBirth?.toISOString() ?? "",
      phone: st.phone ?? "",
      address: "",
      bloodGroup: "",
      parentId: id,
      admittedOn: st.createdAt.toISOString(),
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    return handleApiError(error);
  }
}
