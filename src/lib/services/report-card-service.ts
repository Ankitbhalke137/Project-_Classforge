/**
 * Report card service: computes published exam results, grade distributions, and student/class ranking.
 */
import { prisma } from "@/lib/prisma";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { GRADE_BANDS, type Grade } from "@/types";
import { getTeacherAssignedSectionIds, type UserContext } from "@/lib/services/student-service";

type ReportRow = {
  examId: string;
  subjectId: string;
  subjectName: string;
  examName: string;
  date: string;
  maxMarks: number;
  marksObtained: number | null;
  grade: Grade | null;
};

function gradeFor(percentage: number): Grade {
  return GRADE_BANDS.find((band) => percentage >= band.min)?.grade ?? "E";
}

function percentageGrade(score: number, max: number): Grade | null {
  if (max <= 0) return null;
  return gradeFor((score / max) * 100);
}

function attendanceRate(records: { status: string }[]): number {
  const marked = records.filter((row) => row.status !== "EXCUSED");
  if (marked.length === 0) return 0;
  const attended = marked.filter(
    (row) => row.status === "PRESENT" || row.status === "LATE",
  ).length;
  return Math.round((attended / marked.length) * 100);
}

/**
 * Position of one student in a scored list. Ties share the better position;
 * students with no marks are not ranked at all.
 */
function positionOf(
  entries: { studentId: string; score: number; max: number }[],
  studentId: string,
): number | null {
  const scored = entries
    .filter((row) => row.max > 0)
    .sort((a, b) => b.score / b.max - a.score / a.max || b.score - a.score);

  const target = scored.find((row) => row.studentId === studentId);
  if (!target) return null;

  const targetPercentage = target.score / target.max;
  return scored.filter((row) => row.score / row.max > targetPercentage).length + 1;
}

/**
 * Builds one student's report card for a term.
 *
 * Only published exams are included: an unpublished paper is still being
 * marked, and showing it to a student or parent would leak a provisional score
 * as if it were final.
 */
async function buildReportCard(
  tenantId: string,
  studentId: string,
  term: string,
): Promise<{
  studentId: string;
  studentName: string;
  admissionNo: string;
  className: string;
  term: string;
  rows: ReportRow[];
  totalMarks: number;
  maxTotal: number;
  percentage: number;
  overallGrade: Grade | null;
  attendancePercentage: number;
  rank: number | null;
  classRank: number | null;
  totalStudents: number;
}> {
  const student = await prisma.student.findFirst({
    where: { id: studentId, tenantId },
    include: {
      enrolments: {
        where: { status: "ACTIVE" },
        take: 1,
        include: {
          section: { include: { schoolClass: { select: { name: true } } } },
        },
      },
      attendanceRecords: { select: { status: true } },
    },
  });

  if (!student) throw new NotFoundError("Student not found.");
  const enrolment = student.enrolments[0];
  if (!enrolment) {
    throw new BadRequestError("This student has no active class, so there is no report card.");
  }

  const exams = await prisma.exam.findMany({
    where: {
      tenantId,
      sectionId: enrolment.sectionId,
      term,
      publishedAt: { not: null },
    },
    include: {
      subject: { select: { name: true } },
      marks: { where: { studentId } },
    },
    orderBy: { examDate: "asc" },
  });

  const rows: ReportRow[] = exams.map((exam) => {
    const mark = exam.marks[0];
    const score = mark ? Number(mark.score) : null;
    return {
      examId: exam.id,
      subjectId: exam.subjectId,
      subjectName: exam.subject.name,
      examName: exam.name,
      date: exam.examDate.toISOString().slice(0, 10),
      maxMarks: exam.maxMarks,
      marksObtained: score,
      grade: score === null ? null : percentageGrade(score, exam.maxMarks),
    };
  });

  const totalMarks = rows.reduce((sum, row) => sum + (row.marksObtained ?? 0), 0);
  const maxTotal = rows.reduce(
    (sum, row) => sum + (row.marksObtained === null ? 0 : row.maxMarks),
    0,
  );
  const percentage = maxTotal > 0 ? Math.round((totalMarks / maxTotal) * 100) : 0;

  const [classEntries, schoolEntries, totalStudents] = await Promise.all([
    rankEntriesForExams(tenantId, exams.map((exam) => exam.id), studentId),
    rankEntriesForTerm(tenantId, term),
    prisma.enrolment.count({
      where: { tenantId, sectionId: enrolment.sectionId, status: "ACTIVE" },
    }),
  ]);

  const className =
    `${enrolment.section.schoolClass.name} - ${enrolment.section.name}`.trim();

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
    overallGrade: maxTotal > 0 ? gradeFor(percentage) : null,
    attendancePercentage: attendanceRate(student.attendanceRecords),
    rank: positionOf(schoolEntries, studentId),
    classRank: positionOf(classEntries, studentId),
    totalStudents,
  };
}

/** Score totals for one set of exams, used for the class position. */
async function rankEntriesForExams(
  tenantId: string,
  examIds: string[],
  targetStudentId: string,
) {
  if (examIds.length === 0) return [];
  const [exams, marks] = await Promise.all([
    prisma.exam.findMany({
      where: { tenantId, id: { in: examIds } },
      select: { id: true, maxMarks: true },
    }),
    prisma.mark.findMany({
      where: { tenantId, examId: { in: examIds } },
      select: { studentId: true, examId: true, score: true },
    }),
  ]);

  const maxTotal = exams.reduce((sum, exam) => sum + exam.maxMarks, 0);
  const byStudent = new Map<string, number>();

  for (const mark of marks) {
    byStudent.set(
      mark.studentId,
      (byStudent.get(mark.studentId) ?? 0) + Number(mark.score),
    );
  }
  // A student with no marks in this set is not ranked at all. A student who
  // scored zero keeps a zero total and still appears in the ranking.
  if (marks.some((mark) => mark.studentId === targetStudentId)) {
    byStudent.set(targetStudentId, byStudent.get(targetStudentId) ?? 0);
  }

  return [...byStudent.entries()].map(([studentId, score]) => ({
    studentId,
    score,
    max: maxTotal,
  }));
}

/**
 * Score totals across the whole school for the term. Each student is compared
 * against the exams of their own section, so a class with more papers is not
 * automatically given a higher maximum.
 */
async function rankEntriesForTerm(tenantId: string, term: string) {
  const exams = await prisma.exam.findMany({
    where: { tenantId, term, publishedAt: { not: null } },
    select: { id: true, sectionId: true, maxMarks: true },
  });
  if (exams.length === 0) return [];

  const marks = await prisma.mark.findMany({
    where: { tenantId, examId: { in: exams.map((exam) => exam.id) } },
    select: { studentId: true, examId: true, score: true },
  });
  if (marks.length === 0) return [];

  const examById = new Map(exams.map((exam) => [exam.id, exam]));
  const studentIds = [...new Set(marks.map((mark) => mark.studentId))];
  const enrolments = await prisma.enrolment.findMany({
    where: { tenantId, studentId: { in: studentIds }, status: "ACTIVE" },
    select: { studentId: true, sectionId: true },
  });
  const sectionByStudent = new Map(
    enrolments.map((row) => [row.studentId, row.sectionId]),
  );

  const maxBySection = new Map<string, number>();
  for (const exam of exams) {
    maxBySection.set(
      exam.sectionId,
      (maxBySection.get(exam.sectionId) ?? 0) + exam.maxMarks,
    );
  }

  const totals = new Map<string, number>();
  for (const mark of marks) {
    const exam = examById.get(mark.examId);
    const sectionId = sectionByStudent.get(mark.studentId);
    // Ignore a mark from a section the student is no longer enrolled in.
    if (!exam || sectionId !== exam.sectionId) continue;
    totals.set(mark.studentId, (totals.get(mark.studentId) ?? 0) + Number(mark.score));
  }

  return [...totals.entries()]
    .map(([studentId, score]) => ({
      studentId,
      score,
      max: maxBySection.get(sectionByStudent.get(studentId) ?? "") ?? 0,
    }))
    .filter((row) => row.max > 0);
}

/** A single student's report card, with ownership checks for the caller. */
export async function getStudentReportCard(
  tenantId: string,
  studentId: string,
  term: string,
  userContext: UserContext,
) {
  if (!term.trim()) throw new BadRequestError("Choose a term.", { term: "Term is required" });

  if (userContext.role === "STUDENT") {
    const own = await prisma.student.findFirst({
      where: { id: studentId, tenantId, userId: userContext.userId },
      select: { id: true },
    });
    if (!own) throw new ForbiddenError("You may only view your own report card.");
  }

  if (userContext.role === "TEACHER") {
    const assignedSectionIds = await getTeacherAssignedSectionIds(
      prisma,
      tenantId,
      userContext.userId,
    );
    const student = await prisma.student.findFirst({
      where: { id: studentId, tenantId },
      include: {
        enrolments: {
          where: { status: "ACTIVE" },
          select: { sectionId: true },
        },
      },
    });
    if (!student) {
      throw new NotFoundError("Student not found.");
    }
    const isAssigned = student.enrolments.some((e) =>
      assignedSectionIds.includes(e.sectionId),
    );
    if (!isAssigned) {
      throw new ForbiddenError(
        "You can only view report cards for students in classes assigned to you.",
      );
    }
  }

  return buildReportCard(tenantId, studentId, term);
}

/**
 * Every report card for a class (or one section) in a term. `classId` accepts
 * the section id used by the classes list, or the parent class id.
 */
export async function getClassReportCards(
  tenantId: string,
  classId: string,
  term: string,
) {
  if (!term.trim()) throw new BadRequestError("Choose a term.", { term: "Term is required" });

  const section = await prisma.section.findFirst({
    where: { id: classId, tenantId },
    select: { id: true },
  });

  let sectionIds: string[];
  if (section) {
    sectionIds = [section.id];
  } else {
    const schoolClass = await prisma.schoolClass.findFirst({
      where: { id: classId, tenantId },
      select: { sections: { select: { id: true } } },
    });
    if (!schoolClass) throw new NotFoundError("Class not found.");
    sectionIds = schoolClass.sections.map((row) => row.id);
  }

  if (sectionIds.length === 0) return [];

  const enrolments = await prisma.enrolment.findMany({
    where: { tenantId, sectionId: { in: sectionIds }, status: "ACTIVE" },
    select: { studentId: true },
    orderBy: { student: { admissionNo: "asc" } },
  });

  return Promise.all(
    enrolments.map((row) => buildReportCard(tenantId, row.studentId, term)),
  );
}
