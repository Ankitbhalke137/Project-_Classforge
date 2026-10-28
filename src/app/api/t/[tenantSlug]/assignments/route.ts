import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";
import {
  listAssignments,
  createAssignment,
} from "@/lib/services/assignment-service";

/**
 * GET /api/t/:tenantSlug/assignments
 *
 * Lists assignments with query filtering and pagination.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug);

    const searchParams = request.nextUrl.searchParams;
    const query = {
      page: searchParams.get("page") ? Number(searchParams.get("page")) : undefined,
      pageSize: searchParams.get("pageSize") ? Number(searchParams.get("pageSize")) : undefined,
      search: searchParams.get("search") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      classId: searchParams.get("classId") ?? undefined,
      subjectId: searchParams.get("subjectId") ?? undefined,
      mine: searchParams.get("mine") === "true",
      email: searchParams.get("email") ?? undefined,
    };

    const result = await listAssignments(tenantSlug, tenant.id, query);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/t/:tenantSlug/assignments
 *
 * Creates a new assignment.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant, user } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
      "TEACHER",
    ]);

    const body = await request.json().catch(() => null);
    if (!body || !body.title || !body.classId || !body.subjectId || !body.dueDate) {
      return NextResponse.json(
        { message: "Title, class, subject, and due date are required." },
        { status: 400 },
      );
    }

    const created = await createAssignment(tenantSlug, tenant.id, body, user.id);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
