import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";

/**
 * GET /api/t/:tenantSlug/fees/summary
 *
 * No fee table exists, so every total is genuinely zero rather than a guess.
 * Delete this route once a `FeeInvoice` model exists.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ tenantSlug: string }> }) {
  try {
    const { tenantSlug } = await context.params;
    await resolveTenantContext(request, tenantSlug);

    return NextResponse.json({
      totalBilled: 0,
      totalCollected: 0,
      outstanding: 0,
      overdueAmount: 0,
      overdueCount: 0,
      collectionRate: 0,
    });
  } catch (error) {
    return handleApiError(error);
  }
}