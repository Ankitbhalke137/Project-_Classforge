import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError, NotFoundError } from "@/lib/errors";
import { getExamResults, saveExamMarks } from "@/lib/services/exam-service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The marks sheet is staff-only: it contains every student's score. */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string; id: string }> },
) {
  try {
    const { tenantSlug, id } = await context.params;
    if (!UUID.test(id)) throw new NotFoundError("Exam not found.");
    const { tenant } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
      "TEACHER",
    ]);
    return NextResponse.json(await getExamResults(tenant.id, id));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string; id: string }> },
) {
  try {
    const { tenantSlug, id } = await context.params;
    if (!UUID.test(id)) throw new NotFoundError("Exam not found.");
    const { tenant, membership } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
      "TEACHER",
    ]);
    const body: unknown = await request.json().catch(() => null);
    return NextResponse.json(
      await saveExamMarks(tenant.id, id, membership.userId, body, membership.role),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
