import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveTenantContext, withTenant } from "@/lib/tenant-context";
import { handleApiError, NotFoundError, ConflictError } from "@/lib/errors";

type Context = {
  params: Promise<{ tenantSlug: string; id: string }>;
};

const updateAcademicYearSchema = z
  .object({
    name: z.string().trim().min(1, "Name cannot be empty.").max(50).optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be YYYY-MM-DD.").optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be YYYY-MM-DD.").optional(),
    status: z.enum(["UPCOMING", "ACTIVE", "COMPLETED"]).optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.startDate !== undefined ||
      data.endDate !== undefined ||
      data.status !== undefined,
    { message: "At least one field must be provided for update." },
  );

/**
 * GET /api/t/:tenantSlug/academic-years/:id
 * Retrieves a single academic year.
 */
export async function GET(request: NextRequest, context: Context) {
  try {
    const { tenantSlug, id } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
      "TEACHER",
      "STUDENT",
    ]);

    const ay = await withTenant(tenant.id, async (tx) => {
      return tx.academicYear.findFirst({
        where: { id, tenantId: tenant.id },
        include: {
          classes: { select: { id: true, name: true } },
          terms: { select: { id: true, label: true, startDate: true, endDate: true } },
        },
      });
    });

    if (!ay) {
      throw new NotFoundError("Academic year not found.");
    }

    return NextResponse.json({
      id: ay.id,
      name: ay.name,
      startDate: ay.startDate.toISOString().slice(0, 10),
      endDate: ay.endDate.toISOString().slice(0, 10),
      status: ay.status,
      classes: ay.classes,
      terms: ay.terms.map((t) => ({
        id: t.id,
        label: t.label,
        startDate: t.startDate.toISOString().slice(0, 10),
        endDate: t.endDate.toISOString().slice(0, 10),
      })),
      createdAt: ay.createdAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/t/:tenantSlug/academic-years/:id
 * Updates an academic year.
 * SCHOOL_ADMIN only.
 */
export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { tenantSlug, id } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, ["SCHOOL_ADMIN"]);

    const body = updateAcademicYearSchema.parse(await request.json().catch(() => ({})));

    const updated = await withTenant(tenant.id, async (tx) => {
      const existing = await tx.academicYear.findFirst({
        where: { id, tenantId: tenant.id },
      });
      if (!existing) {
        throw new NotFoundError("Academic year not found.");
      }

      if (body.name && body.name !== existing.name) {
        const conflict = await tx.academicYear.findFirst({
          where: { tenantId: tenant.id, name: body.name },
        });
        if (conflict) {
          throw new ConflictError("An academic year with this name already exists.", {
            name: "Academic year name already taken.",
          });
        }
      }

      return tx.academicYear.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.startDate !== undefined
            ? { startDate: new Date(`${body.startDate}T00:00:00.000Z`) }
            : {}),
          ...(body.endDate !== undefined
            ? { endDate: new Date(`${body.endDate}T00:00:00.000Z`) }
            : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
        },
      });
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      startDate: updated.startDate.toISOString().slice(0, 10),
      endDate: updated.endDate.toISOString().slice(0, 10),
      status: updated.status,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/t/:tenantSlug/academic-years/:id
 * Deletes an academic year if no classes are attached.
 * SCHOOL_ADMIN only.
 */
export async function DELETE(request: NextRequest, context: Context) {
  try {
    const { tenantSlug, id } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, ["SCHOOL_ADMIN"]);

    await withTenant(tenant.id, async (tx) => {
      const existing = await tx.academicYear.findFirst({
        where: { id, tenantId: tenant.id },
        include: { _count: { select: { classes: true, enrolments: true } } },
      });

      if (!existing) {
        throw new NotFoundError("Academic year not found.");
      }

      if (existing._count.classes > 0 || existing._count.enrolments > 0) {
        throw new ConflictError(
          "Cannot delete academic year with existing classes or enrolments.",
        );
      }

      await tx.academicYear.delete({ where: { id } });
    });

    return NextResponse.json({ message: "Academic year deleted successfully." });
  } catch (error) {
    return handleApiError(error);
  }
}
