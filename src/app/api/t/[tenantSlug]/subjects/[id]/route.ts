import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant-context";
import { ForbiddenError, handleApiError, NotFoundError } from "@/lib/errors";
import { deleteSubject, listSubjects, updateSubject } from "@/lib/services/academic-service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string; id: string }> },
) {
  try {
    const { tenantSlug, id } = await context.params;
    if (!UUID.test(id)) throw new NotFoundError("Subject not found.");
    const { tenant, user, membership } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
      "TEACHER",
      "STUDENT",
      "PARENT",
    ]);

    const row = (await listSubjects(tenant.id)).find((entry) => entry.id === id);
    if (!row) throw new NotFoundError("Subject not found.");

    // Students only reach subjects attached to their own class.
    if (membership.role === "STUDENT") {
      const student = await prisma.student.findFirst({
        where: { tenantId: tenant.id, userId: user.id },
        select: {
          enrolments: {
            where: { status: "ACTIVE" },
            select: { section: { select: { classId: true } } },
          },
        },
      });
      const ownClasses = new Set(
        student?.enrolments.map((enrolment) => enrolment.section.classId) ?? [],
      );
      if (!ownClasses.has(row.classId)) {
        throw new ForbiddenError("You can only view subjects for your own class.");
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
    if (!UUID.test(id)) throw new NotFoundError("Subject not found.");
    const { tenant } = await resolveTenantContext(request, tenantSlug, ["SCHOOL_ADMIN"]);
    const body: unknown = await request.json().catch(() => null);
    return NextResponse.json(await updateSubject(tenant.id, id, body));
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
    if (!UUID.test(id)) throw new NotFoundError("Subject not found.");
    const { tenant } = await resolveTenantContext(request, tenantSlug, ["SCHOOL_ADMIN"]);
    return NextResponse.json(await deleteSubject(tenant.id, id));
  } catch (error) {
    return handleApiError(error);
  }
}
