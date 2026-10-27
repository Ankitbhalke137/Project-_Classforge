import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { MembershipRole, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext, withTenant } from "@/lib/tenant-context";
import { ConflictError, NotFoundError, handleApiError } from "@/lib/errors";
import { sendCredentialsEmail, appUrl } from "@/lib/mail";

/** The roles a School Admin may hand out. */
const INVITABLE_ROLES = ["TEACHER", "STUDENT"] as const;

const ROLE_LABEL: Record<string, string> = {
  TEACHER: "Teacher",
  STUDENT: "Student",
};

function generateTemporaryPassword(): string {
  return randomBytes(12).toString("base64url");
}

async function generateUniqueAdmissionNo(
  tx: Prisma.TransactionClient,
  tenantId: string,
  preferred?: string,
): Promise<string> {
  if (preferred) {
    const existing = await tx.student.findUnique({
      where: { tenantId_admissionNo: { tenantId, admissionNo: preferred } },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictError(`Admission number "${preferred}" is already in use at this school.`, {
        admissionNo: "Already in use",
      });
    }
    return preferred;
  }

  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = `STU-${year}-${randomBytes(3).toString("hex").toUpperCase()}`;
    const existing = await tx.student.findUnique({
      where: { tenantId_admissionNo: { tenantId, admissionNo: candidate } },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  return `STU-${year}-${Date.now().toString().slice(-6)}`;
}

const inviteSchema = z
  .object({
    name: z.string().trim().min(2, "Name is too short.").max(150).optional(),
    firstName: z.string().trim().max(100).optional(),
    lastName: z.string().trim().max(100).optional(),
    email: z
      .string()
      .trim()
      .email("Enter a valid email address.")
      .transform((email) => email.toLowerCase()),
    role: z.enum(INVITABLE_ROLES),
    admissionNo: z.string().trim().max(50).optional(),
    sectionId: z.string().uuid("Invalid section ID").optional().nullable(),
    academicYearId: z.string().uuid("Invalid academic year ID").optional().nullable(),
  })
  .refine(
    (data) => Boolean(data.name || data.firstName),
    { message: "Name is required.", path: ["name"] },
  );

/**
 * POST /api/t/:tenantSlug/invite
 *
 * Adds a person to this school and emails them a temporary password.
 *
 * Only a School Admin may invite.
 * - For TEACHER: Creates user, membership, and staff teacher profile.
 * - For STUDENT: Creates user, membership, student roster record with unique
 *   admission number, and optional section enrolment.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ tenantSlug: string }> }) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, ["SCHOOL_ADMIN"]);

    const body: unknown = await request.json().catch(() => null);
    const input = inviteSchema.parse(body);
    const name = input.name || `${input.firstName ?? ""} ${input.lastName ?? ""}`.trim() || "Invited User";
    const { email, role } = input;

    let user = await prisma.user.findUnique({ where: { email } });
    let temporaryPassword: string | null = null;

    if (user) {
      const existing = await prisma.membership.findFirst({
        where: { tenantId: tenant.id, userId: user.id },
      });
      if (existing) {
        throw new ConflictError("This person is already a member of this school.", {
          email: "Already a member of this school.",
        });
      }
    }

    if (!user) {
      temporaryPassword = generateTemporaryPassword();
      user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash: await hash(temporaryPassword, 10),
          mustChangePassword: true,
        },
      });
    } else if (!user.passwordHash) {
      temporaryPassword = generateTemporaryPassword();
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await hash(temporaryPassword, 10),
          mustChangePassword: true,
        },
      });
    }

    await withTenant(tenant.id, async (tx) => {
      await tx.membership.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          role: role as MembershipRole,
        },
      });
    });

    const [derivedFirst, ...rest] = name.trim().split(/\s+/);
    const first = input.firstName || derivedFirst || name;
    const last = input.lastName || rest.join(" ") || (role === "STUDENT" ? "Student" : "Staff");

    // An invited teacher must appear on the staff roster.
    if (role === "TEACHER") {
      await withTenant(tenant.id, async (tx) => {
        const alreadyOnStaff = await tx.teacher.findFirst({
          where: { tenantId: tenant.id, userId: user.id },
          select: { id: true },
        });

        if (!alreadyOnStaff) {
          await tx.teacher.create({
            data: {
              tenantId: tenant.id,
              userId: user.id,
              firstName: first,
              lastName: last,
            },
          });
        }
      });
    }

    // An invited student must appear on the student roster with an admission number.
    let studentId: string | undefined;
    let admissionNo: string | undefined;

    if (role === "STUDENT") {
      const student = await withTenant(tenant.id, async (tx) => {
        let currentStudent = await tx.student.findFirst({
          where: { tenantId: tenant.id, userId: user.id },
        });

        if (!currentStudent) {
          const finalAdmissionNo = await generateUniqueAdmissionNo(tx, tenant.id, input.admissionNo);
          currentStudent = await tx.student.create({
            data: {
              tenantId: tenant.id,
              userId: user.id,
              firstName: first,
              lastName: last,
              admissionNo: finalAdmissionNo,
              status: "ACTIVE",
            },
          });
        }

        // If a section is specified, enroll the student
        if (input.sectionId) {
          const section = await tx.section.findFirst({
            where: { id: input.sectionId, tenantId: tenant.id },
            include: { schoolClass: true },
          });

          if (!section) {
            throw new NotFoundError("Selected class section was not found in this school.");
          }

          let academicYearId = input.academicYearId || section.schoolClass.academicYearId;
          if (!academicYearId) {
            const activeYear = await tx.academicYear.findFirst({
              where: { tenantId: tenant.id, status: "ACTIVE" },
            });
            academicYearId = activeYear?.id ?? section.schoolClass.academicYearId;
          }

          const existingEnrolment = await tx.enrolment.findFirst({
            where: {
              tenantId: tenant.id,
              studentId: currentStudent.id,
              sectionId: section.id,
              academicYearId,
              status: "ACTIVE",
            },
          });

          if (!existingEnrolment) {
            await tx.enrolment.create({
              data: {
                tenantId: tenant.id,
                studentId: currentStudent.id,
                sectionId: section.id,
                academicYearId,
                status: "ACTIVE",
              },
            });
          }
        }

        return currentStudent;
      });

      studentId = student.id;
      admissionNo = student.admissionNo;
    }

    let emailSent = false;
    let emailError: string | null = null;
    if (temporaryPassword) {
      const result = await sendCredentialsEmail({
        to: user.email,
        name: user.name,
        schoolName: tenant.name,
        role: ROLE_LABEL[role] ?? role,
        temporaryPassword,
        signInUrl: `${appUrl()}/login`,
      });
      emailSent = result.sent;
      emailError = result.error ?? null;
    }

    return NextResponse.json(
      {
        userId: user.id,
        studentId,
        admissionNo,
        student: studentId ? { id: studentId, admissionNo } : null,
        name: user.name,
        email: user.email,
        role,
        schoolName: tenant.name,
        temporaryPassword,
        emailSent,
        emailError,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
