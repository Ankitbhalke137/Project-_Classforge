/**
 * Teacher service: manages teacher profiles, staff roster formatting, and account linking.
 */
import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { Prisma, MembershipRole, MembershipStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors";

/* ------------------------------------------------------------------ *
 * Validation
 * ------------------------------------------------------------------ */

const profileFields = {
  employeeNo: z.string().trim().max(50, "Employee number is too long").optional().nullable(),
  phone: z.string().trim().max(50, "Phone number is too long").optional().nullable(),
  qualification: z.string().trim().max(150, "Qualification is too long").optional().nullable(),
  designation: z.string().trim().max(100, "Designation is too long").optional().nullable(),
};

export const createTeacherSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .transform((email) => email.toLowerCase()),
  ...profileFields,
});

export type CreateTeacherInput = z.infer<typeof createTeacherSchema>;

export const updateTeacherSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name cannot be empty").max(100).optional(),
    lastName: z.string().trim().min(1, "Last name cannot be empty").max(100).optional(),
    email: z
      .string()
      .trim()
      .email("Enter a valid email address.")
      .transform((email) => email.toLowerCase())
      .optional(),
    ...profileFields,
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "Choose at least one field to change.",
  });

export type UpdateTeacherInput = z.infer<typeof updateTeacherSchema>;

/* ------------------------------------------------------------------ *
 * Shared selection + formatting
 * ------------------------------------------------------------------ */

/**
 * The membership is per school, so it is filtered by `tenantId` here rather than
 * pulled for every school the person belongs to.
 */
export function teacherInclude(tenantId: string) {
  return {
    user: {
      select: {
        id: true,
        name: true,
        email: true,
        memberships: {
          // The teacher status is the teaching membership, not a role they may
          // also hold in the same school.
          where: { tenantId, role: MembershipRole.TEACHER },
          select: { status: true },
        },
      },
    },
    teachingAssignments: {
      select: {
        sectionId: true,
        subjectId: true,
        subject: { select: { name: true } },
      },
    },
  } satisfies Prisma.TeacherInclude;
}

type TeacherWithRelations = Prisma.TeacherGetPayload<{
  include: ReturnType<typeof teacherInclude>;
}>;

export function formatTeacher(teacher: TeacherWithRelations) {
  const subjectNames = [...new Set(teacher.teachingAssignments.map((row) => row.subject.name))];

  return {
    id: teacher.id,
    userId: teacher.userId,
    name: `${teacher.firstName} ${teacher.lastName}`.trim(),
    email: teacher.user?.email ?? "",
    // The table shows one compact subject cell; subjectIds carries the full list.
    subject: subjectNames.join(", "),
    employeeNo: teacher.employeeNo ?? "",
    phone: teacher.phone ?? "",
    qualification: teacher.qualification ?? "",
    designation: teacher.designation ?? "",
    joinedOn: teacher.createdAt.toISOString(),
    subjectIds: [...new Set(teacher.teachingAssignments.map((row) => row.subjectId))],
    classIds: [...new Set(teacher.teachingAssignments.map((row) => row.sectionId))],
    status:
      teacher.user?.memberships[0]?.status === MembershipStatus.INACTIVE
        ? ("INACTIVE" as const)
        : ("ACTIVE" as const),
  };
}

async function assertEmployeeNoFree(tenantId: string, employeeNo: string | null | undefined, exceptId?: string) {
  if (!employeeNo) return;

  const duplicate = await prisma.teacher.findUnique({
    where: { tenantId_employeeNo: { tenantId, employeeNo } },
    select: { id: true },
  });

  if (duplicate && duplicate.id !== exceptId) {
    throw new ConflictError(`Employee number "${employeeNo}" is already in use at this school.`, {
      employeeNo: "Already in use",
    });
  }
}

/* ------------------------------------------------------------------ *
 * Operations
 * ------------------------------------------------------------------ */

/**
 * Adds a teacher to this school.
 *
 * A teacher is three rows: a global `User` (they sign in), a `Membership` (they
 * belong to this school) and a `Teacher` (they appear on the staff roster). The
 * invite route used to create the first two only, which is why invited teachers
 * never showed up here.
 *
 * A brand-new account gets a generated password, returned once so the route can
 * email it. An existing account keeps its password and gets the staff profile
 * plus membership only.
 */
export async function createTeacher(tenantId: string, rawInput: unknown) {
  const input = createTeacherSchema.parse(rawInput);

  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, name: true, email: true, passwordHash: true },
  });

  if (existingUser) {
    const [membership, teacherRow] = await Promise.all([
      prisma.membership.findUnique({
        where: { tenantId_userId: { tenantId, userId: existingUser.id } },
        select: { userId: true },
      }),
      prisma.teacher.findFirst({
        where: { tenantId, userId: existingUser.id },
        select: { id: true },
      }),
    ]);

    if (membership || teacherRow) {
      throw new ConflictError("This person is already on staff at this school.", {
        email: "Already on staff at this school.",
      });
    }

    await assertEmployeeNoFree(tenantId, input.employeeNo);

    const temporaryPassword = existingUser.passwordHash
      ? null
      : randomBytes(12).toString("base64url");
    // Hash before the transaction, never inside it — see the note in student-service.
    const passwordHash = temporaryPassword ? await hash(temporaryPassword, 10) : null;

    const teacher = await prisma.$transaction(async (tx) => {
      if (temporaryPassword) {
        await tx.user.update({
          where: { id: existingUser.id },
          data: { passwordHash: passwordHash! },
        });
      }

      await tx.membership.create({
        data: {
          tenantId,
          userId: existingUser.id,
          role: MembershipRole.TEACHER,
          status: MembershipStatus.ACTIVE,
        },
      });

      return tx.teacher.create({
        data: {
          tenantId,
          userId: existingUser.id,
          firstName: input.firstName,
          lastName: input.lastName,
          employeeNo: input.employeeNo || null,
          phone: input.phone || null,
          qualification: input.qualification || null,
          designation: input.designation || null,
        },
        include: teacherInclude(tenantId),
      });
    }, { timeout: 15_000 });

    return {
      teacher: formatTeacher(teacher),
      temporaryPassword,
      existingAccount: true,
    };
  }

  await assertEmployeeNoFree(tenantId, input.employeeNo);

  const temporaryPassword = randomBytes(12).toString("base64url");
  const passwordHash = await hash(temporaryPassword, 10);

  const teacher = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: `${input.firstName} ${input.lastName}`.trim(),
        email: input.email,
        passwordHash,
      },
    });

    await tx.membership.create({
      data: {
        tenantId,
        userId: user.id,
        role: MembershipRole.TEACHER,
        status: MembershipStatus.ACTIVE,
      },
    });

    return tx.teacher.create({
      data: {
        tenantId,
        userId: user.id,
        firstName: input.firstName,
        lastName: input.lastName,
        employeeNo: input.employeeNo || null,
        phone: input.phone || null,
        qualification: input.qualification || null,
        designation: input.designation || null,
      },
      include: teacherInclude(tenantId),
    });
  }, { timeout: 15_000 });

  return {
    teacher: formatTeacher(teacher),
    temporaryPassword,
    existingAccount: false,
  };
}

/** Updates the staff profile. Status changes go to the membership, not the row. */
export async function updateTeacher(tenantId: string, teacherId: string, rawInput: unknown) {
  const input = updateTeacherSchema.parse(rawInput);

  const current = await prisma.teacher.findFirst({
    where: { id: teacherId, tenantId },
    include: teacherInclude(tenantId),
  });

  if (!current) throw new NotFoundError("Teacher not found.");

  if (input.employeeNo !== undefined) {
    await assertEmployeeNoFree(tenantId, input.employeeNo, teacherId);
  }

  const profile: Prisma.TeacherUpdateInput = {};
  if (input.firstName !== undefined) profile.firstName = input.firstName;
  if (input.lastName !== undefined) profile.lastName = input.lastName;
  if (input.employeeNo !== undefined) profile.employeeNo = input.employeeNo || null;
  if (input.phone !== undefined) profile.phone = input.phone || null;
  if (input.qualification !== undefined) profile.qualification = input.qualification || null;
  if (input.designation !== undefined) profile.designation = input.designation || null;

  const nextName =
    input.firstName !== undefined || input.lastName !== undefined
      ? `${input.firstName ?? current.firstName} ${input.lastName ?? current.lastName}`.trim()
      : null;

  await prisma.$transaction(async (tx) => {
    if (Object.keys(profile).length > 0) {
      await tx.teacher.update({ where: { id: teacherId }, data: profile });
    }

    // Email lives on the global User account, linked to this teacher via userId.
    if (input.email !== undefined && current.userId && input.email !== current.user?.email) {
      const taken = await prisma.user.findFirst({
        where: { email: input.email, NOT: { id: current.userId } },
      });
      if (taken) {
        throw new ConflictError("This email is already in use.", { email: "Already in use" });
      }
      await tx.user.update({ where: { id: current.userId }, data: { email: input.email } });
    }

    if (nextName && current.userId) {
      // The name is on the global account, so keep it in step with the roster.
      await tx.user.update({ where: { id: current.userId }, data: { name: nextName } });
    }

    if (input.status && current.userId) {
      // Scope to the teaching membership: a teacher promoted to School Admin
      // keeps their admin access when the staff row is deactivated.
      await tx.membership.updateMany({
        where: { tenantId, userId: current.userId, role: MembershipRole.TEACHER },
        data: { status: input.status },
      });
    }
  }, { timeout: 15_000 });

  const updated = await prisma.teacher.findFirst({
    where: { id: teacherId, tenantId },
    include: teacherInclude(tenantId),
  });

  if (!updated) throw new NotFoundError("Teacher not found.");

  return formatTeacher(updated);
}

/** Deactivates access without deleting the profile or its history. */
export async function deactivateTeacher(tenantId: string, teacherId: string) {
  const current = await prisma.teacher.findFirst({
    where: { id: teacherId, tenantId },
    select: { id: true, userId: true },
  });

  if (!current) throw new NotFoundError("Teacher not found.");

  if (current.userId) {
    await prisma.membership.updateMany({
      where: { tenantId, userId: current.userId, role: MembershipRole.TEACHER },
      data: { status: MembershipStatus.INACTIVE },
    });
  }

  return { deactivated: true, status: "INACTIVE" as const };
}

/* ------------------------------------------------------------------ *
 * Teacher Listing with Pagination, Search and Sorting
 * ------------------------------------------------------------------ */

export const teacherListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().optional(),
  sort: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ALL"]).optional(),
});

export type TeacherListQuery = z.input<typeof teacherListQuerySchema>;

/**
 * Lists teachers with server-side pagination, search, and sorting.
 */
export async function listTeachers(tenantId: string, rawQuery: TeacherListQuery) {
  const query = teacherListQuerySchema.parse(rawQuery);
  const page = query.page;
  const limit = query.limit ?? query.pageSize ?? 20;
  const skip = (page - 1) * limit;

  const where: Prisma.TeacherWhereInput = {
    tenantId,
  };

  if (query.search) {
    const s = query.search.trim();
    where.OR = [
      { firstName: { contains: s, mode: "insensitive" } },
      { lastName: { contains: s, mode: "insensitive" } },
      { employeeNo: { contains: s, mode: "insensitive" } },
      { phone: { contains: s, mode: "insensitive" } },
      { qualification: { contains: s, mode: "insensitive" } },
      { designation: { contains: s, mode: "insensitive" } },
      {
        user: {
          OR: [
            { email: { contains: s, mode: "insensitive" } },
            { name: { contains: s, mode: "insensitive" } },
          ],
        },
      },
      {
        teachingAssignments: {
          some: {
            subject: { name: { contains: s, mode: "insensitive" } },
          },
        },
      },
    ];
  }

  if (query.status && query.status !== "ALL") {
    where.user = {
      memberships: {
        some: {
          tenantId,
          role: MembershipRole.TEACHER,
          status: query.status === "ACTIVE" ? MembershipStatus.ACTIVE : MembershipStatus.INACTIVE,
        },
      },
    };
  }

  let orderBy: Prisma.TeacherOrderByWithRelationInput[] = [{ lastName: "asc" }, { firstName: "asc" }];
  if (query.sort) {
    const [field, direction] = query.sort.split(":");
    const dir = direction?.toLowerCase() === "desc" ? "desc" : "asc";
    switch (field) {
      case "name":
        orderBy = [{ firstName: dir }, { lastName: dir }];
        break;
      case "firstName":
        orderBy = [{ firstName: dir }];
        break;
      case "lastName":
        orderBy = [{ lastName: dir }];
        break;
      case "employeeNo":
        orderBy = [{ employeeNo: dir }];
        break;
      case "createdAt":
        orderBy = [{ createdAt: dir }];
        break;
      default:
        orderBy = [{ lastName: "asc" }, { firstName: "asc" }];
    }
  }

  const [total, teachers] = await Promise.all([
    prisma.teacher.count({ where }),
    prisma.teacher.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: teacherInclude(tenantId),
    }),
  ]);

  const totalPages = Math.max(Math.ceil(total / limit), 1);
  const data = teachers.map(formatTeacher);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
    total,
    page,
    pageSize: limit,
    limit,
    totalPages,
  };
}
