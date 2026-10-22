import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext, withTenant } from "@/lib/tenant-context";
import { handleApiError, NotFoundError } from "@/lib/errors";

type Context = {
  params: Promise<{ tenantSlug: string; id: string }>;
};

function calculateGrade(score: number, max: number): "A+" | "A" | "B" | "C" | "D" | "E" | "F" {
  if (max <= 0) return "F";
  const pct = (score / max) * 100;
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 60) return "C";
  if (pct >= 50) return "D";
  if (pct >= 40) return "E";
  return "F";
}

/**
 * GET /api/t/:tenantSlug/exams/:id/results
 * Returns the exam details and the student results.
 * - Students only see their own result.
 * - Staff see all results for the exam's section.
 */
export async function GET(request: NextRequest, context: Context) {
  try {
    const { tenantSlug, id: examId } = await context.params;
    const { tenant, user, membership } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
      "TEACHER",
      "STUDENT",
    ]);

    const data = await withTenant(tenant.id, async (tx) => {
      const exam = await tx.exam.findFirst({
        where: { id: examId, tenantId: tenant.id },
        include: {
          subject: { select: { id: true, name: true } },
          section: { select: { id: true, name: true, schoolClass: { select: { name: true } } } },
        },
      });

      if (!exam) {
        throw new NotFoundError("Exam not found.");
      }

      // If student, find their student record
      let studentIdLimit: string | undefined;
      if (membership.role === "STUDENT") {
        const student = await tx.student.findFirst({
          where: { tenantId: tenant.id, userId: user.id },
          select: { id: true },
        });
        if (!student) {
          return {
            exam,
            results: [],
          };
        }
        studentIdLimit = student.id;
      }

      // Fetch enrolled students
      const enrolments = await tx.enrolment.findMany({
        where: {
          tenantId: tenant.id,
          sectionId: exam.sectionId,
          status: "ACTIVE",
          ...(studentIdLimit ? { studentId: studentIdLimit } : {}),
        },
        include: {
          student: { select: { id: true, firstName: true, lastName: true, admissionNo: true } },
        },
        orderBy: { student: { admissionNo: "asc" } },
      });

      // Fetch marks for this exam
      const marks = await tx.mark.findMany({
        where: {
          tenantId: tenant.id,
          examId,
          ...(studentIdLimit ? { studentId: studentIdLimit } : {}),
        },
      });

      const markMap = new Map(marks.map((m) => [m.studentId, m]));

      const results = enrolments.map((e) => {
        const m = markMap.get(e.studentId);
        const score = m ? Number(m.score) : null;
        return {
          id: m?.id ?? `pending-${e.studentId}`,
          examId: exam.id,
          studentId: e.studentId,
          studentName: `${e.student.firstName} ${e.student.lastName}`.trim(),
          admissionNo: e.student.admissionNo,
          marksObtained: score,
          grade: score !== null ? calculateGrade(score, exam.maxMarks) : null,
          remarks: score !== null ? (score >= exam.maxMarks * 0.4 ? "Pass" : "Needs improvement") : null,
        };
      });

      return {
        exam,
        results,
      };
    });

    return NextResponse.json({
      exam: {
        id: data.exam.id,
        name: `${data.exam.subject.name} — ${data.exam.name}`,
        term: "",
        classId: data.exam.sectionId,
        subjectId: data.exam.subjectId,
        teacherId: "",
        date: data.exam.examDate.toISOString(),
        maxMarks: data.exam.maxMarks,
        passMarks: Math.round(data.exam.maxMarks * 0.4),
        status: data.exam.status,
        publishedAt: data.exam.createdAt.toISOString(),
      },
      results: data.results,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
