import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveTenantContext, withTenant } from "@/lib/tenant-context";
import { handleApiError, NotFoundError, ConflictError } from "@/lib/errors";

type Context = {
  params: Promise<{ tenantSlug: string; id: string }>;
};

const updateTeacherSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name cannot be empty.").max(100).optional(),
    lastName: z.string().trim().min(1, "Last name cannot be empty.").max(100).optional(),
    employeeNo: z.string().trim().min(1).max(50).optional().nullable(),
  })
  .refine(
    (data) => data.firstName !== undefined || data.lastName !== undefined || data.employeeNo !== undefined,
    { message: "At least one field must be provided for update." },
  );

/**
 * GET /api/t/:tenantSlug/teachers/:id
 * Fetches a single teacher by ID within the tenant.
 */
export async function GET(request: NextRequest, context: Context) {
  try {
    const { tenantSlug, id } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
      "TEACHER",
    ]);

    const teacher = await withTenant(tenant.id, async (tx) => {
      return tx.teacher.findFirst({
        where: { id, tenantId: tenant.id },
        include: {
          user: { select: { email: true } },
          teachingAssignments: {
            select: { sectionId: true, subjectId: true },
          },
        },
      });
    });

    if (!teacher) {
      throw new NotFoundError("Teacher not found.");
    }

    return NextResponse.json({
      id: teacher.id,
      name: `${teacher.firstName} ${teacher.lastName}`.trim(),
      email: teacher.user?.email ?? "",
      employeeNo: teacher.employeeNo ?? "",
      phone: "",
      qualification: "",
      designation: "",
      joinedOn: teacher.createdAt.toISOString(),
      subject: "",
      subjectIds: [...new Set(teacher.teachingAssignments.map((a) => a.subjectId))],
      classIds: [...new Set(teacher.teachingAssignments.map((a) => a.sectionId))],
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/t/:tenantSlug/teachers/:id
 * Updates teacher details.
 * SCHOOL_ADMIN only.
 */
export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { tenantSlug, id } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, ["SCHOOL_ADMIN"]);

    const body = updateTeacherSchema.parse(await request.json().catch(() => ({})));

    const updated = await withTenant(tenant.id, async (tx) => {
      const existing = await tx.teacher.findFirst({
        where: { id, tenantId: tenant.id },
      });
      if (!existing) {
        throw new NotFoundError("Teacher not found.");
      }

      if (body.employeeNo && body.employeeNo !== existing.employeeNo) {
        const conflict = await tx.teacher.findFirst({
          where: { tenantId: tenant.id, employeeNo: body.employeeNo },
        });
        if (conflict) {
          throw new ConflictError("A teacher with this employee number already exists.", {
            employeeNo: "Employee number is already taken.",
          });
        }
      }

      return tx.teacher.update({
        where: { id },
        data: {
          ...(body.firstName !== undefined ? { firstName: body.firstName } : {}),
          ...(body.lastName !== undefined ? { lastName: body.lastName } : {}),
          ...(body.employeeNo !== undefined ? { employeeNo: body.employeeNo } : {}),
        },
        include: {
          user: { select: { email: true } },
          teachingAssignments: { select: { sectionId: true, subjectId: true } },
        },
      });
    });

    return NextResponse.json({
      id: updated.id,
      name: `${updated.firstName} ${updated.lastName}`.trim(),
      email: updated.user?.email ?? "",
      employeeNo: updated.employeeNo ?? "",
      phone: "",
      qualification: "",
      designation: "",
      joinedOn: updated.createdAt.toISOString(),
      subject: "",
      subjectIds: [...new Set(updated.teachingAssignments.map((a) => a.subjectId))],
      classIds: [...new Set(updated.teachingAssignments.map((a) => a.sectionId))],
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/t/:tenantSlug/teachers/:id
 * Deletes a teacher record if there are no blocking dependencies.
 * SCHOOL_ADMIN only.
 */
export async function DELETE(request: NextRequest, context: Context) {
  try {
    const { tenantSlug, id } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, ["SCHOOL_ADMIN"]);

    await withTenant(tenant.id, async (tx) => {
      const existing = await tx.teacher.findFirst({
        where: { id, tenantId: tenant.id },
      });
      if (!existing) {
        throw new NotFoundError("Teacher not found.");
      }

      await tx.teacher.delete({
        where: { id },
      });
    });

    return NextResponse.json({ message: "Teacher deleted successfully." });
  } catch (error) {
    return handleApiError(error);
  }
}
