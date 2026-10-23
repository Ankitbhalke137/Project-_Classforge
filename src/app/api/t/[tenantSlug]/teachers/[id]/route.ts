import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError, NotFoundError } from "@/lib/errors";
import {
  deactivateTeacher,
  formatTeacher,
  teacherInclude,
  updateTeacher,
} from "@/lib/services/teacher-service";

interface RouteContext {
  params: Promise<{ tenantSlug: string; id: string }>;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertValidId(id: string) {
  if (!UUID_PATTERN.test(id)) throw new NotFoundError("Teacher not found.");
}

/** GET /api/t/:tenantSlug/teachers/:id — one row from the staff roster. */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { tenantSlug, id } = await context.params;
    assertValidId(id);
    const { tenant } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
      "TEACHER",
    ]);

    const teacher = await prisma.teacher.findFirst({
      where: { id, tenantId: tenant.id },
      include: teacherInclude(tenant.id),
    });
    if (!teacher) throw new NotFoundError("Teacher not found.");

    return NextResponse.json(formatTeacher(teacher));
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/t/:tenantSlug/teachers/:id
 *
 * Edits the staff profile, or flips access with `status`. The account row is
 * kept either way — a teacher who leaves keeps their history.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { tenantSlug, id } = await context.params;
    assertValidId(id);
    const { tenant } = await resolveTenantContext(request, tenantSlug, ["SCHOOL_ADMIN"]);

    const body: unknown = await request.json().catch(() => null);
    const teacher = await updateTeacher(tenant.id, id, body);

    return NextResponse.json(teacher);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/t/:tenantSlug/teachers/:id
 *
 * Deactivates access. The `teachers` row, the `users` row and the membership are
 * all kept, so reactivation is a PATCH back to ACTIVE.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { tenantSlug, id } = await context.params;
    assertValidId(id);
    const { tenant } = await resolveTenantContext(request, tenantSlug, ["SCHOOL_ADMIN"]);

    const result = await deactivateTeacher(tenant.id, id);

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
