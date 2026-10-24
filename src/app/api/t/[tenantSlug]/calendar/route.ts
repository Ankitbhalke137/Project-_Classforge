import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";
import { getCalendar } from "@/lib/services/academic-service";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
      "TEACHER",
      "STUDENT",
      "PARENT",
    ]);
    return NextResponse.json(await getCalendar(tenant.id));
  } catch (error) {
    return handleApiError(error);
  }
}
