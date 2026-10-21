import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";

/**
 * GET /api/t/:tenantSlug/fees
 *
 * There is no fee or invoice table in the schema, so there is nothing to read
 * and nothing to invent. This answers with an empty page, which is exactly what
 * "the database has no fees" should look like to the screen.
 *
 * Delete this route once a `FeeInvoice` model exists and it can query for real.
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