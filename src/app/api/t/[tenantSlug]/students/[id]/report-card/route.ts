import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError, NotFoundError } from "@/lib/errors";
import { getStudentReportCard } from "@/lib/services/report-card-service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/t/:tenantSlug/students/:id/report-card?term=Term+1
 *
 * One student's published report card. A student may only open their own;
 * staff may open any student in the school.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string; id: string }> },
) {
  try {
    const { tenantSlug, id } = await context.params;
    if (!UUID.test(id)) throw new NotFoundError("Student not found.");

    const { tenant, membership } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
      "TEACHER",
      "STUDENT",
    ]);

    const term = (request.nextUrl.searchParams.get("term") ?? "").trim();
    const report = await getStudentReportCard(tenant.id, id, term, {
      userId: membership.userId,
      role: membership.role,
    });

    return NextResponse.json(report);
  } catch (error) {
    return handleApiError(error);
  }
}
