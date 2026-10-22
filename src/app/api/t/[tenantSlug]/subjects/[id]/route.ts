import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveTenantContext, withTenant } from "@/lib/tenant-context";
import { handleApiError, NotFoundError, ConflictError } from "@/lib/errors";

type Context = {
  params: Promise<{ tenantSlug: string; id: string }>;
};

const updateSubjectSchema = z
  .object({
    name: z.string().trim().min(1, "Name cannot be empty.").max(100).optional(),
    code: z.string().trim().max(30).optional().nullable(),
  })
  .refine((data) => data.name !== undefined || data.code !== undefined, {
    message: "At least one field must be provided for update.",
  });

/**
 * GET /api/t/:tenantSlug/subjects/:id
 * Fetches a single subject.
 */
export async function GET(request: NextRequest, context: Context) {
  try {
    const { tenantSlug, id } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
      "TEACHER",
      "STUDENT",
    ]);

    const subject = await withTenant(tenant.id, async (tx) => {
      return tx.subject.findFirst({
        where: { id, tenantId: tenant.id },
        include: {
          schoolClass: { select: { id: true, name: true } },
          _count: { select: { exams: true, teachingAssignments: true } },
        },
      });
    });

    if (!subject) {
      throw new NotFoundError("Subject not found.");
    }

    return NextResponse.json({
      id: subject.id,
      name: subject.name,
      code: subject.code ?? "",
      classId: subject.classId,
      className: subject.schoolClass.name,
      examCount: subject._count.exams,
      assignmentCount: subject._count.teachingAssignments,
      createdAt: subject.createdAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/t/:tenantSlug/subjects/:id
 * Updates subject details.
 * SCHOOL_ADMIN only.
 */
export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { tenantSlug, id } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, ["SCHOOL_ADMIN"]);

    const body = updateSubjectSchema.parse(await request.json().catch(() => ({})));

    const updated = await withTenant(tenant.id, async (tx) => {
      const subject = await tx.subject.findFirst({
        where: { id, tenantId: tenant.id },
      });
      if (!subject) {
        throw new NotFoundError("Subject not found.");
      }

      if (body.name && body.name !== subject.name) {
        const conflict = await tx.subject.findFirst({
          where: { tenantId: tenant.id, classId: subject.classId, name: body.name },
        });
        if (conflict) {
          throw new ConflictError("A subject with this name already exists in this class.", {
            name: "Subject name already taken in this class.",
          });
        }
      }

      return tx.subject.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.code !== undefined ? { code: body.code } : {}),
        },
      });
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/t/:tenantSlug/subjects/:id
 * Deletes a subject if no exams or assignments are linked.
 * SCHOOL_ADMIN only.
 */
export async function DELETE(request: NextRequest, context: Context) {
  try {
    const { tenantSlug, id } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, ["SCHOOL_ADMIN"]);

    await withTenant(tenant.id, async (tx) => {
      const subject = await tx.subject.findFirst({
        where: { id, tenantId: tenant.id },
        include: {
          _count: { select: { exams: true, teachingAssignments: true } },
        },
      });

      if (!subject) {
        throw new NotFoundError("Subject not found.");
      }

      if (subject._count.exams > 0 || subject._count.teachingAssignments > 0) {
        throw new ConflictError(
          "Cannot delete subject with existing exams or teaching assignments.",
        );
      }

      await tx.subject.delete({ where: { id } });
    });

    return NextResponse.json({ message: "Subject deleted successfully." });
  } catch (error) {
    return handleApiError(error);
  }
}
