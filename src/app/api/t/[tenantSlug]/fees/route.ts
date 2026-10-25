import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";
import { listFees } from "@/lib/services/fee-service";

/**
 * GET /api/t/:tenantSlug/fees
 *
 * Lists fee invoices with filtering and pagination.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug);

    const searchParams = request.nextUrl.searchParams;
    const query = {
      page: searchParams.get("page") ? Number(searchParams.get("page")) : undefined,
      pageSize: searchParams.get("pageSize") ? Number(searchParams.get("pageSize")) : undefined,
      search: searchParams.get("search") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      classId: searchParams.get("classId") ?? undefined,
      term: searchParams.get("term") ?? undefined,
      email: searchParams.get("email") ?? undefined,
    };

    const result = await listFees(tenantSlug, tenant.id, query);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
