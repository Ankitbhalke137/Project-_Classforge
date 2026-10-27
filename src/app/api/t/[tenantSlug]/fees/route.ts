import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";
import { createInvoice, listFees } from "@/lib/services/fee-service";

/**
 * GET /api/t/:tenantSlug/fees
 *
 * Lists fee invoices with filtering and pagination. A School Admin sees the
 * whole ledger; a parent sees only their own children's invoices (resolved
 * from the session, never from a client-supplied email).
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

    const searchParams = request.nextUrl.searchParams;
    const query = {
      page: searchParams.get("page") ? Number(searchParams.get("page")) : undefined,
      pageSize: searchParams.get("pageSize")
        ? Number(searchParams.get("pageSize"))
        : undefined,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
      search: searchParams.get("search") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      classId: searchParams.get("classId") ?? undefined,
      term: searchParams.get("term") ?? undefined,
    };

    const result = await listFees(tenant.id, query, {
      role: membership.role,
      userId: membership.userId,
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/t/:tenantSlug/fees
 *
 * Raises a new invoice against one student. School Admins only.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant, membership } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
    ]);

    const body: unknown = await request.json().catch(() => null);
    const invoice = await createInvoice(tenant.id, body, {
      role: membership.role,
      userId: membership.userId,
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
