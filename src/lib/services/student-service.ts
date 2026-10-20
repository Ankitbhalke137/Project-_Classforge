import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { z } from "zod";
import { Prisma, MembershipRole, EnrolmentStatus, MembershipStatus } from "@prisma/client";
import { withTenant } from "@/lib/tenant-context";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/errors";

/* ------------------------------------------------------------------ *
 * Validation Schemas
 * ------------------------------------------------------------------ */

export const studentListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().trim().optional(),
  classId: z.string().uuid("Invalid class ID").optional(),
  sectionId: z.string().uuid("Invalid section ID").optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ALL"]).optional(),
  sort: z.string().optional(),
});

export type StudentListQuery = {
  page?: number;
  limit?: number;
  pageSize?: number;
  search?: string;
  classId?: string;
  sectionId?: string;
  status?: "ACTIVE" | "INACTIVE" | "ALL";
  sort?: string;
};

export const createStudentSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  admissionNo: z.string().trim().min(1, "Admission number is required").max(50),
  dateOfBirth: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be in YYYY-MM-DD format")
    .optional()
    .nullable(),
  email: z.string().trim().email("Invalid email address").optional().nullable(),
  phone: z.string().trim().max(50, "Phone number is too long").optional().nullable(),
  guardianName: z.string().trim().max(150, "Guardian name is too long").optional().nullable(),
  guardianPhone: z.string().trim().max(50, "Guardian phone is too long").optional().nullable(),
  sectionId: z.string().uuid("Invalid section ID").optional().nullable(),
  academicYearId: z.string().uuid("Invalid academic year ID").optional().nullable(),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;

export const updateStudentSchema = z.object({
  firstName: z.string().trim().min(1, "First name cannot be empty").max(100).optional(),
  lastName: z.string().trim().min(1, "Last name cannot be empty").max(100).optional(),
  admissionNo: z.string().trim().min(1, "Admission number cannot be empty").max(50).optional(),
  dateOfBirth: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be in YYYY-MM-DD format")
    .optional()
    .nullable(),
  email: z.string().trim().email("Invalid email address").optional().nullable(),
  phone: z.string().trim().max(50, "Phone number is too long").optional().nullable(),
  guardianName: z.string().trim().max(150, "Guardian name is too long").optional().nullable(),
  guardianPhone: z.string().trim().max(50, "Guardian phone is too long").optional().nullable(),
  sectionId: z.string().uuid("Invalid section ID").optional().nullable(),
  academicYearId: z.string().uuid("Invalid academic year ID").optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE", "WITHDRAWN", "COMPLETED", "TRANSFERRED"]).optional(),
});

export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;

export interface UserContext {
  userId: string;
  role: MembershipRole;
}

/* ------------------------------------------------------------------ *
 * Helper: format student record for responses
 * ------------------------------------------------------------------ */

export function formatStudentRecord(student: {
  id: string;
  tenantId: string;
  userId: string | null;
  admissionNo: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date | null;
  phone?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  status?: string;
  createdAt: Date;
  user?: { id: string; name: string; email: string } | null;
  enrolments?: Array<{
    id: string;
    status: EnrolmentStatus;
    sectionId: string;
    academicYearId: string;
    section?: {
      id: string;
      name: string;
      classId: string;
      schoolClass?: { id: string; name: string };
    };
  }>;
}) {
  const activeEnrolment =
    student.enrolments?.find((e) => e.status === "ACTIVE") ?? student.enrolments?.[0];

  const className = activeEnrolment?.section?.schoolClass?.name
    ? `${activeEnrolment.section.schoolClass.name}${
        activeEnrolment.section.name ? ` - ${activeEnrolment.section.name}` : ""
      }`
    : "Unassigned";

  const isEnrolmentActive = activeEnrolment ? activeEnrolment.status === "ACTIVE" : true;
  // The enrolment is the source of truth (it existed before the status column);
  // the column is a mirror so a row can be filtered without a join.
  const isActive = isEnrolmentActive && student.status !== "INACTIVE";

  return {
    id: student.id,
    name: `${student.firstName} ${student.lastName}`.trim(),
    firstName: student.firstName,
    lastName: student.lastName,
    email: student.user?.email ?? "",
    admissionNo: student.admissionNo,
    className,
    classId: activeEnrolment?.section?.classId ?? null,
    sectionId: activeEnrolment?.sectionId ?? null,
    sectionName: activeEnrolment?.section?.name ?? null,
    academicYearId: activeEnrolment?.academicYearId ?? null,
    dateOfBirth: student.dateOfBirth
      ? student.dateOfBirth.toISOString().split("T")[0]
      : null,
    phone: student.phone ?? null,
    guardianName: student.guardianName ?? null,
    guardianPhone: student.guardianPhone ?? null,
    status: isActive ? ("ACTIVE" as const) : ("INACTIVE" as const),
    enrolmentStatus: activeEnrolment?.status ?? null,
    createdAt: student.createdAt.toISOString(),
  };
}

/* ------------------------------------------------------------------ *
 * Service Operations
 * ------------------------------------------------------------------ */

/**
 * List students with pagination, search, sort, and class/section filtering.
 */
export async function listStudents(
  tenantId: string,
  rawQuery: StudentListQuery,
  userContext: UserContext,
) {
  // Role checks: Students cannot view the student roster (PRD Page 4)
  if (userContext.role === "STUDENT") {
    throw new ForbiddenError("Students cannot access the school roster.");
  }

  const query = studentListQuerySchema.parse(rawQuery);
  const page = query.page;
  const limit = query.limit ?? query.pageSize ?? 20;
  const skip = (page - 1) * limit;

  // Build where clause strictly scoped to tenantId
  const where: Prisma.StudentWhereInput = {
    tenantId,
  };

  // Search filter
  if (query.search) {
    const s = query.search.trim();
    where.OR = [
      { firstName: { contains: s, mode: "insensitive" } },
      { lastName: { contains: s, mode: "insensitive" } },
      { admissionNo: { contains: s, mode: "insensitive" } },
      {
        user: {
          OR: [
            { email: { contains: s, mode: "insensitive" } },
            { name: { contains: s, mode: "insensitive" } },
          ],
        },
      },
      {
        enrolments: {
          some: {
            section: {
              OR: [
                { name: { contains: s, mode: "insensitive" } },
                {
                  schoolClass: {
                    name: { contains: s, mode: "insensitive" },
                  },
                },
              ],
            },
          },
        },
      },
    ];
  }

  // Class / Section filters
  if (query.classId || query.sectionId) {
    where.enrolments = {
      some: {
        ...(query.sectionId ? { sectionId: query.sectionId } : {}),
        ...(query.classId
          ? {
              section: {
                classId: query.classId,
              },
            }
          : {}),
      },
    };
  }

  // Status filter
  if (query.status && query.status !== "ALL") {
    if (query.status === "ACTIVE") {
      where.enrolments = {
        some: {
          status: "ACTIVE",
          ...(where.enrolments?.some ?? {}),
        },
      };
    } else if (query.status === "INACTIVE") {
      where.enrolments = {
        none: {
          status: "ACTIVE",
        },
      };
    }
  }

  // Sorting
  let orderBy: Prisma.StudentOrderByWithRelationInput[] = [{ createdAt: "desc" }];
  if (query.sort) {
    const [field, direction] = query.sort.split(":");
    const dir = direction?.toLowerCase() === "asc" ? "asc" : "desc";
    switch (field) {
      case "name":
        orderBy = [{ firstName: dir }, { lastName: dir }];
        break;
      case "admissionNo":
        orderBy = [{ admissionNo: dir }];
        break;
      case "createdAt":
        orderBy = [{ createdAt: dir }];
        break;
      default:
        orderBy = [{ createdAt: "desc" }];
    }
  }

  // Centralized query context execution
  return withTenant(tenantId, async (tx) => {
    const [total, students] = await Promise.all([
      tx.student.count({ where }),
      tx.student.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          enrolments: {
            include: {
              section: {
                include: {
                  schoolClass: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const totalPages = Math.max(Math.ceil(total / limit), 1);
    const data = students.map(formatStudentRecord);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      // Keep top-level pagination properties for frontend PaginationBar compatibility
      total,
      page,
      pageSize: limit,
    };
  });
}

/**
 * Fetch a single student's details by ID.
 * Returns null if the student does not exist in this tenant (returns 404 to avoid leaking cross-tenant data).
 */
export async function getStudentById(
  tenantId: string,
  studentId: string,
  userContext: UserContext,
) {
  return withTenant(tenantId, async (tx) => {
    const student = await tx.student.findFirst({
      where: {
        id: studentId,
        tenantId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        enrolments: {
          orderBy: { enrolledAt: "desc" },
          include: {
            section: {
              include: {
                schoolClass: true,
              },
            },
            academicYear: true,
          },
        },
        attendanceRecords: {
          take: 20,
          orderBy: { attendanceDate: "desc" },
          select: {
            id: true,
            attendanceDate: true,
            status: true,
          },
        },
      },
    });

    if (!student) {
      return null;
    }

    // Ownership check: Student role can only view their own record (PRD Page 4)
    if (userContext.role === "STUDENT" && student.userId !== userContext.userId) {
      throw new ForbiddenError("You may only view your own student record.");
    }

    // Compute attendance summary
    const totalAttendance = student.attendanceRecords.length;
    const presentCount = student.attendanceRecords.filter(
      (r) => r.status === "PRESENT",
    ).length;
    const absentCount = student.attendanceRecords.filter(
      (r) => r.status === "ABSENT",
    ).length;
    const lateCount = student.attendanceRecords.filter(
      (r) => r.status === "LATE",
    ).length;
    const excusedCount = student.attendanceRecords.filter(
      (r) => r.status === "EXCUSED",
    ).length;

    const attendanceRate =
      totalAttendance > 0
        ? Math.round((presentCount / totalAttendance) * 100)
        : null;

    const base = formatStudentRecord(student);

    return {
      ...base,
      enrolments: student.enrolments.map((e) => ({
        id: e.id,
        status: e.status,
        enrolledAt: e.enrolledAt.toISOString(),
        academicYear: {
          id: e.academicYear.id,
          name: e.academicYear.name,
          status: e.academicYear.status,
        },
        class: {
          id: e.section.schoolClass.id,
          name: e.section.schoolClass.name,
        },
        section: {
          id: e.section.id,
          name: e.section.name,
        },
      })),
      attendanceSummary: {
        total: totalAttendance,
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        excused: excusedCount,
        percentage: attendanceRate,
      },
    };
  });
}

/**
 * Create a new student within the tenant.
 */
export async function createStudent(
  tenantId: string,
  rawInput: CreateStudentInput,
  userContext: UserContext,
) {
  // Permission check: Only SCHOOL_ADMIN can add students (PRD Page 4 & 5)
  if (userContext.role !== "SCHOOL_ADMIN") {
    throw new ForbiddenError("Only School Admins can create student records.");
  }

  const input = createStudentSchema.parse(rawInput);

  // bcrypt must stay outside the transaction. Hashing inside it, on a cold
  // serverless connection, pushed the first create past the 5s budget (P2028).
  const candidatePassword = input.email ? randomBytes(12).toString("base64url") : null;
  const candidateHash = candidatePassword ? await hash(candidatePassword, 10) : null;

  return withTenant(tenantId, async (tx) => {
    // 1. Verify admission number uniqueness within this school
    const existingStudent = await tx.student.findUnique({
      where: {
        tenantId_admissionNo: {
          tenantId,
          admissionNo: input.admissionNo,
        },
      },
    });

    if (existingStudent) {
      throw new ConflictError(
        `Admission number "${input.admissionNo}" is already in use at this school.`,
        { admissionNo: "Already in use" },
      );
    }

    // 2. Validate section if provided
    let section: { id: string; classId: string } | null = null;
    let academicYearId = input.academicYearId;

    if (input.sectionId) {
      section = await tx.section.findFirst({
        where: {
          id: input.sectionId,
          tenantId,
        },
        select: { id: true, classId: true },
      });

      if (!section) {
        throw new BadRequestError("Specified section does not belong to this school.", {
          sectionId: "Section not found in this school",
        });
      }

      // If academicYearId not supplied, pick the active academic year
      if (!academicYearId) {
        const activeYear = await tx.academicYear.findFirst({
          where: {
            tenantId,
            status: "ACTIVE",
          },
          select: { id: true },
        });

        if (!activeYear) {
          throw new BadRequestError(
            "No active academic year found for this school to enroll the student.",
          );
        }
        academicYearId = activeYear.id;
      }
    }

    // 3. Handle optional user creation or linking if email provided
    let linkedUserId: string | null = null;
    let temporaryPassword: string | null = null;
    if (input.email) {
      const email = input.email.toLowerCase();
      let user = await tx.user.findUnique({
        where: { email },
      });

      if (!user) {
        // A student with no password could never sign in, so give the account a
        // temporary one and let the route email it. It is shown once, never stored.
        temporaryPassword = candidatePassword;
        user = await tx.user.create({
          data: {
            name: `${input.firstName} ${input.lastName}`.trim(),
            email,
            passwordHash: candidateHash!,
          },
        });
      } else if (!user.passwordHash) {
        temporaryPassword = candidatePassword;
        user = await tx.user.update({
          where: { id: user.id },
          data: { passwordHash: candidateHash! },
        });
      }

      linkedUserId = user.id;

      // Ensure membership exists
      await tx.membership.upsert({
        where: {
          tenantId_userId: {
            tenantId,
            userId: user.id,
          },
        },
        update: {
          role: "STUDENT",
          status: "ACTIVE",
        },
        create: {
          tenantId,
          userId: user.id,
          role: "STUDENT",
          status: "ACTIVE",
        },
      });
    }

    // 4. Create the student record
    const student = await tx.student.create({
      data: {
        tenantId,
        admissionNo: input.admissionNo,
        firstName: input.firstName,
        lastName: input.lastName,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
        phone: input.phone ?? null,
        guardianName: input.guardianName ?? null,
        guardianPhone: input.guardianPhone ?? null,
        userId: linkedUserId,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // 5. Create initial enrolment if section was provided
    let enrolmentWithSection = null;
    if (section && academicYearId) {
      const enrolment = await tx.enrolment.create({
        data: {
          tenantId,
          studentId: student.id,
          sectionId: section.id,
          academicYearId,
          status: "ACTIVE",
        },
        include: {
          section: {
            include: {
              schoolClass: {
                select: { id: true, name: true },
              },
            },
          },
        },
      });
      enrolmentWithSection = [enrolment];
    }

    return {
      student: formatStudentRecord({
        ...student,
        enrolments: enrolmentWithSection ?? [],
      }),
      temporaryPassword,
    };
  }, { timeout: 15_000 });
}

/**
 * Update an existing student's details, enrolment, or status.
 */
export async function updateStudent(
  tenantId: string,
  studentId: string,
  rawInput: UpdateStudentInput,
  userContext: UserContext,
) {
  // Permission check: Only SCHOOL_ADMIN can edit students (PRD Page 4 & 5)
  if (userContext.role !== "SCHOOL_ADMIN") {
    throw new ForbiddenError("Only School Admins can update student records.");
  }

  const input = updateStudentSchema.parse(rawInput);

  return withTenant(tenantId, async (tx) => {
    // 1. Verify student exists in this tenant (returns 404 if not found)
    const current = await tx.student.findFirst({
      where: {
        id: studentId,
        tenantId,
      },
      include: {
        user: true,
        enrolments: {
          where: { status: "ACTIVE" },
          take: 1,
        },
      },
    });

    if (!current) {
      throw new NotFoundError("Student not found.");
    }

    // 2. Check admission number uniqueness if changed
    if (input.admissionNo && input.admissionNo !== current.admissionNo) {
      const duplicate = await tx.student.findUnique({
        where: {
          tenantId_admissionNo: {
            tenantId,
            admissionNo: input.admissionNo,
          },
        },
      });

      if (duplicate && duplicate.id !== studentId) {
        throw new ConflictError(
          `Admission number "${input.admissionNo}" is already in use at this school.`,
          { admissionNo: "Already in use" },
        );
      }
    }

    // 3. Update student basic fields
    const dataToUpdate: Prisma.StudentUpdateInput = {};
    if (input.firstName !== undefined) dataToUpdate.firstName = input.firstName;
    if (input.lastName !== undefined) dataToUpdate.lastName = input.lastName;
    if (input.admissionNo !== undefined) dataToUpdate.admissionNo = input.admissionNo;
    if (input.dateOfBirth !== undefined) {
      dataToUpdate.dateOfBirth = input.dateOfBirth ? new Date(input.dateOfBirth) : null;
    }
    if (input.phone !== undefined) dataToUpdate.phone = input.phone || null;
    if (input.guardianName !== undefined) dataToUpdate.guardianName = input.guardianName || null;
    if (input.guardianPhone !== undefined) dataToUpdate.guardianPhone = input.guardianPhone || null;

    // 4. Update section / class enrolment if sectionId provided
    if (input.sectionId !== undefined) {
      if (input.sectionId === null) {
        // Deactivate active enrolments
        await tx.enrolment.updateMany({
          where: {
            tenantId,
            studentId,
            status: "ACTIVE",
          },
          data: {
            status: "TRANSFERRED",
          },
        });
      } else {
        const section = await tx.section.findFirst({
          where: { id: input.sectionId, tenantId },
          select: { id: true },
        });

        if (!section) {
          throw new BadRequestError("Specified section not found in this school.", {
            sectionId: "Section not found",
          });
        }

        const activeYear =
          input.academicYearId ??
          (
            await tx.academicYear.findFirst({
              where: { tenantId, status: "ACTIVE" },
              select: { id: true },
            })
          )?.id;

        if (!activeYear) {
          throw new BadRequestError("No active academic year found for enrolment.");
        }

        // Close existing active enrolments and create new one
        await tx.enrolment.updateMany({
          where: {
            tenantId,
            studentId,
            status: "ACTIVE",
          },
          data: {
            status: "TRANSFERRED",
          },
        });

        await tx.enrolment.create({
          data: {
            tenantId,
            studentId,
            sectionId: input.sectionId,
            academicYearId: activeYear,
            status: "ACTIVE",
          },
        });
      }
    }

    // 5. Handle status update (ACTIVE vs INACTIVE / WITHDRAWN)
    if (input.status) {
      if (input.status === "INACTIVE" || input.status === "WITHDRAWN") {
        dataToUpdate.status = "INACTIVE";
        await tx.enrolment.updateMany({
          where: {
            tenantId,
            studentId,
            status: "ACTIVE",
          },
          data: {
            status: "WITHDRAWN",
          },
        });

        if (current.userId) {
          await tx.membership.updateMany({
            where: {
              tenantId,
              userId: current.userId,
            },
            data: {
              status: MembershipStatus.INACTIVE,
            },
          });
        }
      } else if (input.status === "ACTIVE") {
        dataToUpdate.status = "ACTIVE";
        const latestEnrolment = await tx.enrolment.findFirst({
          where: { tenantId, studentId },
          orderBy: { enrolledAt: "desc" },
        });

        if (latestEnrolment) {
          await tx.enrolment.update({
            where: { id: latestEnrolment.id },
            data: { status: "ACTIVE" },
          });
        }

        if (current.userId) {
          await tx.membership.updateMany({
            where: {
              tenantId,
              userId: current.userId,
            },
            data: {
              status: MembershipStatus.ACTIVE,
            },
          });
        }
      }
    }

    // 6. Update user email if linked and email provided
    if (input.email !== undefined && current.user) {
      await tx.user.update({
        where: { id: current.user.id },
        data: { email: input.email?.toLowerCase() ?? current.user.email },
      });
    }

    // 7. Save student updates
    const updated = await tx.student.update({
      where: { id: studentId },
      data: dataToUpdate,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        enrolments: {
          include: {
            section: {
              include: {
                schoolClass: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
      },
    });

    return formatStudentRecord(updated);
  }, { timeout: 15_000 });
}

/**
 * Delete or deactivate a student record.
 * By default deactivates the student (sets enrolment to WITHDRAWN and membership to INACTIVE).
 * If permanent is true, permanently removes the student record.
 */
export async function deleteOrDeactivateStudent(
  tenantId: string,
  studentId: string,
  options: { permanent?: boolean } = {},
  userContext: UserContext,
) {
  // Permission check: Only SCHOOL_ADMIN can delete/deactivate students (PRD Page 4 & 5)
  if (userContext.role !== "SCHOOL_ADMIN") {
    throw new ForbiddenError("Only School Admins can delete or deactivate students.");
  }

  return withTenant(tenantId, async (tx) => {
    // 1. Verify student exists in this tenant (returns 404 if not found)
    const student = await tx.student.findFirst({
      where: {
        id: studentId,
        tenantId,
      },
    });

    if (!student) {
      throw new NotFoundError("Student not found.");
    }

    if (options.permanent) {
      // Permanent deletion (Prisma cascade removes enrolments, marks, attendanceRecords)
      await tx.student.delete({
        where: { id: studentId },
      });

      return {
        message: "Student deleted successfully.",
        deleted: true,
      };
    }

    // Deactivation: set enrolments to WITHDRAWN and membership to INACTIVE
    await tx.student.update({
      where: { id: studentId },
      data: { status: "INACTIVE" },
    });

    await tx.enrolment.updateMany({
      where: {
        tenantId,
        studentId,
        status: "ACTIVE",
      },
      data: {
        status: "WITHDRAWN",
      },
    });

    if (student.userId) {
      await tx.membership.updateMany({
        where: {
          tenantId,
          userId: student.userId,
        },
        data: {
          status: MembershipStatus.INACTIVE,
        },
      });
    }

    return {
      message: "Student deactivated successfully.",
      deleted: false,
      status: "INACTIVE",
    };
  }, { timeout: 15_000 });
}
