import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError, NotFoundError } from "@/lib/errors";
import {
  getStudentById,
  updateStudent,
  deleteOrDeactivateStudent,
} from "@/lib/services/student-service";

interface RouteContext {
  params: Promise<{ tenantSlug: string; id: string }>;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A malformed id is not a server error. Without this, Prisma rejects the cast
 * and the route answers 500 instead of 404.
 */
function assertValidId(id: string) {
  if (!UUID_PATTERN.test(id)) throw new NotFoundError("Student not found.");
}

/**
 * GET /api/t/:tenantSlug/students/:id
 *
 * Fetches single student details.
 * - School Admin: access to any student in the school.
 * - Teacher: access to students in the school.
 * - Student: access ONLY to their own student record (ownership check).
 * - Cross-tenant resource: returns 404 to avoid leaking existence across tenants.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { tenantSlug, id } = await context.params;
    assertValidId(id);

    const { tenant, membership } = await resolveTenantContext(
      request,
      tenantSlug,
      ["SCHOOL_ADMIN", "TEACHER", "STUDENT", "PARENT"],
    );

    const student = await getStudentById(tenant.id, id, {
      userId: membership.userId,
      role: membership.role,
    });

    if (!student) {
      throw new NotFoundError("Student not found.");
    }

    return NextResponse.json(student);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/t/:tenantSlug/students/:id
 *
 * Updates student fields, section enrolment, or status.
 * - Allowed roles: Only SCHOOL_ADMIN.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { tenantSlug, id } = await context.params;
    assertValidId(id);

    const { tenant, membership } = await resolveTenantContext(
      request,
      tenantSlug,
      ["SCHOOL_ADMIN"],
    );

    const body = await request.json().catch(() => ({}));

    const updatedStudent = await updateStudent(tenant.id, id, body, {
      userId: membership.userId,
      role: membership.role,
    });

    return NextResponse.json(updatedStudent);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/t/:tenantSlug/students/:id
 *
 * Deletes or deactivates student record.
 * Query param:
 * - ?permanent=true (permanently deletes record and cascades)
 * - Default: deactivates student by setting enrolments to WITHDRAWN and membership to INACTIVE.
 * - Allowed roles: Only SCHOOL_ADMIN.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { tenantSlug, id } = await context.params;
    assertValidId(id);

    const { tenant, membership } = await resolveTenantContext(
      request,
      tenantSlug,
      ["SCHOOL_ADMIN"],
    );

    const searchParams = request.nextUrl.searchParams;
    const permanent = searchParams.get("permanent") === "true";

    const result = await deleteOrDeactivateStudent(
      tenant.id,
      id,
      { permanent },
      {
        userId: membership.userId,
        role: membership.role,
      },
    );

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
