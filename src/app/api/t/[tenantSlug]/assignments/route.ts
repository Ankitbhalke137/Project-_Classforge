import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";

/**
 * GET /api/t/:tenantSlug/assignments
 *
 * There is no assignment or submission table in the schema, so this answers with
 * an empty page rather than 404ing — the screen should show "nothing set yet",
 * not "this endpoint does not exist".
 *
 * Delete this route once an `Assignment` model exists.
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