import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError, NotFoundError } from "@/lib/errors";
import { deletePeriod, updatePeriod } from "@/lib/services/academic-service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string; id: string }> },
) {
  try {
    const { tenantSlug, id } = await context.params;
    if (!UUID.test(id)) throw new NotFoundError("Period not found.");
    const { tenant } = await resolveTenantContext(request, tenantSlug, ["SCHOOL_ADMIN"]);
    const body: unknown = await request.json().catch(() => null);
    return NextResponse.json(await updatePeriod(tenant.id, id, body));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string; id: string }> },
) {
  try {
    const { tenantSlug, id } = await context.params;
    if (!UUID.test(id)) throw new NotFoundError("Period not found.");
    const { tenant } = await resolveTenantContext(request, tenantSlug, ["SCHOOL_ADMIN"]);
    return NextResponse.json(await deletePeriod(tenant.id, id));
  } catch (error) {
    return handleApiError(error);
  }
}
