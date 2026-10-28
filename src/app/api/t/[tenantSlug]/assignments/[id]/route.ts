import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError, NotFoundError } from "@/lib/errors";
import { getAssignment } from "@/lib/services/assignment-service";

/**
 * GET /api/t/:tenantSlug/assignments/:id
 *
 * Returns detailed assignment information including submissions and stats.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string; id: string }> },
) {
  try {
    const { tenantSlug, id } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug);

    const detail = await getAssignment(tenantSlug, tenant.id, id);
    if (!detail) {
      throw new NotFoundError("Assignment not found.");
    }

    return NextResponse.json(detail);
  } catch (error) {
    return handleApiError(error);
  }
}
