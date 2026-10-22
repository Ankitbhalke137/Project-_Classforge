import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveTenantContext, withTenant } from "@/lib/tenant-context";
import { handleApiError, NotFoundError, ConflictError } from "@/lib/errors";

const createAssignmentSchema = z.object({
  teacherId: z.string().uuid("Valid teacherId is required."),
  sectionId: z.string().uuid("Valid sectionId is required."),
  subjectId: z.string().uuid("Valid subjectId is required."),
});

/**
 * GET /api/t/:tenantSlug/teaching-assignments
 * Retrieves teaching assignments within the school.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant, user, membership } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
      "TEACHER",
    ]);

    const { searchParams } = request.nextUrl;
    const teacherId = searchParams.get("teacherId");
    const sectionId = searchParams.get("sectionId");
    const subjectId = searchParams.get("subjectId");

    const assignments = await withTenant(tenant.id, async (tx) => {
      // If teacher role, optionally scope to own teacher record if teacherId filter not passed
      let effectiveTeacherId = teacherId;
      if (membership.role === "TEACHER" && !teacherId) {
        const teacher = await tx.teacher.findFirst({
          where: { tenantId: tenant.id, userId: user.id },
          select: { id: true },
        });
        if (teacher) {
          effectiveTeacherId = teacher.id;
        }
      }

      return tx.teachingAssignment.findMany({
        where: {
          tenantId: tenant.id,
          ...(effectiveTeacherId ? { teacherId: effectiveTeacherId } : {}),
          ...(sectionId ? { sectionId } : {}),
          ...(subjectId ? { subjectId } : {}),
        },
        include: {
          teacher: { select: { id: true, firstName: true, lastName: true, employeeNo: true } },
          section: {
            select: {
              id: true,
              name: true,
              schoolClass: { select: { id: true, name: true } },
            },
          },
          subject: { select: { id: true, name: true, code: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    });

    return NextResponse.json(
      assignments.map((a) => ({
        id: a.id,
        teacherId: a.teacherId,
        teacherName: `${a.teacher.firstName} ${a.teacher.lastName}`.trim(),
        employeeNo: a.teacher.employeeNo ?? "",
        sectionId: a.sectionId,
        sectionName: a.section.name,
        classId: a.section.schoolClass.id,
        className: a.section.schoolClass.name,
        subjectId: a.subjectId,
        subjectName: a.subject.name,
        subjectCode: a.subject.code ?? "",
        createdAt: a.createdAt.toISOString(),
      })),
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/t/:tenantSlug/teaching-assignments
 * Assigns a teacher to a section and subject.
 * SCHOOL_ADMIN only.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, ["SCHOOL_ADMIN"]);

    const body = createAssignmentSchema.parse(await request.json().catch(() => ({})));

    const created = await withTenant(tenant.id, async (tx) => {
      // 1. Validate teacher belongs to tenant
      const teacher = await tx.teacher.findFirst({
        where: { id: body.teacherId, tenantId: tenant.id },
      });
      if (!teacher) {
        throw new NotFoundError("Teacher not found in this school.");
      }

      // 2. Validate section belongs to tenant
      const section = await tx.section.findFirst({
        where: { id: body.sectionId, tenantId: tenant.id },
      });
      if (!section) {
        throw new NotFoundError("Section not found in this school.");
      }

      // 3. Validate subject belongs to tenant
      const subject = await tx.subject.findFirst({
        where: { id: body.subjectId, tenantId: tenant.id },
      });
      if (!subject) {
        throw new NotFoundError("Subject not found in this school.");
      }

      // 4. Ensure subject belongs to section's parent class
      if (subject.classId !== section.classId) {
        throw new ConflictError("Subject belongs to a different class than the selected section.");
      }

      // 5. Check duplicate assignment
      const existing = await tx.teachingAssignment.findFirst({
        where: {
          tenantId: tenant.id,
          teacherId: body.teacherId,
          sectionId: body.sectionId,
          subjectId: body.subjectId,
        },
      });
      if (existing) {
        throw new ConflictError("This teacher is already assigned to this section and subject.");
      }

      return tx.teachingAssignment.create({
        data: {
          tenantId: tenant.id,
          teacherId: body.teacherId,
          sectionId: body.sectionId,
          subjectId: body.subjectId,
        },
        include: {
          teacher: { select: { id: true, firstName: true, lastName: true } },
          section: { select: { id: true, name: true } },
          subject: { select: { id: true, name: true } },
        },
      });
    });

    return NextResponse.json(
      {
        id: created.id,
        teacherId: created.teacherId,
        teacherName: `${created.teacher.firstName} ${created.teacher.lastName}`.trim(),
        sectionId: created.sectionId,
        sectionName: created.section.name,
        subjectId: created.subjectId,
        subjectName: created.subject.name,
        createdAt: created.createdAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
