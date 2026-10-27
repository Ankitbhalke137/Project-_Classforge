/**
 * Exam service: manages exam scheduling, grading, marks upserts, and publishing.
 */
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { BadRequestError, ConflictError, NotFoundError, ForbiddenError } from "@/lib/errors";
import { withTenant } from "@/lib/tenant-context";
import { GRADE_BANDS, type Grade } from "@/types";

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const createExamSchema = z
  .object({
    name: z.string().trim().min(1, "Name the exam").max(100),
    term: z.string().trim().max(50).optional().nullable(),
    subjectId: z.string().uuid("Choose a subject"),
    sectionId: z.string().uuid("Choose a class"),
    examDate: isoDate,
    maxMarks: z.coerce.number().int().min(1, "Maximum marks must be at least 1").max(1000),
    passMarks: z.coerce.number().int().min(0).max(1000).optional(),
    status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  })
  .refine((value) => (value.passMarks ?? 0) <= value.maxMarks, {
    message: "Pass marks cannot be more than the maximum.",
    path: ["passMarks"],
  });

export const updateExamSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    term: z.string().trim().max(50).optional().nullable(),
    examDate: isoDate.optional(),
    maxMarks: z.coerce.number().int().min(1).max(1000).optional(),
    passMarks: z.coerce.number().int().min(0).max(1000).optional(),
    status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "Choose at least one field to change.",
  });

export const marksSchema = z.object({
  records: z
    .array(
      z.object({
        studentId: z.string().uuid(),
        score: z.number().min(0).nullable(),
        remarks: z.string().trim().max(300).nullable().optional(),
      }),
    )
    .max(500),
});

type ExamRow = {
  id: string;
  tenantId: string;
  subjectId: string;
  sectionId: string;
  name: string;
  term: string | null;
  examDate: Date;
  maxMarks: number;
  passMarks: number;
  status: string;
  publishedAt: Date | null;
  createdAt: Date;
  subject: { name: string };
  section: { name: string; schoolClass: { name: string } };
  _count?: { marks: number };
};

export function formatExam(exam: ExamRow) {
  return {
    id: exam.id,
    name: exam.name,
    term: exam.term ?? "",
    classId: exam.sectionId,
    sectionId: exam.sectionId,
    sectionName: exam.section.name,
    className: `${exam.section.schoolClass.name} - ${exam.section.name}`,
    subjectId: exam.subjectId,
    subjectName: exam.subject.name,
    teacherId: "",
    date: exam.examDate.toISOString().slice(0, 10),
    maxMarks: exam.maxMarks,
    passMarks: exam.passMarks,
    status: exam.status,
    publishedAt: exam.publishedAt?.toISOString() ?? null,
    markedCount: exam._count?.marks,
  };
}

const examInclude = {
  subject: { select: { name: true } },
  section: { select: { name: true, schoolClass: { select: { name: true } } } },
  _count: { select: { marks: true } },
} as const;

function gradeFor(score: number | null, maxMarks: number): Grade | null {
  if (score === null || maxMarks <= 0) return null;
  const percentage = (score / maxMarks) * 100;
  return GRADE_BANDS.find((band) => percentage >= band.min)?.grade ?? "E";
}

export async function listExams(
  tenantId: string,
  filters: {
    page?: number;
    limit?: number;
    pageSize?: number;
    search?: string;
    status?: string;
    classId?: string;
    term?: string;
  },
) {
  const page = Math.max(Number(filters.page ?? 1) || 1, 1);
  const limit = Math.min(
    Math.max(Number(filters.limit ?? filters.pageSize ?? 10) || 10, 1),
    100,
  );
  const pageSize = limit;
  const search = filters.search?.trim();

  const where = {
    tenantId,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { subject: { name: { contains: search, mode: "insensitive" as const } } },
            { section: { schoolClass: { name: { contains: search, mode: "insensitive" as const } } } },
          ],
        }
      : {}),
    ...(filters.status
      ? { status: filters.status as "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" }
      : {}),
    ...(filters.classId ? { sectionId: filters.classId } : {}),
    ...(filters.term ? { term: filters.term } : {}),
  };

  return withTenant(tenantId, async (tx) => {
    const [total, exams] = await Promise.all([
      tx.exam.count({ where }),
      tx.exam.findMany({
        where,
        include: examInclude,
        orderBy: { examDate: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const totalPages = Math.max(Math.ceil(total / limit), 1);

    return {
      data: exams.map(formatExam),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      total,
      page,
      pageSize,
      limit,
      totalPages,
    };
  });
}

export async function createExam(tenantId: string, raw: unknown) {
  const input = createExamSchema.parse(raw);

  return withTenant(tenantId, async (tx) => {
    const section = await tx.section.findFirst({
      where: { id: input.sectionId, tenantId },
      select: { id: true, classId: true },
    });
    if (!section) {
      throw new BadRequestError("Choose a class from this school.", { sectionId: "Unknown class" });
    }

    const subject = await tx.subject.findFirst({
      where: { id: input.subjectId, tenantId },
      select: { id: true, classId: true },
    });
    if (!subject) {
      throw new BadRequestError("Choose a subject from this school.", { subjectId: "Unknown subject" });
    }
    if (subject.classId !== section.classId) {
      throw new BadRequestError("That subject belongs to a different class.", {
        subjectId: "Wrong class",
      });
    }

    const exam = await tx.exam.create({
      data: {
        tenantId,
        sectionId: input.sectionId,
        subjectId: input.subjectId,
        name: input.name,
        term: input.term || null,
        examDate: new Date(`${input.examDate}T00:00:00.000Z`),
        maxMarks: input.maxMarks,
        passMarks: input.passMarks ?? 0,
        status: input.status ?? "SCHEDULED",
      },
      include: examInclude,
    });

    return formatExam(exam);
  });
}

export async function updateExam(tenantId: string, id: string, raw: unknown) {
  const input = updateExamSchema.parse(raw);

  return withTenant(tenantId, async (tx) => {
    const current = await tx.exam.findFirst({ where: { id, tenantId } });
    if (!current) throw new NotFoundError("Exam not found.");

    const maxMarks = input.maxMarks ?? current.maxMarks;
    const passMarks = input.passMarks ?? current.passMarks;
    if (passMarks > maxMarks) {
      throw new BadRequestError("Pass marks cannot be more than the maximum.", {
        passMarks: "Above the maximum",
      });
    }

    if (input.maxMarks !== undefined) {
      const highest = await tx.mark.aggregate({
        where: { tenantId, examId: id },
        _max: { score: true },
      });
      if (highest._max.score !== null && Number(highest._max.score) > input.maxMarks) {
        throw new ConflictError(
          "A recorded mark is already above that maximum. Raise the mark first, then lower the maximum.",
        );
      }
    }

    const exam = await tx.exam.update({
      where: { id },
      data: {
        name: input.name,
        term: input.term === undefined ? undefined : input.term || null,
        examDate: input.examDate ? new Date(`${input.examDate}T00:00:00.000Z`) : undefined,
        maxMarks: input.maxMarks,
        passMarks: input.passMarks,
        status: input.status,
      },
      include: examInclude,
    });

    return formatExam(exam);
  });
}

export async function getExam(tenantId: string, id: string) {
  return withTenant(tenantId, async (tx) => {
    const exam = await tx.exam.findFirst({
      where: { id, tenantId },
      include: examInclude,
    });
    if (!exam) throw new NotFoundError("Exam not found.");

    return formatExam(exam);
  });
}

export async function deleteExam(tenantId: string, id: string) {
  return withTenant(tenantId, async (tx) => {
    const exam = await tx.exam.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { marks: true } } },
    });
    if (!exam) throw new NotFoundError("Exam not found.");

    if (exam._count.marks > 0) {
      throw new ConflictError(
        "This exam already has marks. Cancel it instead of deleting it, so the results stay auditable.",
      );
    }

    await tx.exam.delete({ where: { id } });
    return { removed: true, id };
  });
}

export async function getExamResults(tenantId: string, examId: string) {
  return withTenant(tenantId, async (tx) => {
    const exam = await tx.exam.findFirst({
      where: { id: examId, tenantId },
      include: examInclude,
    });
    if (!exam) throw new NotFoundError("Exam not found.");

    const [enrolments, marks] = await Promise.all([
      tx.enrolment.findMany({
        where: { tenantId, sectionId: exam.sectionId, status: "ACTIVE" },
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true, admissionNo: true },
          },
        },
        orderBy: { student: { admissionNo: "asc" } },
      }),
      tx.mark.findMany({ where: { tenantId, examId } }),
    ]);

    const byStudent = new Map(marks.map((mark) => [mark.studentId, mark]));

    return {
      exam: formatExam(exam),
      results: enrolments.map((enrolment) => {
        const mark = byStudent.get(enrolment.student.id);
        const score = mark ? Number(mark.score) : null;
        return {
          id: mark?.id ?? "",
          examId,
          studentId: enrolment.student.id,
          studentName: `${enrolment.student.firstName} ${enrolment.student.lastName}`.trim(),
          admissionNo: enrolment.student.admissionNo,
          marksObtained: score,
          grade: gradeFor(score, exam.maxMarks),
          remarks: mark?.remarks ?? null,
        };
      }),
    };
  });
}

/**
 * A student's own published results.
 *
 * Only exams whose section the student is actively enrolled in, and only after
 * the results were released (`publishedAt`), so an unpublished paper is never
 * visible. Marks are filtered to this student — another student's score cannot
 * be reached through this query.
 */
export async function getMyResults(tenantId: string, userId: string) {
  return withTenant(tenantId, async (tx) => {
    const student = await tx.student.findFirst({
      where: { tenantId, userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        admissionNo: true,
        enrolments: {
          where: { status: "ACTIVE" },
          select: { sectionId: true },
        },
      },
    });

    if (!student) {
      throw new NotFoundError("No student record is linked to this account yet.");
    }

    const sectionIds = student.enrolments.map((row) => row.sectionId);
    const base = {
      student: {
        id: student.id,
        name: `${student.firstName} ${student.lastName}`.trim(),
        admissionNo: student.admissionNo,
      },
    };

    if (sectionIds.length === 0) return { ...base, results: [] };

    const exams = await tx.exam.findMany({
      where: {
        tenantId,
        sectionId: { in: sectionIds },
        publishedAt: { not: null },
      },
      include: {
        subject: { select: { name: true } },
        section: { select: { name: true, schoolClass: { select: { name: true } } } },
        marks: { where: { studentId: student.id } },
      },
      orderBy: { examDate: "desc" },
    });

    return {
      ...base,
      results: exams.map((exam) => {
        const mark = exam.marks[0];
        const score = mark ? Number(mark.score) : null;
        return {
          examId: exam.id,
          examName: exam.name,
          subjectId: exam.subjectId,
          subjectName: exam.subject.name,
          className: `${exam.section.schoolClass.name} - ${exam.section.name}`,
          term: exam.term ?? "",
          date: exam.examDate.toISOString().slice(0, 10),
          maxMarks: exam.maxMarks,
          passMarks: exam.passMarks,
          marksObtained: score,
          percentage:
            score === null || exam.maxMarks <= 0
              ? null
              : Math.round((score / exam.maxMarks) * 100),
          grade: gradeFor(score, exam.maxMarks),
          remarks: mark?.remarks ?? null,
          publishedAt: exam.publishedAt?.toISOString() ?? null,
        };
      }),
    };
  });
}

export async function saveExamMarks(
  tenantId: string,
  examId: string,
  userId: string,
  raw: unknown,
  role?: string,
) {
  const input = marksSchema.parse(raw);
  return withTenant(tenantId, async (tx) => {
    const exam = await tx.exam.findFirst({
      where: { id: examId, tenantId },
      select: { id: true, sectionId: true, subjectId: true, maxMarks: true, status: true },
    });
    if (!exam) throw new NotFoundError("Exam not found.");

    if (exam.status === "CANCELLED") {
      throw new BadRequestError("Cannot enter marks for a cancelled exam.");
    }

    // TASK 6: Restrict exam marks entry to assigned teachers and subjects
    if (role === "TEACHER") {
      const teacher = await tx.teacher.findFirst({
        where: { tenantId, userId },
        select: { id: true },
      });
      if (!teacher) {
        throw new ForbiddenError("No teacher record found linked to your account in this school.");
      }

      const assignment = await tx.teachingAssignment.findFirst({
        where: {
          tenantId,
          teacherId: teacher.id,
          sectionId: exam.sectionId,
          subjectId: exam.subjectId,
        },
        select: { id: true },
      });
      if (!assignment) {
        throw new ForbiddenError(
          "You are not assigned to enter marks for this exam's subject and section.",
        );
      }
    }

    const tooHigh = input.records.find(
      (record) => record.score !== null && record.score > exam.maxMarks,
    );
    if (tooHigh) {
      throw new BadRequestError(`A mark cannot be above the maximum of ${exam.maxMarks}.`);
    }

    const enrolments = await tx.enrolment.findMany({
      where: {
        tenantId,
        sectionId: exam.sectionId,
        status: "ACTIVE",
        studentId: { in: input.records.map((record) => record.studentId) },
      },
      select: { studentId: true },
    });
    const enrolled = new Set(enrolments.map((row) => row.studentId));
    if (input.records.some((record) => !enrolled.has(record.studentId))) {
      throw new BadRequestError(
        "One of those students is not enrolled in this class. Refresh and try again.",
      );
    }

    for (const record of input.records) {
      if (record.score === null) {
        await tx.mark.deleteMany({
          where: { tenantId, examId, studentId: record.studentId },
        });
        continue;
      }

      await tx.mark.upsert({
        where: {
          tenantId_examId_studentId: {
            tenantId,
            examId,
            studentId: record.studentId,
          },
        },
        create: {
          tenantId,
          examId,
          studentId: record.studentId,
          score: record.score,
          remarks: record.remarks || null,
          gradedBy: userId,
        },
        update: {
          score: record.score,
          remarks: record.remarks || null,
          gradedBy: userId,
        },
      });
    }

    if (exam.status === "SCHEDULED" && input.records.some((record) => record.score !== null)) {
      await tx.exam.update({ where: { id: examId }, data: { status: "IN_PROGRESS" } });
    }

    const [updatedExam, allMarks, allEnrolments] = await Promise.all([
      tx.exam.findFirst({
        where: { id: examId, tenantId },
        include: examInclude,
      }),
      tx.mark.findMany({ where: { tenantId, examId } }),
      tx.enrolment.findMany({
        where: { tenantId, sectionId: exam.sectionId, status: "ACTIVE" },
        include: { student: { select: { id: true, firstName: true, lastName: true, admissionNo: true } } },
        orderBy: { student: { admissionNo: "asc" } },
      }),
    ]);

    if (!updatedExam) throw new NotFoundError("Exam not found.");

    const byStudent = new Map(allMarks.map((m) => [m.studentId, m]));
    return {
      exam: formatExam(updatedExam),
      results: allEnrolments.map((enrolment) => {
        const mark = byStudent.get(enrolment.student.id);
        const score = mark ? Number(mark.score) : null;
        return {
          id: mark?.id ?? "",
          examId,
          studentId: enrolment.student.id,
          studentName: `${enrolment.student.firstName} ${enrolment.student.lastName}`.trim(),
          admissionNo: enrolment.student.admissionNo,
          marksObtained: score,
          grade: gradeFor(score, updatedExam.maxMarks),
          remarks: mark?.remarks ?? null,
        };
      }),
    };
  });
}

export async function publishExam(tenantId: string, examId: string) {
  return withTenant(tenantId, async (tx) => {
    const exam = await tx.exam.findFirst({
      where: { id: examId, tenantId },
      include: { _count: { select: { marks: true } } },
    });
    if (!exam) throw new NotFoundError("Exam not found.");
    if (exam._count.marks === 0) {
      throw new ConflictError("Add at least one mark before publishing results.");
    }

    await tx.exam.update({
      where: { id: examId },
      data: { publishedAt: new Date(), status: "COMPLETED" },
    });

    return getExamResults(tenantId, examId);
  });
}
