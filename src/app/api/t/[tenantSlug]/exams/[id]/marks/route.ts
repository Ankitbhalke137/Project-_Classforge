import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveTenantContext, withTenant } from "@/lib/tenant-context";
import { handleApiError, NotFoundError, BadRequestError } from "@/lib/errors";

type Context = {
  params: Promise<{ tenantSlug: string; id: string }>;
};

const marksSchema = z.object({
  marks: z
    .array(
      z.object({
        studentId: z.string().uuid("Invalid student ID."),
        score: z.number().min(0, "Score cannot be negative."),
      }),
    )
    .min(1, "At least one mark is required.")
    .max(500),
});

/**
 * GET /api/t/:tenantSlug/exams/:id/marks
 * Retrieves marks for an exam.
 * - Students can only view their own mark.
 * - Staff can view all marks for the exam.
 */
export async function GET(request: NextRequest, context: Context) {
  try {
    const { tenantSlug, id: examId } = await context.params;
    const { tenant, user, membership } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
      "TEACHER",
      "STUDENT",
    ]);

    const marks = await withTenant(tenant.id, async (tx) => {
      const exam = await tx.exam.findFirst({
        where: { id: examId, tenantId: tenant.id },
        select: { id: true, maxMarks: true },
      });
      if (!exam) {
        throw new NotFoundError("Exam not found.");
      }

      let studentFilter: { studentId?: string } = {};
      if (membership.role === "STUDENT") {
        const student = await tx.student.findFirst({
          where: { tenantId: tenant.id, userId: user.id },
          select: { id: true },
        });
        if (!student) {
          return [];
        }
        studentFilter = { studentId: student.id };
      }

      return tx.mark.findMany({
        where: {
          tenantId: tenant.id,
          examId,
          ...studentFilter,
        },
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true, admissionNo: true },
          },
        },
        orderBy: { student: { admissionNo: "asc" } },
      });
    });

    return NextResponse.json(
      marks.map((m) => ({
        id: m.id,
        examId: m.examId,
        studentId: m.studentId,
        studentName: `${m.student.firstName} ${m.student.lastName}`.trim(),
        admissionNo: m.student.admissionNo,
        score: Number(m.score),
        gradedBy: m.gradedBy,
        updatedAt: m.updatedAt.toISOString(),
      })),
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/t/:tenantSlug/exams/:id/marks
 * Upserts marks for students in an exam.
 * SCHOOL_ADMIN, TEACHER.
 */
export async function PUT(request: NextRequest, context: Context) {
  try {
    const { tenantSlug, id: examId } = await context.params;
    const { tenant, membership } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
      "TEACHER",
    ]);

    const body = marksSchema.parse(await request.json().catch(() => ({})));

    const result = await withTenant(tenant.id, async (tx) => {
      const exam = await tx.exam.findFirst({
        where: { id: examId, tenantId: tenant.id },
        select: { id: true, sectionId: true, subjectId: true, maxMarks: true },
      });
      if (!exam) {
        throw new NotFoundError("Exam not found.");
      }

      // Check maxMarks constraint
      for (const m of body.marks) {
        if (m.score > exam.maxMarks) {
          throw new BadRequestError(
            `Score ${m.score} exceeds maximum exam marks of ${exam.maxMarks}.`,
            { marks: `Score cannot exceed ${exam.maxMarks}.` },
          );
        }
      }

      // Check for duplicate studentIds in payload
      const studentIds = body.marks.map((m) => m.studentId);
      const uniqueIds = new Set(studentIds);
      if (uniqueIds.size !== studentIds.length) {
        throw new BadRequestError("Duplicate student IDs are not allowed in the marks list.");
      }

      // Verify students are enrolled in the exam's section
      const enrolled = await tx.enrolment.findMany({
        where: {
          tenantId: tenant.id,
          sectionId: exam.sectionId,
          status: "ACTIVE",
          studentId: { in: Array.from(uniqueIds) },
        },
        select: { studentId: true },
      });

      if (enrolled.length !== uniqueIds.size) {
        throw new BadRequestError(
          "One or more students are not actively enrolled in this exam's section.",
        );
      }

      // Upsert marks
      const saved = [];
      for (const m of body.marks) {
        const existing = await tx.mark.findFirst({
          where: { tenantId: tenant.id, examId, studentId: m.studentId },
          select: { id: true },
        });

        if (existing) {
          const updated = await tx.mark.update({
            where: { id: existing.id },
            data: {
              score: m.score,
              gradedBy: membership.userId,
            },
          });
          saved.push(updated);
        } else {
          const created = await tx.mark.create({
            data: {
              tenantId: tenant.id,
              examId,
              studentId: m.studentId,
              score: m.score,
              gradedBy: membership.userId,
            },
          });
          saved.push(created);
        }
      }

      return saved;
    });

    return NextResponse.json({
      data: result.map((r) => ({
        id: r.id,
        examId: r.examId,
        studentId: r.studentId,
        score: Number(r.score),
        gradedBy: r.gradedBy,
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
