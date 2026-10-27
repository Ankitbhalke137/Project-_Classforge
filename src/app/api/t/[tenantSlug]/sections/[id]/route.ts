import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext, withTenant } from "@/lib/tenant-context";
import { handleApiError, NotFoundError } from "@/lib/errors";
import { deleteSection, updateSection } from "@/lib/services/academic-service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string; id: string }> },
) {
  try {
    const { tenantSlug, id } = await context.params;
    if (!UUID.test(id)) throw new NotFoundError("Section not found.");
    const { tenant } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
      "TEACHER",
    ]);

    const section = await withTenant(tenant.id, async (tx) =>
      tx.section.findFirst({
        where: { id, tenantId: tenant.id },
        select: {
          id: true,
          classId: true,
          name: true,
          schoolClass: { select: { name: true } },
          _count: { select: { enrolments: { where: { status: "ACTIVE" } } } },
        },
      })
    );
    if (!section) throw new NotFoundError("Section not found.");

    return NextResponse.json({
      id: section.id,
      classId: section.classId,
      name: section.name,
      className: section.schoolClass.name,
      studentCount: section._count.enrolments,
    });
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
    if (!UUID.test(id)) throw new NotFoundError("Section not found.");
    const { tenant } = await resolveTenantContext(request, tenantSlug, ["SCHOOL_ADMIN"]);
    const body: unknown = await request.json().catch(() => null);
    return NextResponse.json(await updateSection(tenant.id, id, body));
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
    if (!UUID.test(id)) throw new NotFoundError("Section not found.");
    const { tenant } = await resolveTenantContext(request, tenantSlug, ["SCHOOL_ADMIN"]);
    return NextResponse.json(await deleteSection(tenant.id, id));
  } catch (error) {
    return handleApiError(error);
  }
}
