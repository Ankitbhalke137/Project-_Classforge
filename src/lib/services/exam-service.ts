import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { BadRequestError, ConflictError, NotFoundError } from "@/lib/errors";
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
    search?: string;
    status?: string;
    classId?: string;
    term?: string;
  },
) {
  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = 10;
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

  const [total, exams] = await Promise.all([
    prisma.exam.count({ where }),
    prisma.exam.findMany({
      where,
      include: examInclude,
      orderBy: { examDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { data: exams.map(formatExam), total, page, pageSize };
}

export async function createExam(tenantId: string, raw: unknown) {
  const input = createExamSchema.parse(raw);

  const section = await prisma.section.findFirst({
    where: { id: input.sectionId, tenantId },
    select: { id: true, classId: true },
  });
  if (!section) {
    throw new BadRequestError("Choose a class from this school.", { sectionId: "Unknown class" });
  }

  const subject = await prisma.subject.findFirst({
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

  const exam = await prisma.exam.create({
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
}

export async function updateExam(tenantId: string, id: string, raw: unknown) {
  const input = updateExamSchema.parse(raw);
  const current = await prisma.exam.findFirst({ where: { id, tenantId } });
  if (!current) throw new NotFoundError("Exam not found.");

  const maxMarks = input.maxMarks ?? current.maxMarks;
  const passMarks = input.passMarks ?? current.passMarks;
  if (passMarks > maxMarks) {
    throw new BadRequestError("Pass marks cannot be more than the maximum.", {
      passMarks: "Above the maximum",
    });
  }

  if (input.maxMarks !== undefined) {
    const highest = await prisma.mark.aggregate({
      where: { tenantId, examId: id },
      _max: { score: true },
    });
    if (highest._max.score !== null && Number(highest._max.score) > input.maxMarks) {
      throw new ConflictError(
        "A recorded mark is already above that maximum. Raise the mark first, then lower the maximum.",
      );
    }
  }

  const exam = await prisma.exam.update({
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
}

export async function deleteExam(tenantId: string, id: string) {
  const exam = await prisma.exam.findFirst({
    where: { id, tenantId },
    include: { _count: { select: { marks: true } } },
  });
  if (!exam) throw new NotFoundError("Exam not found.");

  if (exam._count.marks > 0) {
    throw new ConflictError(
      "This exam already has marks. Cancel it instead of deleting it, so the results stay auditable.",
    );
  }

  await prisma.exam.delete({ where: { id } });
  return { removed: true, id };
}

export async function getExamResults(tenantId: string, examId: string) {
  const exam = await prisma.exam.findFirst({
    where: { id: examId, tenantId },
    include: examInclude,
  });
  if (!exam) throw new NotFoundError("Exam not found.");

  const [enrolments, marks] = await Promise.all([
    prisma.enrolment.findMany({
      where: { tenantId, sectionId: exam.sectionId, status: "ACTIVE" },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, admissionNo: true },
        },
      },
      orderBy: { student: { admissionNo: "asc" } },
    }),
    prisma.mark.findMany({ where: { tenantId, examId } }),
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
}

export async function saveExamMarks(
  tenantId: string,
  examId: string,
  userId: string,
  raw: unknown,
) {
  const input = marksSchema.parse(raw);
  const exam = await prisma.exam.findFirst({
    where: { id: examId, tenantId },
    select: { id: true, sectionId: true, maxMarks: true, status: true },
  });
  if (!exam) throw new NotFoundError("Exam not found.");

  const tooHigh = input.records.find(
    (record) => record.score !== null && record.score > exam.maxMarks,
  );
  if (tooHigh) {
    throw new BadRequestError(`A mark cannot be above the maximum of ${exam.maxMarks}.`);
  }

  const enrolments = await prisma.enrolment.findMany({
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

  await prisma.$transaction(
    async (tx) => {
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
    },
    { timeout: 25_000 },
  );

  if (exam.status === "SCHEDULED" && input.records.some((record) => record.score !== null)) {
    await prisma.exam.update({ where: { id: examId }, data: { status: "IN_PROGRESS" } });
  }

  return getExamResults(tenantId, examId);
}

export async function publishExam(tenantId: string, examId: string) {
  const exam = await prisma.exam.findFirst({
    where: { id: examId, tenantId },
    include: { _count: { select: { marks: true } } },
  });
  if (!exam) throw new NotFoundError("Exam not found.");
  if (exam._count.marks === 0) {
    throw new ConflictError("Add at least one mark before publishing results.");
  }

  await prisma.exam.update({
    where: { id: examId },
    data: { publishedAt: new Date(), status: "COMPLETED" },
  });

  return getExamResults(tenantId, examId);
}
