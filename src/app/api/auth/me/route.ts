import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";

/**
 * GET /api/auth/me
 *
 * Returns the currently authenticated user's profile and their active school
 * memberships across all tenants.
 *
 * Format specified in audit report:
 * {
 *   user: { id, name, email, isSuperAdmin },
 *   schools: [
 *     { schoolId, schoolSlug, schoolName, role, status }
 *   ]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);

    const schools = user.memberships
      .filter((membership) => membership.tenant.status === "ACTIVE")
      .map((membership) => ({
        id: membership.tenant.id,
        schoolId: membership.tenant.id,
        slug: membership.tenant.slug,
        schoolSlug: membership.tenant.slug,
        name: membership.tenant.name,
        schoolName: membership.tenant.name,
        role: membership.role,
        status: membership.tenant.status,
      }));

    const isSuperAdmin = user.platformRole === "SUPER_ADMIN";

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isSuperAdmin,
      },
      schools,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
