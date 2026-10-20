import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";
import { createTerm, listTerms } from "@/lib/services/academic-service";

const READ_ROLES = ["SCHOOL_ADMIN", "TEACHER", "STUDENT"] as const;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, [...READ_ROLES]);
    const academicYearId = request.nextUrl.searchParams.get("academicYearId") ?? undefined;
    return NextResponse.json(await listTerms(tenant.id, academicYearId));
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
    return NextResponse.json(await createTerm(tenant.id, body), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
