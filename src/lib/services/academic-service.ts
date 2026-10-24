import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { BadRequestError, ConflictError, NotFoundError } from "@/lib/errors";

/* ------------------------------------------------------------------ *
 * Validation
 * ------------------------------------------------------------------ */

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const yearStatus = z.enum(["UPCOMING", "ACTIVE", "COMPLETED"]);

export const createYearSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(50),
    startDate: isoDate,
    endDate: isoDate,
    status: yearStatus.optional(),
  })
  .refine((value) => value.startDate <= value.endDate, {
    message: "The end date must be on or after the start date.",
    path: ["endDate"],
  });

export const updateYearSchema = z
  .object({
    name: z.string().trim().min(1).max(50).optional(),
    startDate: isoDate.optional(),
    endDate: isoDate.optional(),
    status: yearStatus.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "Choose at least one field to change.",
  });

export const createTermSchema = z
  .object({
    academicYearId: z.string().uuid("Choose an academic year"),
    label: z.string().trim().min(1, "Label is required").max(50),
    startDate: isoDate,
    endDate: isoDate,
    position: z.coerce.number().int().min(1).max(12).optional(),
  })
  .refine((value) => value.startDate <= value.endDate, {
    message: "The end date must be on or after the start date.",
    path: ["endDate"],
  });

export const updateTermSchema = z
  .object({
    label: z.string().trim().min(1).max(50).optional(),
    startDate: isoDate.optional(),
    endDate: isoDate.optional(),
    position: z.coerce.number().int().min(1).max(12).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "Choose at least one field to change.",
  });

export const createClassSchema = z.object({
  name: z.string().trim().min(1, "Class name is required").max(50),
  academicYearId: z.string().uuid().optional(),
  room: z.string().trim().max(50).optional().nullable(),
  capacity: z.coerce.number().int().min(0).max(1000).optional(),
  homeroomTeacherId: z.string().uuid().optional().nullable(),
  sections: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
});

export const updateClassSchema = z
  .object({
    name: z.string().trim().min(1).max(50).optional(),
    academicYearId: z.string().uuid().optional(),
    room: z.string().trim().max(50).optional().nullable(),
    capacity: z.coerce.number().int().min(0).max(1000).optional(),
    homeroomTeacherId: z.string().uuid().optional().nullable(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "Choose at least one field to change.",
  });

export const sectionSchema = z.object({
  name: z.string().trim().min(1, "Section name is required").max(50),
});

export const createSubjectSchema = z.object({
  classId: z.string().uuid("Choose a class"),
  name: z.string().trim().min(1, "Subject name is required").max(100),
  code: z.string().trim().max(30).optional().nullable(),
});

export const updateSubjectSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    code: z.string().trim().max(30).optional().nullable(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "Choose at least one field to change.",
  });

export const createAssignmentSchema = z.object({
  teacherId: z.string().uuid("Choose a teacher"),
  sectionId: z.string().uuid("Choose a class"),
  subjectId: z.string().uuid("Choose a subject"),
});

export const createPeriodSchema = z
  .object({
    period: z.coerce.number().int().min(1).max(20),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM"),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM"),
    label: z.string().trim().max(50).optional().nullable(),
  })
  .refine((value) => value.startTime < value.endTime, {
    message: "The end time must be after the start time.",
    path: ["endTime"],
  });

export const updatePeriodSchema = z
  .object({
    period: z.coerce.number().int().min(1).max(20).optional(),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM").optional(),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM").optional(),
    label: z.string().trim().max(50).optional().nullable(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "Choose at least one field to change.",
  });

const WEEKDAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
] as const;

export const slotListSchema = z.object({
  slots: z
    .array(
      z.object({
        day: z.enum(WEEKDAYS),
        period: z.coerce.number().int().min(1).max(20),
        subjectId: z.string().uuid(),
        teacherId: z.string().uuid(),
      }),
    )
    .max(200),
});

/* ------------------------------------------------------------------ *
 * Academic years
 * ------------------------------------------------------------------ */

export async function listYears(tenantId: string) {
  const years = await prisma.academicYear.findMany({
    where: { tenantId },
    orderBy: [{ startDate: "desc" }],
    include: {
      terms: { orderBy: { position: "asc" } },
      _count: { select: { classes: true, enrolments: true } },
    },
  });

  return years.map((year) => ({
    id: year.id,
    name: year.name,
    startDate: year.startDate.toISOString().slice(0, 10),
    endDate: year.endDate.toISOString().slice(0, 10),
    status: year.status,
    classCount: year._count.classes,
    studentCount: year._count.enrolments,
    terms: year.terms.map(formatTerm),
  }));
}

function formatTerm(term: { id: string; label: string; startDate: Date; endDate: Date; position: number }) {
  return {
    id: term.id,
    label: term.label,
    startDate: term.startDate.toISOString().slice(0, 10),
    endDate: term.endDate.toISOString().slice(0, 10),
    position: term.position,
  };
}

export async function createYear(tenantId: string, raw: unknown) {
  const input = createYearSchema.parse(raw);

  const duplicate = await prisma.academicYear.findUnique({
    where: { tenantId_name: { tenantId, name: input.name } },
    select: { id: true },
  });
  if (duplicate) {
    throw new ConflictError("An academic year with that name already exists.", {
      name: "Already in use",
    });
  }

  return prisma.$transaction(async (tx) => {
    if (input.status === "ACTIVE") {
      await tx.academicYear.updateMany({
        where: { tenantId, status: "ACTIVE" },
        data: { status: "COMPLETED" },
      });
    }

    return tx.academicYear.create({
      data: {
        tenantId,
        name: input.name,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        status: input.status ?? "UPCOMING",
      },
    });
  }, { timeout: 15_000 });
}

export async function updateYear(tenantId: string, id: string, raw: unknown) {
  const input = updateYearSchema.parse(raw);
  const current = await prisma.academicYear.findFirst({ where: { id, tenantId } });
  if (!current) throw new NotFoundError("Academic year not found.");

  if (input.name && input.name !== current.name) {
    const duplicate = await prisma.academicYear.findUnique({
      where: { tenantId_name: { tenantId, name: input.name } },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictError("An academic year with that name already exists.", {
        name: "Already in use",
      });
    }
  }

  const start = input.startDate ?? current.startDate.toISOString().slice(0, 10);
  const end = input.endDate ?? current.endDate.toISOString().slice(0, 10);
  if (start > end) {
    throw new BadRequestError("The end date must be on or after the start date.", {
      endDate: "Before the start date",
    });
  }

  return prisma.$transaction(async (tx) => {
    if (input.status === "ACTIVE") {
      await tx.academicYear.updateMany({
        where: { tenantId, status: "ACTIVE", id: { not: id } },
        data: { status: "COMPLETED" },
      });
    }

    return tx.academicYear.update({
      where: { id },
      data: {
        name: input.name,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        status: input.status,
      },
    });
  }, { timeout: 15_000 });
}

export async function deleteYear(tenantId: string, id: string) {
  const year = await prisma.academicYear.findFirst({
    where: { id, tenantId },
    include: { _count: { select: { classes: true, enrolments: true } } },
  });
  if (!year) throw new NotFoundError("Academic year not found.");

  if (year._count.classes > 0 || year._count.enrolments > 0) {
    throw new ConflictError(
      "This year still has classes or enrolments. Remove them first, or mark the year completed.",
    );
  }

  await prisma.academicYear.delete({ where: { id } });
  return { removed: true, id };
}

/* ------------------------------------------------------------------ *
 * Terms
 * ------------------------------------------------------------------ */

export async function listTerms(tenantId: string, academicYearId?: string) {
  const terms = await prisma.academicTerm.findMany({
    where: { tenantId, ...(academicYearId ? { academicYearId } : {}) },
    orderBy: [{ academicYearId: "asc" }, { position: "asc" }],
  });
  return terms.map(formatTerm);
}

export async function createTerm(tenantId: string, raw: unknown) {
  const input = createTermSchema.parse(raw);

  const year = await prisma.academicYear.findFirst({
    where: { id: input.academicYearId, tenantId },
    select: { id: true },
  });
  if (!year) throw new NotFoundError("Academic year not found.");

  const duplicate = await prisma.academicTerm.findUnique({
    where: {
      tenantId_academicYearId_label: {
        tenantId,
        academicYearId: input.academicYearId,
        label: input.label,
      },
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new ConflictError("That term already exists in this year.", {
      label: "Already in use",
    });
  }

  const position =
    input.position ??
    ((await prisma.academicTerm.aggregate({
      where: { tenantId, academicYearId: input.academicYearId },
      _max: { position: true },
    }))._max.position ?? 0) + 1;

  const term = await prisma.academicTerm.create({
    data: {
      tenantId,
      academicYearId: input.academicYearId,
      label: input.label,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      position,
    },
  });

  return formatTerm(term);
}

export async function updateTerm(tenantId: string, id: string, raw: unknown) {
  const input = updateTermSchema.parse(raw);
  const current = await prisma.academicTerm.findFirst({ where: { id, tenantId } });
  if (!current) throw new NotFoundError("Term not found.");

  const start = input.startDate ?? current.startDate.toISOString().slice(0, 10);
  const end = input.endDate ?? current.endDate.toISOString().slice(0, 10);
  if (start > end) {
    throw new BadRequestError("The end date must be on or after the start date.", {
      endDate: "Before the start date",
    });
  }

  const term = await prisma.academicTerm.update({
    where: { id },
    data: {
      label: input.label,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      endDate: input.endDate ? new Date(input.endDate) : undefined,
      position: input.position,
    },
  });

  return formatTerm(term);
}

export async function deleteTerm(tenantId: string, id: string) {
  const term = await prisma.academicTerm.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!term) throw new NotFoundError("Term not found.");
  await prisma.academicTerm.delete({ where: { id } });
  return { removed: true, id };
}

/* ------------------------------------------------------------------ *
 * Classes, sections, subjects
 * ------------------------------------------------------------------ */

export async function listClasses(tenantId: string) {
  const classes = await prisma.schoolClass.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
    include: {
      academicYear: { select: { id: true, name: true, status: true } },
      sections: {
        orderBy: { name: "asc" },
        include: {
          _count: { select: { enrolments: { where: { status: "ACTIVE" } } } },
        },
      },
      subjects: { select: { id: true } },
    },
  });

  const teacherIds = classes
    .map((row) => row.homeroomTeacherId)
    .filter((id): id is string => Boolean(id));
  const teachers = teacherIds.length
    ? await prisma.teacher.findMany({
        where: { tenantId, id: { in: teacherIds } },
        select: { id: true, firstName: true, lastName: true },
      })
    : [];
  const teacherName = new Map(
    teachers.map((teacher) => [teacher.id, `${teacher.firstName} ${teacher.lastName}`.trim()]),
  );

  return classes.flatMap((schoolClass) => {
    const sections = schoolClass.sections.length
      ? schoolClass.sections
      : [{ id: schoolClass.id, name: "", _count: { enrolments: 0 } }];

    return sections.map((section) => ({
      id: section.id,
      classId: schoolClass.id,
      name: section.name ? `${schoolClass.name} - ${section.name}` : schoolClass.name,
      grade: schoolClass.name,
      section: section.name,
      room: schoolClass.room ?? "",
      capacity: schoolClass.capacity,
      homeroomTeacherId: schoolClass.homeroomTeacherId ?? null,
      homeroomTeacherName: schoolClass.homeroomTeacherId
        ? (teacherName.get(schoolClass.homeroomTeacherId) ?? null)
        : null,
      subjectIds: schoolClass.subjects.map((subject) => subject.id),
      studentCount: section._count.enrolments,
      academicYearId: schoolClass.academicYearId,
      academicYear: schoolClass.academicYear,
      sectionCount: schoolClass.sections.length,
    }));
  });
}

export async function createClass(tenantId: string, raw: unknown) {
  const input = createClassSchema.parse(raw);

  const year = input.academicYearId
    ? await prisma.academicYear.findFirst({
        where: { id: input.academicYearId, tenantId },
        select: { id: true },
      })
    : await prisma.academicYear.findFirst({
        where: { tenantId, status: "ACTIVE" },
        select: { id: true },
      });

  if (!year) {
    throw new BadRequestError("Create an active academic year before adding classes.", {
      academicYearId: "No active year",
    });
  }

  if (input.homeroomTeacherId) {
    const teacher = await prisma.teacher.findFirst({
      where: { id: input.homeroomTeacherId, tenantId },
      select: { id: true },
    });
    if (!teacher) {
      throw new BadRequestError("Choose a teacher from this school.", {
        homeroomTeacherId: "Unknown teacher",
      });
    }
  }

  const duplicate = await prisma.schoolClass.findUnique({
    where: { tenantId_academicYearId_name: { tenantId, academicYearId: year.id, name: input.name } },
    select: { id: true },
  });
  if (duplicate) {
    throw new ConflictError("A class with that name already exists in this year.", {
      name: "Already in use",
    });
  }

  const sections = [...new Set((input.sections ?? []).map((name) => name.trim()).filter(Boolean))];

  return prisma.$transaction(async (tx) => {
    const schoolClass = await tx.schoolClass.create({
      data: {
        tenantId,
        academicYearId: year.id,
        name: input.name,
        room: input.room || null,
        capacity: input.capacity ?? 0,
        homeroomTeacherId: input.homeroomTeacherId || null,
        // `tenantId` is inferred from the parent's compound relation; Prisma
        // rejects it as a duplicate argument inside a nested create.
        sections: sections.length ? { create: sections.map((name) => ({ name })) } : undefined,
      },
      include: { sections: true },
    });

    return { ...schoolClass, sections };
  }, { timeout: 15_000 });
}

export async function updateClass(tenantId: string, id: string, raw: unknown) {
  const input = updateClassSchema.parse(raw);

  const current = await prisma.schoolClass.findFirst({ where: { id, tenantId } });
  if (!current) throw new NotFoundError("Class not found.");

  if (input.name && input.name !== current.name) {
    const duplicate = await prisma.schoolClass.findUnique({
      where: {
        tenantId_academicYearId_name: {
          tenantId,
          academicYearId: current.academicYearId,
          name: input.name,
        },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictError("A class with that name already exists in this year.", {
        name: "Already in use",
      });
    }
  }

  if (input.homeroomTeacherId) {
    const teacher = await prisma.teacher.findFirst({
      where: { id: input.homeroomTeacherId, tenantId },
      select: { id: true },
    });
    if (!teacher) {
      throw new BadRequestError("Choose a teacher from this school.", {
        homeroomTeacherId: "Unknown teacher",
      });
    }
  }

  const updated = await prisma.schoolClass.update({
    where: { id },
    data: {
      name: input.name,
      room: input.room === undefined ? undefined : input.room || null,
      capacity: input.capacity,
      homeroomTeacherId:
        input.homeroomTeacherId === undefined ? undefined : input.homeroomTeacherId || null,
    },
  });

  return updated;
}

export async function deleteClass(tenantId: string, id: string) {
  const schoolClass = await prisma.schoolClass.findFirst({
    where: { id, tenantId },
    include: {
      sections: {
        include: {
          _count: { select: { enrolments: true, exams: true } },
        },
      },
    },
  });
  if (!schoolClass) throw new NotFoundError("Class not found.");

  const used = schoolClass.sections.some(
    (section) => section._count.enrolments > 0 || section._count.exams > 0,
  );
  if (used) {
    throw new ConflictError(
      "This class still has students or exams. Move them first, then delete the class.",
    );
  }

  await prisma.schoolClass.delete({ where: { id } });
  return { removed: true, id };
}

export async function createSection(tenantId: string, classId: string, raw: unknown) {
  const input = sectionSchema.parse(raw);

  const schoolClass = await prisma.schoolClass.findFirst({
    where: { id: classId, tenantId },
    select: { id: true },
  });
  if (!schoolClass) throw new NotFoundError("Class not found.");

  const duplicate = await prisma.section.findUnique({
    where: { tenantId_classId_name: { tenantId, classId, name: input.name } },
    select: { id: true },
  });
  if (duplicate) {
    throw new ConflictError("That section already exists.", { name: "Already in use" });
  }

  return prisma.section.create({ data: { tenantId, classId, name: input.name } });
}

export async function updateSection(tenantId: string, id: string, raw: unknown) {
  const input = sectionSchema.parse(raw);

  const current = await prisma.section.findFirst({ where: { id, tenantId } });
  if (!current) throw new NotFoundError("Section not found.");

  return prisma.section.update({ where: { id }, data: { name: input.name } });
}

export async function deleteSection(tenantId: string, id: string) {
  const section = await prisma.section.findFirst({
    where: { id, tenantId },
    include: { _count: { select: { enrolments: true, exams: true } } },
  });
  if (!section) throw new NotFoundError("Section not found.");

  if (section._count.enrolments > 0 || section._count.exams > 0) {
    throw new ConflictError("This section still has students or exams. Move them first.");
  }

  await prisma.section.delete({ where: { id } });
  return { removed: true, id };
}

export async function listSubjects(tenantId: string) {
  const subjects = await prisma.subject.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
    include: {
      schoolClass: { select: { id: true, name: true } },
      _count: { select: { teachingAssignments: true } },
    },
  });

  return subjects.map((subject) => ({
    id: subject.id,
    name: subject.name,
    code: subject.code ?? "",
    classId: subject.classId,
    className: subject.schoolClass.name,
    teacherCount: subject._count.teachingAssignments,
  }));
}

export async function createSubject(tenantId: string, raw: unknown) {
  const input = createSubjectSchema.parse(raw);

  const schoolClass = await prisma.schoolClass.findFirst({
    where: { id: input.classId, tenantId },
    select: { id: true },
  });
  if (!schoolClass) throw new NotFoundError("Class not found.");

  const duplicate = await prisma.subject.findUnique({
    where: { tenantId_classId_name: { tenantId, classId: input.classId, name: input.name } },
    select: { id: true },
  });
  if (duplicate) {
    throw new ConflictError("That subject already exists for this class.", {
      name: "Already in use",
    });
  }

  return prisma.subject.create({
    data: {
      tenantId,
      classId: input.classId,
      name: input.name,
      code: input.code || null,
    },
  });
}

export async function updateSubject(tenantId: string, id: string, raw: unknown) {
  const input = updateSubjectSchema.parse(raw);
  const current = await prisma.subject.findFirst({ where: { id, tenantId } });
  if (!current) throw new NotFoundError("Subject not found.");

  return prisma.subject.update({
    where: { id },
    data: {
      name: input.name,
      code: input.code === undefined ? undefined : input.code || null,
    },
  });
}

export async function deleteSubject(tenantId: string, id: string) {
  const subject = await prisma.subject.findFirst({
    where: { id, tenantId },
    include: { _count: { select: { exams: true, teachingAssignments: true, timetableSlots: true } } },
  });
  if (!subject) throw new NotFoundError("Subject not found.");

  if (
    subject._count.exams > 0 ||
    subject._count.teachingAssignments > 0 ||
    subject._count.timetableSlots > 0
  ) {
    throw new ConflictError(
      "This subject is still assigned to a teacher, a timetable or an exam. Remove those links first.",
    );
  }

  await prisma.subject.delete({ where: { id } });
  return { removed: true, id };
}

/* ------------------------------------------------------------------ *
 * Teaching assignments
 * ------------------------------------------------------------------ */

export async function listAssignments(tenantId: string, sectionId?: string, teacherId?: string) {
  const rows = await prisma.teachingAssignment.findMany({
    where: {
      tenantId,
      ...(sectionId ? { sectionId } : {}),
      ...(teacherId ? { teacherId } : {}),
    },
    include: {
      teacher: { select: { id: true, firstName: true, lastName: true } },
      subject: { select: { id: true, name: true, code: true } },
      section: { select: { id: true, name: true, classId: true } },
    },
    orderBy: [{ teacher: { firstName: "asc" } }],
  });

  return rows.map((row) => ({
    id: row.id,
    teacherId: row.teacherId,
    teacherName: `${row.teacher.firstName} ${row.teacher.lastName}`.trim(),
    sectionId: row.sectionId,
    classId: row.section.classId,
    sectionName: row.section.name,
    subjectId: row.subjectId,
    subjectName: row.subject.name,
    subjectCode: row.subject.code ?? "",
  }));
}

export async function createAssignment(tenantId: string, raw: unknown) {
  const input = createAssignmentSchema.parse(raw);

  const [teacher, section, subject] = await Promise.all([
    prisma.teacher.findFirst({ where: { id: input.teacherId, tenantId }, select: { id: true } }),
    prisma.section.findFirst({
      where: { id: input.sectionId, tenantId },
      select: { id: true, classId: true },
    }),
    prisma.subject.findFirst({
      where: { id: input.subjectId, tenantId },
      select: { id: true, classId: true },
    }),
  ]);

  if (!teacher) throw new BadRequestError("Choose a teacher from this school.", { teacherId: "Unknown" });
  if (!section) throw new BadRequestError("Choose a class from this school.", { sectionId: "Unknown" });
  if (!subject) throw new BadRequestError("Choose a subject from this school.", { subjectId: "Unknown" });
  if (subject.classId !== section.classId) {
    throw new BadRequestError("That subject belongs to a different class.", {
      subjectId: "Wrong class",
    });
  }

  const duplicate = await prisma.teachingAssignment.findUnique({
    where: {
      tenantId_teacherId_sectionId_subjectId: {
        tenantId,
        teacherId: input.teacherId,
        sectionId: input.sectionId,
        subjectId: input.subjectId,
      },
    },
    select: { id: true },
  });
  if (duplicate) {
    throw new ConflictError("That teacher already takes this subject in this class.");
  }

  return prisma.teachingAssignment.create({
    data: {
      tenantId,
      teacherId: input.teacherId,
      sectionId: input.sectionId,
      subjectId: input.subjectId,
    },
  });
}

export async function deleteAssignment(tenantId: string, id: string) {
  const row = await prisma.teachingAssignment.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!row) throw new NotFoundError("Assignment not found.");
  await prisma.teachingAssignment.delete({ where: { id } });
  return { removed: true, id };
}

/* ------------------------------------------------------------------ *
 * Timetable periods + slots
 * ------------------------------------------------------------------ */

export async function listPeriods(tenantId: string) {
  return prisma.timetablePeriod.findMany({
    where: { tenantId },
    orderBy: { period: "asc" },
  });
}

export async function createPeriod(tenantId: string, raw: unknown) {
  const input = createPeriodSchema.parse(raw);

  const duplicate = await prisma.timetablePeriod.findUnique({
    where: { tenantId_period: { tenantId, period: input.period } },
    select: { id: true },
  });
  if (duplicate) {
    throw new ConflictError("That period number already exists.", { period: "Already in use" });
  }

  return prisma.timetablePeriod.create({
    data: {
      tenantId,
      period: input.period,
      startTime: input.startTime,
      endTime: input.endTime,
      label: input.label || null,
    },
  });
}

export async function updatePeriod(tenantId: string, id: string, raw: unknown) {
  const input = updatePeriodSchema.parse(raw);
  const current = await prisma.timetablePeriod.findFirst({ where: { id, tenantId } });
  if (!current) throw new NotFoundError("Period not found.");

  const start = input.startTime ?? current.startTime;
  const end = input.endTime ?? current.endTime;
  if (start >= end) {
    throw new BadRequestError("The end time must be after the start time.", {
      endTime: "Before the start time",
    });
  }

  return prisma.timetablePeriod.update({
    where: { id },
    data: {
      period: input.period,
      startTime: input.startTime,
      endTime: input.endTime,
      label: input.label === undefined ? undefined : input.label || null,
    },
  });
}

export async function deletePeriod(tenantId: string, id: string) {
  const period = await prisma.timetablePeriod.findFirst({
    where: { id, tenantId },
    select: { id: true, period: true },
  });
  if (!period) throw new NotFoundError("Period not found.");

  const used = await prisma.timetableSlot.count({
    where: { tenantId, period: period.period },
  });
  if (used > 0) {
    throw new ConflictError("This period is used in a class timetable. Clear those slots first.");
  }

  await prisma.timetablePeriod.delete({ where: { id } });
  return { removed: true, id };
}

export async function getTimetable(tenantId: string, sectionId: string) {
  const section = await prisma.section.findFirst({
    where: { id: sectionId, tenantId },
    select: { id: true, name: true, classId: true },
  });

  // A class with no sections uses the class id as its "section" in the UI.
  const resolved = section
    ? section
    : await prisma.schoolClass
        .findFirst({ where: { id: sectionId, tenantId }, select: { id: true, name: true } })
        .then((row) => (row ? { id: row.id, name: row.name, classId: row.id } : null));

  if (!resolved) throw new NotFoundError("Class not found.");

  const slots = await prisma.timetableSlot.findMany({
    where: { tenantId, sectionId },
    orderBy: [{ day: "asc" }, { period: "asc" }],
  });

  return {
    sectionId,
    slots: slots.map((slot) => ({
      id: slot.id,
      classId: sectionId,
      day: slot.day,
      period: slot.period,
      subjectId: slot.subjectId,
      teacherId: slot.teacherId,
    })),
  };
}

export async function replaceTimetable(tenantId: string, sectionId: string, raw: unknown) {
  const input = slotListSchema.parse(raw);

  const section = await prisma.section.findFirst({
    where: { id: sectionId, tenantId },
    select: { id: true, classId: true },
  });
  if (!section) {
    throw new BadRequestError("Create a section before timetabling this class.", {
      sectionId: "No section",
    });
  }

  const [subjects, teachers, periods] = await Promise.all([
    prisma.subject.findMany({
      where: { tenantId, classId: section.classId },
      select: { id: true },
    }),
    prisma.teacher.findMany({ where: { tenantId }, select: { id: true } }),
    prisma.timetablePeriod.findMany({ where: { tenantId }, select: { period: true } }),
  ]);

  const subjectIds = new Set(subjects.map((row) => row.id));
  const teacherIds = new Set(teachers.map((row) => row.id));
  const periodNumbers = new Set(periods.map((row) => row.period));

  const seen = new Set<string>();
  for (const slot of input.slots) {
    if (!periodNumbers.has(slot.period)) {
      throw new BadRequestError(`Period ${slot.period} is not defined in the school timetable.`);
    }
    if (!subjectIds.has(slot.subjectId)) {
      throw new BadRequestError("A slot uses a subject from another class.");
    }
    if (!teacherIds.has(slot.teacherId)) {
      throw new BadRequestError("A slot uses a teacher from another school.");
    }
    const key = `${slot.day}:${slot.period}`;
    if (seen.has(key)) {
      throw new BadRequestError(`Two subjects are set for ${slot.day} period ${slot.period}.`);
    }
    seen.add(key);
  }

  await prisma.$transaction(async (tx) => {
    await tx.timetableSlot.deleteMany({ where: { tenantId, sectionId } });
    if (input.slots.length) {
      await tx.timetableSlot.createMany({
        data: input.slots.map((slot) => ({
          tenantId,
          sectionId,
          subjectId: slot.subjectId,
          teacherId: slot.teacherId,
          day: slot.day,
          period: slot.period,
        })),
      });
    }
  }, { timeout: 15_000 });

  return getTimetable(tenantId, sectionId);
}

/* ------------------------------------------------------------------ *
 * Calendar
 * ------------------------------------------------------------------ */

export async function getCalendar(tenantId: string) {
  const year =
    (await prisma.academicYear.findFirst({
      where: { tenantId, status: "ACTIVE" },
      include: { terms: { orderBy: { position: "asc" } } },
    })) ??
    (await prisma.academicYear.findFirst({
      where: { tenantId },
      orderBy: { startDate: "desc" },
      include: { terms: { orderBy: { position: "asc" } } },
    }));
  const periods = await prisma.timetablePeriod.findMany({
    where: { tenantId },
    orderBy: { period: "asc" },
  });

  // The gap between consecutive periods is the break, e.g. "10:40–10:55".
  const breaks: string[] = [];
  for (let index = 0; index < periods.length - 1; index += 1) {
    const current = periods[index];
    const next = periods[index + 1];
    if (current.endTime < next.startTime) {
      breaks.push(`${current.endTime}–${next.startTime}`);
    }
  }

  return {
    academicYear: year
      ? {
          name: year.name,
          startDate: year.startDate.toISOString().slice(0, 10),
          endDate: year.endDate.toISOString().slice(0, 10),
          status: year.status,
        }
      : null,
    terms: year ? year.terms.map(formatTerm) : [],
    periods: periods.map((period) => ({
      period: period.period,
      startTime: period.startTime,
      endTime: period.endTime,
      label: period.label ?? "",
    })),
    breaks: breaks.join(", "),
  };
}
