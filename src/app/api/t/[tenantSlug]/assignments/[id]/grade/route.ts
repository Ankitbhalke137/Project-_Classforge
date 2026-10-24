import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";
import { gradeSubmission } from "@/lib/services/assignment-service";

/**
 * POST /api/t/:tenantSlug/assignments/:id/grade
 *
 * Staff marks a student's submission.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string; id: string }> },
) {
  try {
    const { tenantSlug, id } = await context.params;
    await resolveTenantContext(request, tenantSlug, ["SCHOOL_ADMIN", "TEACHER"]);

    const body = await request.json().catch(() => null);
    if (!body || !body.studentId || body.marksObtained === undefined) {
      return NextResponse.json(
        { message: "Student ID and marksObtained are required." },
        { status: 400 },
      );
    }

    const graded = await gradeSubmission(
      tenantSlug,
      id,
      body.studentId,
      Number(body.marksObtained),
      body.feedback,
    );
    return NextResponse.json(graded, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}
