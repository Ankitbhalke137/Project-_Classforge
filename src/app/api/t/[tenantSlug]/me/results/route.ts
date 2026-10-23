import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";
import { getMyResults } from "@/lib/services/exam-service";

/**
 * GET /api/t/:tenantSlug/me/results
 *
 * The signed-in student's own published results. Parent memberships are not
 * stored by the current schema, so only the student role can call this.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant, user } = await resolveTenantContext(request, tenantSlug, ["STUDENT"]);

    return NextResponse.json(await getMyResults(tenant.id, user.id));
  } catch (error) {
    return handleApiError(error);
  }
}
