import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";
import { getFeeSummary } from "@/lib/services/fee-service";

/**
 * GET /api/t/:tenantSlug/fees/summary
 *
 * Real totals for billing, collection and overdue dues. The scope comes from
 * the session, so a parent cannot request another family's totals.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant, membership } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
      "PARENT",
    ]);

    const summary = await getFeeSummary(tenant.id, {
      role: membership.role,
      userId: membership.userId,
    });

    return NextResponse.json(summary);
  } catch (error) {
    return handleApiError(error);
  }
}
