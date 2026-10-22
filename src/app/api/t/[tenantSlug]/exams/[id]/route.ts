import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveTenantContext, withTenant } from "@/lib/tenant-context";
import { handleApiError, NotFoundError, ConflictError } from "@/lib/errors";

type Context = {
  params: Promise<{ tenantSlug: string; id: string }>;
};

const updateExamSchema = z
  .object({
    name: z.string().trim().min(1, "Exam name cannot be empty.").max(100).optional(),
    examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD.").optional(),
    maxMarks: z.number().int().positive().max(100000).optional(),
    status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]).optional(),
  })
  .refine(
    (d) =>
      d.name !== undefined ||
      d.examDate !== undefined ||
      d.maxMarks !== undefined ||
      d.status !== undefined,
    { message: "At least one field must be provided for update." },
  );

/**
 * GET /api/t/:tenantSlug/exams/:id
 * Fetches single exam details.
 */
export async function GET(request: NextRequest, context: Context) {
  try {
    const { tenantSlug, id } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
      "TEACHER",
      "STUDENT",
    ]);

    const exam = await withTenant(tenant.id, async (tx) => {
      return tx.exam.findFirst({
        where: { id, tenantId: tenant.id },
        include: {
          section: { select: { id: true, name: true, schoolClass: { select: { id: true, name: true } } } },
          subject: { select: { id: true, name: true, code: true } },
          _count: { select: { marks: true } },
        },
      });
    });

    if (!exam) {
      throw new NotFoundError("Exam not found.");
    }

    return NextResponse.json({
      id: exam.id,
      name: `${exam.subject.name} — ${exam.name}`,
      rawName: exam.name,
      term: "",
      classId: exam.sectionId,
      className: `${exam.section.schoolClass.name} - ${exam.section.name}`,
      subjectId: exam.subjectId,
      subjectName: exam.subject.name,
      teacherId: "",
      date: exam.examDate.toISOString(),
      maxMarks: exam.maxMarks,
      passMarks: 0,
      status: exam.status,
      marksCount: exam._count.marks,
      publishedAt: exam.createdAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/t/:tenantSlug/exams/:id
 * Updates exam metadata or status.
 * SCHOOL_ADMIN only.
 */
export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { tenantSlug, id } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, ["SCHOOL_ADMIN"]);

    const body = updateExamSchema.parse(await request.json().catch(() => ({})));

    const updated = await withTenant(tenant.id, async (tx) => {
      const exam = await tx.exam.findFirst({
        where: { id, tenantId: tenant.id },
      });
      if (!exam) {
        throw new NotFoundError("Exam not found.");
      }

      // If reducing maxMarks, ensure no existing mark exceeds the new maxMarks
      if (body.maxMarks !== undefined && body.maxMarks < exam.maxMarks) {
        const highestMark = await tx.mark.findFirst({
          where: { examId: id, tenantId: tenant.id },
          orderBy: { score: "desc" },
          select: { score: true },
        });
        if (highestMark && Number(highestMark.score) > body.maxMarks) {
          throw new ConflictError(
            `Cannot set maxMarks to ${body.maxMarks} because an existing mark is ${highestMark.score}.`,
          );
        }
      }

      return tx.exam.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.examDate !== undefined
            ? { examDate: new Date(`${body.examDate}T00:00:00.000Z`) }
            : {}),
          ...(body.maxMarks !== undefined ? { maxMarks: body.maxMarks } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
        },
        include: {
          section: { select: { id: true, name: true } },
          subject: { select: { id: true, name: true } },
        },
      });
    });

    return NextResponse.json({
      id: updated.id,
      name: `${updated.subject.name} — ${updated.name}`,
      term: "",
      classId: updated.sectionId,
      subjectId: updated.subjectId,
      teacherId: "",
      date: updated.examDate.toISOString(),
      maxMarks: updated.maxMarks,
      passMarks: 0,
      status: updated.status,
      publishedAt: updated.createdAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/t/:tenantSlug/exams/:id
 * Deletes or cancels an exam.
 * SCHOOL_ADMIN only.
 */
export async function DELETE(request: NextRequest, context: Context) {
  try {
    const { tenantSlug, id } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, ["SCHOOL_ADMIN"]);

    await withTenant(tenant.id, async (tx) => {
      const exam = await tx.exam.findFirst({
        where: { id, tenantId: tenant.id },
        include: { _count: { select: { marks: true } } },
      });
      if (!exam) {
        throw new NotFoundError("Exam not found.");
      }

      // If marks already exist, delete cascaded marks inside transaction
      await tx.exam.delete({ where: { id } });
    });

    return NextResponse.json({ message: "Exam deleted successfully." });
  } catch (error) {
    return handleApiError(error);
  }
}
