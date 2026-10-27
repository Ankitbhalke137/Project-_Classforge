import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext, withTenant } from "@/lib/tenant-context";
import { ForbiddenError, handleApiError, NotFoundError } from "@/lib/errors";
import { deleteClass, listClasses, updateClass } from "@/lib/services/academic-service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string; id: string }> },
) {
  try {
    const { tenantSlug, id } = await context.params;
    if (!UUID.test(id)) throw new NotFoundError("Class not found.");
    const { tenant, user, membership } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
      "TEACHER",
      "STUDENT",
    ]);

    const row = (await listClasses(tenant.id)).find((entry) => entry.id === id);
    if (!row) throw new NotFoundError("Class not found.");

    // A student can only read the section they are actively enrolled in.
    if (membership.role === "STUDENT") {
      const student = await withTenant(tenant.id, async (tx) =>
        tx.student.findFirst({
          where: { tenantId: tenant.id, userId: user.id },
          select: {
            enrolments: {
              where: { status: "ACTIVE", sectionId: id },
              select: { id: true },
            },
          },
        })
      );
      if (!student?.enrolments.length) {
        throw new ForbiddenError("You can only view your own class.");
      }
    }

    return NextResponse.json(row);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string; id: string }> },
) {
  try {
    const { tenantSlug, id } = await context.params;
    if (!UUID.test(id)) throw new NotFoundError("Class not found.");
    const { tenant } = await resolveTenantContext(request, tenantSlug, ["SCHOOL_ADMIN"]);
    const body: unknown = await request.json().catch(() => null);
    return NextResponse.json(await updateClass(tenant.id, id, body));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string; id: string }> },
) {
  try {
    const { tenantSlug, id } = await context.params;
    if (!UUID.test(id)) throw new NotFoundError("Class not found.");
    const { tenant } = await resolveTenantContext(request, tenantSlug, ["SCHOOL_ADMIN"]);
    return NextResponse.json(await deleteClass(tenant.id, id));
  } catch (error) {
    return handleApiError(error);
  }
}
