import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext, withTenant } from "@/lib/tenant-context";
import { handleApiError, NotFoundError, ForbiddenError } from "@/lib/errors";

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
 * GET /api/t/:tenantSlug/students/:id/report-card
 * Generates the report card for a single student.
 * - Students can only access their own report card.
 * - Staff can access any student's report card in their school.
 */
export async function GET(request: NextRequest, context: Context) {
  try {
    const { tenantSlug, id: studentId } = await context.params;
    const { tenant, user, membership } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
      "TEACHER",
      "STUDENT",
    ]);

    const term = request.nextUrl.searchParams.get("term") ?? "Term 1";

    const data = await withTenant(tenant.id, async (tx) => {
      const student = await tx.student.findFirst({
        where: { id: studentId, tenantId: tenant.id },
        include: {
          enrolments: {
            where: { status: "ACTIVE" },
            include: {
              section: {
                include: { schoolClass: { select: { id: true, name: true } } },
              },
            },
            take: 1,
          },
        },
      });

      if (!student) {
        throw new NotFoundError("Student not found.");
      }

      // Check student own-record access
      if (membership.role === "STUDENT" && student.userId !== user.id) {
        throw new ForbiddenError("You may only view your own report card.");
      }

      const activeEnrolment = student.enrolments[0];
      const section = activeEnrolment?.section;
      const className = section
        ? `${section.schoolClass.name} - ${section.name}`
        : "Unassigned";

      // Fetch marks for this student
      const marks = await tx.mark.findMany({
        where: { tenantId: tenant.id, studentId },
        include: {
          exam: {
            include: { subject: { select: { id: true, name: true } } },
          },
        },
      });

      // Fetch attendance percentage
      const attendanceRecords = await tx.attendanceRecord.findMany({
        where: { tenantId: tenant.id, studentId },
        select: { status: true },
      });

      const totalAttendance = attendanceRecords.length;
      const attended = attendanceRecords.filter(
        (r) => r.status === "PRESENT" || r.status === "LATE",
      ).length;
      const attendancePercentage =
        totalAttendance > 0 ? Math.round((attended / totalAttendance) * 100) : 0;

      let totalMarks = 0;
      let maxTotal = 0;

      const rows = marks.map((m) => {
        const score = Number(m.score);
        totalMarks += score;
        maxTotal += m.exam.maxMarks;

        return {
          examId: m.examId,
          subjectId: m.exam.subjectId,
          subjectName: m.exam.subject.name,
          examName: m.exam.name,
          date: m.exam.examDate.toISOString().slice(0, 10),
          maxMarks: m.exam.maxMarks,
          marksObtained: score,
          grade: calculateGrade(score, m.exam.maxMarks),
        };
      });

      const percentage = maxTotal > 0 ? Math.round((totalMarks / maxTotal) * 100) : 0;
      const overallGrade = maxTotal > 0 ? calculateGrade(totalMarks, maxTotal) : null;

      // Count total students in this section for class rank
      const totalStudents = section
        ? await tx.enrolment.count({
            where: { tenantId: tenant.id, sectionId: section.id, status: "ACTIVE" },
          })
        : 1;

      return {
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`.trim(),
        admissionNo: student.admissionNo,
        className,
        term,
        rows,
        totalMarks,
        maxTotal,
        percentage,
        overallGrade,
        attendancePercentage,
        rank: null,
        classRank: null,
        totalStudents,
      };
    });

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}
