import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext, withTenant } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";
import { createSubject, listSubjects } from "@/lib/services/academic-service";

const READ_ROLES = ["SCHOOL_ADMIN", "TEACHER", "STUDENT"] as const;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant, user, membership } = await resolveTenantContext(request, tenantSlug, [
      ...READ_ROLES,
    ]);

    let rows = await listSubjects(tenant.id);

    // Students only see the subjects attached to their own class.
    if (membership.role === "STUDENT") {
      const student = await withTenant(tenant.id, async (tx) =>
        tx.student.findFirst({
          where: { tenantId: tenant.id, userId: user.id },
          select: {
            enrolments: {
              where: { status: "ACTIVE" },
              select: { section: { select: { classId: true } } },
            },
          },
        })
      );
      const ownClasses = new Set(
        student?.enrolments.map((row) => row.section.classId) ?? [],
      );
      rows = rows.filter((row) => ownClasses.has(row.classId));
    }

    const classId = request.nextUrl.searchParams.get("classId");
    if (classId) rows = rows.filter((row) => row.classId === classId);

    return NextResponse.json(rows);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, ["SCHOOL_ADMIN"]);
    const body: unknown = await request.json().catch(() => null);
    return NextResponse.json(await createSubject(tenant.id, body), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
