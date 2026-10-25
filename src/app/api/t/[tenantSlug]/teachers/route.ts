import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";
import { sendCredentialsEmail, appUrl } from "@/lib/mail";
import {
  createTeacher,
  listTeachers,
} from "@/lib/services/teacher-service";

/**
 * GET /api/t/:tenantSlug/teachers?page=&limit=&search=&sort=&status=
 *
 * The staff roster with server-side pagination, search, and sorting.
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

    const params = request.nextUrl.searchParams;
    const result = await listTeachers(tenant.id, {
      page: Number(params.get("page") ?? 1) || 1,
      limit: Number(params.get("limit") ?? params.get("pageSize")) || undefined,
      search: params.get("search") ?? undefined,
      sort: params.get("sort") ?? undefined,
      status: (params.get("status") as "ACTIVE" | "INACTIVE" | "ALL") ?? undefined,
    });

    return NextResponse.json(result);
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
        signInUrl: `${appUrl() || request.nextUrl.origin}/login`,
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
