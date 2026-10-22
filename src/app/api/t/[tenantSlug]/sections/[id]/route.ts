import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveTenantContext, withTenant } from "@/lib/tenant-context";
import { handleApiError, NotFoundError, ConflictError } from "@/lib/errors";

type Context = {
  params: Promise<{ tenantSlug: string; id: string }>;
};

const updateSectionSchema = z.object({
  name: z.string().trim().min(1, "Section name is required.").max(50),
});

/**
 * GET /api/t/:tenantSlug/sections/:id
 * Fetches section details.
 */
export async function GET(request: NextRequest, context: Context) {
  try {
    const { tenantSlug, id } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
      "TEACHER",
      "STUDENT",
    ]);

    const section = await withTenant(tenant.id, async (tx) => {
      return tx.section.findFirst({
        where: { id, tenantId: tenant.id },
        include: {
          schoolClass: { select: { id: true, name: true } },
          _count: { select: { enrolments: true, attendanceRecords: true, exams: true } },
        },
      });
    });

    if (!section) {
      throw new NotFoundError("Section not found.");
    }

    return NextResponse.json({
      id: section.id,
      name: section.name,
      classId: section.classId,
      className: section.schoolClass.name,
      enrolmentCount: section._count.enrolments,
      createdAt: section.createdAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/t/:tenantSlug/sections/:id
 * Updates section name.
 * SCHOOL_ADMIN only.
 */
export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { tenantSlug, id } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, ["SCHOOL_ADMIN"]);

    const body = updateSectionSchema.parse(await request.json().catch(() => ({})));

    const updated = await withTenant(tenant.id, async (tx) => {
      const section = await tx.section.findFirst({
        where: { id, tenantId: tenant.id },
      });
      if (!section) {
        throw new NotFoundError("Section not found.");
      }

      if (body.name !== section.name) {
        const conflict = await tx.section.findFirst({
          where: { tenantId: tenant.id, classId: section.classId, name: body.name },
        });
        if (conflict) {
          throw new ConflictError("A section with this name already exists in this class.", {
            name: "Section name already taken in this class.",
          });
        }
      }

      return tx.section.update({
        where: { id },
        data: { name: body.name },
      });
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/t/:tenantSlug/sections/:id
 * Deletes section if no enrolments, attendance records, or exams exist.
 * SCHOOL_ADMIN only.
 */
export async function DELETE(request: NextRequest, context: Context) {
  try {
    const { tenantSlug, id } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, ["SCHOOL_ADMIN"]);

    await withTenant(tenant.id, async (tx) => {
      const section = await tx.section.findFirst({
        where: { id, tenantId: tenant.id },
        include: {
          _count: { select: { enrolments: true, attendanceRecords: true, exams: true } },
        },
      });

      if (!section) {
        throw new NotFoundError("Section not found.");
      }

      if (
        section._count.enrolments > 0 ||
        section._count.attendanceRecords > 0 ||
        section._count.exams > 0
      ) {
        throw new ConflictError(
          "Cannot delete section with existing enrolments, attendance, or exams.",
        );
      }

      await tx.section.delete({ where: { id } });
    });

    return NextResponse.json({ message: "Section deleted successfully." });
  } catch (error) {
    return handleApiError(error);
  }
}
