import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";
import { submitAssignment } from "@/lib/services/assignment-service";

/**
 * POST /api/t/:tenantSlug/assignments/:id/submissions
 *
 * Student submits work for an assignment.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string; id: string }> },
) {
  try {
    const { tenantSlug, id } = await context.params;
    await resolveTenantContext(request, tenantSlug);

    const body = await request.json().catch(() => null);
    if (!body || !body.studentId) {
      return NextResponse.json({ message: "Student ID is required." }, { status: 400 });
    }

    const submission = await submitAssignment(
      tenantSlug,
      id,
      body.studentId,
      body.status || "SUBMITTED",
    );
    return NextResponse.json(submission, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}
