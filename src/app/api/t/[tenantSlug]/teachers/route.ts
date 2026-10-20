import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";
import { sendCredentialsEmail, appUrl } from "@/lib/mail";
import {
  createTeacher,
  formatTeacher,
  teacherInclude,
} from "@/lib/services/teacher-service";

/**
 * GET /api/t/:tenantSlug/teachers
 *
 * The staff roster. Phone, qualification and designation now have columns; the
 * subject cell is composed from the teacher's teaching assignments, so it stays
 * blank until assignments exist rather than being invented.
 */
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

    const teachers = await prisma.teacher.findMany({
      where: { tenantId: tenant.id },
      include: teacherInclude(tenant.id),
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    return NextResponse.json(teachers.map(formatTeacher));
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/t/:tenantSlug/teachers
 *
 * Adds one teacher: the sign-in account, the membership and the roster row, in
 * that order. A new account gets a temporary password and an email; an existing
 * account keeps its password and is only added to this school.
 *
 * The password is returned once so the School Admin can hand it over if the
 * email never lands. It is never stored in the clear.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, ["SCHOOL_ADMIN"]);

    const body: unknown = await request.json().catch(() => null);
    const { teacher, temporaryPassword, existingAccount } = await createTeacher(tenant.id, body);

    let emailSent = false;
    let emailError: string | null = null;

    if (temporaryPassword) {
      const result = await sendCredentialsEmail({
        to: teacher.email,
        name: teacher.name,
        schoolName: tenant.name,
        role: "Teacher",
        temporaryPassword,
        signInUrl: `${appUrl()}/login`,
      });
      emailSent = result.sent;
      emailError = result.error ?? null;
    }

    return NextResponse.json(
      { teacher, temporaryPassword, emailSent, emailError, existingAccount },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
