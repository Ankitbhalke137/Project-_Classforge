import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";
import { getFeeSummary } from "@/lib/services/fee-service";

/**
 * GET /api/t/:tenantSlug/fees/summary
 *
 * Calculates real totals for billing, collection, and overdue dues.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug);

    const email = request.nextUrl.searchParams.get("email") ?? undefined;
    const summary = await getFeeSummary(tenantSlug, tenant.id, email);

    return NextResponse.json(summary);
  } catch (error) {
    return handleApiError(error);
  }
}
