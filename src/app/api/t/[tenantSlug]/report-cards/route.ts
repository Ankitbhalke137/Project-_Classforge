import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext, withTenant } from "@/lib/tenant-context";
import { BadRequestError, ForbiddenError, NotFoundError, handleApiError } from "@/lib/errors";
import { getClassReportCards } from "@/lib/services/report-card-service";
import { getTeacherAssignedSectionIds } from "@/lib/services/student-service";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/t/:tenantSlug/report-cards?classId=…&term=…
 *
 * Whole-class report cards for one published term. `classId` may be the section
 * id used by the classes list or the parent class id; the service resolves both.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant, membership } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
      "TEACHER",
    ]);

    const classId = (request.nextUrl.searchParams.get("classId") ?? "").trim();
    const term = (request.nextUrl.searchParams.get("term") ?? "").trim();

    if (!classId) {
      throw new BadRequestError("Choose a class.", { classId: "Class is required" });
    }

    if (membership.role === "TEACHER") {
      await withTenant(tenant.id, async (tx) => {
        const assignedSectionIds = await getTeacherAssignedSectionIds(
          tx,
          tenant.id,
          membership.userId,
        );

        const section = await tx.section.findFirst({
          where: { id: classId, tenantId: tenant.id },
          select: { id: true },
        });

        let isAssigned = false;
        if (section) {
          isAssigned = assignedSectionIds.includes(section.id);
        } else {
          const schoolClass = await tx.schoolClass.findFirst({
            where: { id: classId, tenantId: tenant.id },
            select: { sections: { select: { id: true } } },
          });
          if (!schoolClass) throw new NotFoundError("Class not found.");
          isAssigned = schoolClass.sections.some((s) => assignedSectionIds.includes(s.id));
        }

        if (!isAssigned) {
          throw new ForbiddenError("You can only view report cards for classes assigned to you.");
        }
      });
    }

    return NextResponse.json(await getClassReportCards(tenant.id, classId, term));
  } catch (error) {
    return handleApiError(error);
  }
}
