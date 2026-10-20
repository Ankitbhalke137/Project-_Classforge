import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { MembershipRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant-context";
import { ConflictError, handleApiError } from "@/lib/errors";
import { sendCredentialsEmail, appUrl } from "@/lib/mail";

/** The roles a School Admin may hand out. Students are created from a roster. */
const INVITABLE_ROLES = ["TEACHER", "STUDENT"] as const;

const ROLE_LABEL: Record<string, string> = {
  TEACHER: "Teacher",
  STUDENT: "Student",
};

function generateTemporaryPassword(): string {
  return randomBytes(12).toString("base64url");
}

const inviteSchema = z.object({
  name: z.string().trim().min(2, "Name is too short.").max(150),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .transform((email) => email.toLowerCase()),
  role: z.enum(INVITABLE_ROLES),
});

/**
 * POST /api/t/:tenantSlug/invite
 *
 * Adds a person to this school and emails them a temporary password.
 *
 * Only a School Admin may invite. The password is generated, stored as a bcrypt
 * hash and emailed once — it is never kept in the clear, so it cannot be shown
 * again later. If the email cannot be sent the membership still exists and the
 * School Admin shares the password by hand.
 *
 * An email that already has an account keeps its existing password; only the
 * membership is added. An account with no password yet is given one, because
 * otherwise it could never sign in.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ tenantSlug: string }> }) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, ["SCHOOL_ADMIN"]);

    const body: unknown = await request.json().catch(() => null);
    const { name, email, role } = inviteSchema.parse(body);

    let user = await prisma.user.findUnique({ where: { email } });
    let temporaryPassword: string | null = null;

    if (user) {
      const existing = await prisma.membership.findUnique({
        where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
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
        },
      });
    } else if (!user.passwordHash) {
      temporaryPassword = generateTemporaryPassword();
      user = await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await hash(temporaryPassword, 10) },
      });
    }

    await prisma.membership.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        role: role as MembershipRole,
      },
    });

    // An invited teacher must also appear on the staff roster. The membership
    // alone made them a member of the school but invisible to the Teachers page.
    if (role === "TEACHER") {
      const alreadyOnStaff = await prisma.teacher.findFirst({
        where: { tenantId: tenant.id, userId: user.id },
        select: { id: true },
      });

      if (!alreadyOnStaff) {
        const [firstName, ...rest] = name.trim().split(/\s+/);
        await prisma.teacher.create({
          data: {
            tenantId: tenant.id,
            userId: user.id,
            firstName: firstName || name,
            lastName: rest.join(" "),
          },
        });
      }
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
