import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError, NotFoundError } from "@/lib/errors";
import { resendStudentCredentials } from "@/lib/services/student-service";
import { sendCredentialsEmail, appUrl } from "@/lib/mail";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/t/:tenantSlug/students/:id/resend-credentials
 *
 * Issues a fresh temporary password and emails it. Used when the first mail
 * never arrived, or the student lost the password shown at creation.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string; id: string }> },
) {
  try {
    const { tenantSlug, id } = await context.params;
    if (!UUID.test(id)) throw new NotFoundError("Student not found.");

    const { tenant, membership } = await resolveTenantContext(
      request,
      tenantSlug,
      ["SCHOOL_ADMIN", "TEACHER"],
    );

    const credentials = await resendStudentCredentials(tenant.id, id, {
      userId: membership.userId,
      role: membership.role,
    });

    const result = await sendCredentialsEmail({
      to: credentials.email,
      name: credentials.name,
      schoolName: tenant.name,
      role: "Student",
      temporaryPassword: credentials.temporaryPassword,
      signInUrl: `${appUrl() || request.nextUrl.origin}/login`,
    });

    return NextResponse.json({
      ...credentials,
      emailSent: result.sent,
      emailError: result.error ?? null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
