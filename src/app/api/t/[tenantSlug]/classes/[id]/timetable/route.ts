import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext, withTenant } from "@/lib/tenant-context";
import { handleApiError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { getTimetable, replaceTimetable } from "@/lib/services/academic-service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const READ_ROLES = ["SCHOOL_ADMIN", "TEACHER", "STUDENT", "PARENT"] as const;

/**
 * GET /api/t/:tenantSlug/classes/:id/timetable
 *
 * `:id` is the section id returned by the classes list. It is called a class in
 * the UI because "Grade 6 - A" reads as one class there.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string; id: string }> },
) {
  try {
    const { tenantSlug, id } = await context.params;
    if (!UUID.test(id)) throw new NotFoundError("Class not found.");
    const { tenant, user, membership } = await resolveTenantContext(request, tenantSlug, [
      ...READ_ROLES,
    ]);

    // A student may only read the timetable of their own section.
    if (membership.role === "STUDENT") {
      const own = await withTenant(tenant.id, async (tx) =>
        tx.student.findFirst({
          where: {
            tenantId: tenant.id,
            userId: user.id,
            enrolments: { some: { status: "ACTIVE", sectionId: id } },
          },
          select: { id: true },
        })
      );
      if (!own) {
        throw new ForbiddenError("You may only view your own class timetable.");
      }
    }

    const result = await getTimetable(tenant.id, id);
    return NextResponse.json(result.slots);
  } catch (error) {
    return handleApiError(error);
  }
}

/** Replaces the whole weekly grid for one section. */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string; id: string }> },
) {
  try {
    const { tenantSlug, id } = await context.params;
    if (!UUID.test(id)) throw new NotFoundError("Class not found.");
    const { tenant } = await resolveTenantContext(request, tenantSlug, ["SCHOOL_ADMIN"]);
    const body: unknown = await request.json().catch(() => null);
    const result = await replaceTimetable(tenant.id, id, body);
    return NextResponse.json(result.slots);
  } catch (error) {
    return handleApiError(error);
  }
}
