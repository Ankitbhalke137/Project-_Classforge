import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";
import { createExam, listExams } from "@/lib/services/exam-service";

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

    const params = request.nextUrl.searchParams;
    const limit = Number(params.get("limit") ?? params.get("pageSize")) || undefined;
    return NextResponse.json(
      await listExams(tenant.id, {
        page: Number(params.get("page") ?? 1) || 1,
        limit,
        search: params.get("search") ?? undefined,
        status: params.get("status") ?? undefined,
        classId: params.get("classId") ?? undefined,
        term: params.get("term") ?? undefined,
      }),
    );
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
    const { tenant } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
      "TEACHER",
    ]);
    const body: unknown = await request.json().catch(() => null);
    return NextResponse.json(await createExam(tenant.id, body), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
