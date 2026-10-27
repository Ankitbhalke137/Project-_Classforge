import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";
import { recordPayment } from "@/lib/services/fee-service";

/**
 * PATCH /api/t/:tenantSlug/fees/:id
 *
 * Records a payment against an invoice. The body is `{ amount }`; the server
 * adds it to the paid total and recalculates the status. Overpaying is
 * rejected rather than silently accepting a credit.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string; id: string }> },
) {
  try {
    const { tenantSlug, id } = await context.params;
    const { tenant, membership } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
    ]);

    const body: unknown = await request.json().catch(() => null);
    const invoice = await recordPayment(tenant.id, id, body, {
      role: membership.role,
      userId: membership.userId,
    });

    return NextResponse.json(invoice);
  } catch (error) {
    return handleApiError(error);
  }
}
