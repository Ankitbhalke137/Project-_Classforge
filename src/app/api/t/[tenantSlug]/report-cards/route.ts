import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/tenant-context";
import { BadRequestError, handleApiError } from "@/lib/errors";
import { getClassReportCards } from "@/lib/services/report-card-service";

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
    const { tenant } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
      "TEACHER",
    ]);

    const classId = (request.nextUrl.searchParams.get("classId") ?? "").trim();
    const term = (request.nextUrl.searchParams.get("term") ?? "").trim();

    if (!classId) {
      throw new BadRequestError("Choose a class.", { classId: "Class is required" });
    }

    return NextResponse.json(await getClassReportCards(tenant.id, classId, term));
  } catch (error) {
    return handleApiError(error);
  }
}
