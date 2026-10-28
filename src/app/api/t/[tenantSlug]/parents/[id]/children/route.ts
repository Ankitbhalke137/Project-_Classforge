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

    // The directory encodes the guardian key as base64url; decode it back to
    // the name + phone pair the student rows carry. A raw UUID is still
    // accepted so older links keep working.
    let guardianName: string | null = null;
    let guardianPhone: string | null = null;
    if (!isUuid) {
      const decoded = Buffer.from(cleanId, "base64url").toString("utf8");
      if (decoded.includes("|")) {
        const [name, phone] = decoded.split("|");
        guardianName = name || null;
        guardianPhone = phone || null;
      }
    }

    const students = await prisma.student.findMany({
      where: {
        tenantId: tenant.id,
        OR: [
          ...(isUuid ? [{ id: cleanId }, { userId: cleanId }] : []),
          ...(guardianPhone
            ? [{ guardianPhone }]
            : guardianName
              ? [{ guardianName: { equals: guardianName, mode: "insensitive" as const } }]
              : []),
        ],
      },
      include: {
        user: { select: { email: true } },
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
      // A student may have no login; their linked account is the only real
      // email we hold. Do not derive one from their name.
      email: st.user?.email ?? "",
      admissionNo: st.admissionNo,
      className: st.enrolments[0]
        ? `${st.enrolments[0].section.schoolClass.name} - ${st.enrolments[0].section.name}`
        : "",
      status: st.status === "ACTIVE" ? ("ACTIVE" as const) : ("INACTIVE" as const),
      classId: st.enrolments[0]?.sectionId ?? "",
      grade: st.enrolments[0]?.section.schoolClass.name ?? "",
      section: st.enrolments[0]?.section.name ?? "",
      dateOfBirth: st.dateOfBirth?.toISOString() ?? null,
      phone: st.phone,
      parentId: id,
      admittedOn: st.createdAt.toISOString(),
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    return handleApiError(error);
  }
}
