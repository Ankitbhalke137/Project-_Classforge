import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";
import { createAssignment, listAssignments } from "@/lib/services/academic-service";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
      "TEACHER",
    ]);
    const sectionId = request.nextUrl.searchParams.get("sectionId") ?? undefined;
    const teacherId = request.nextUrl.searchParams.get("teacherId") ?? undefined;
    return NextResponse.json(await listAssignments(tenant.id, sectionId, teacherId));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, ["SCHOOL_ADMIN"]);
    const body: unknown = await request.json().catch(() => null);
    return NextResponse.json(await createAssignment(tenant.id, body), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
