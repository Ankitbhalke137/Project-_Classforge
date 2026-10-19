import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";

/**
 * GET /api/t/:tenantSlug/parents
 *
 * Guardians have no table in the schema. This answers with an empty page so the
 * screen renders an empty state instead of an error. Delete once a `Parent`
 * model exists.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ tenantSlug: string }> }) {
  try {
    const { tenantSlug } = await context.params;
    await resolveTenantContext(request, tenantSlug);

    return NextResponse.json({ data: [], total: 0, page: 1, pageSize: 10 });
  } catch (error) {
    return handleApiError(error);
  }
}