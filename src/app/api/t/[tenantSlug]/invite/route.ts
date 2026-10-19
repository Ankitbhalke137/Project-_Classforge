import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { z } from "zod";
import { MembershipRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant-context";
import { ConflictError, handleApiError } from "@/lib/errors";
import { sendEmail } from "@/lib/email/service";
import { staffInviteHtml, staffInviteText } from "@/lib/email/templates";

const inviteSchema = z.object({
  name: z.string().trim().min(2, "Name is too short.").max(150),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .transform((email) => email.toLowerCase()),
  role: z.enum(["TEACHER", "STUDENT"]),
});

/** One readable temporary password, handed to the new member by email. */
function generateTemporaryPassword(): string {
  return randomBytes(12).toString("base64url");
}

/**
 * POST /api/t/:tenantSlug/invite
 *
 * Invites one person to this school as a teacher or a student and emails them
 * their temporary password.
 *
 * Only a School Admin may invite. A teacher can look at the staff list but
 * cannot add to it.
 *
 * The person may already have an account — in that case they keep their
 * existing password and only the membership is added. An account with no
 * password yet (a student imported from the roster) is given one, because
 * otherwise it could never sign in.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, ["SCHOOL_ADMIN"]);

    const body: unknown = await request.json().catch(() => null);
    const { name, email, role } = inviteSchema.parse(body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      const alreadyHere = await prisma.membership.findUnique({
        where: { tenantId_userId: { tenantId: tenant.id, userId: existing.id } },
      });
      if (alreadyHere) {
        throw new ConflictError("This person is already a member of this school.", {
          email: "Already a member of this school.",
        });
      }
    }

    let user = existing;
    let temporaryPassword: string | null = null;

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

    const loginUrl = `${process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? ""}/login`;

    let emailSent = false;
    if (temporaryPassword) {
      const info = await sendEmail({
        to: email,
        subject: `Your ${tenant.name} account is ready`,
        html: staffInviteHtml({
          name,
          tempPassword: temporaryPassword,
          schoolName: tenant.name,
          loginUrl,
        }),
        text: staffInviteText({
          name,
          tempPassword: temporaryPassword,
          schoolName: tenant.name,
          loginUrl,
        }),
      });
      emailSent = info !== null;
    }

    return NextResponse.json(
      {
        userId: user.id,
        name: user.name,
        email: user.email,
        role,
        schoolId: tenant.id,
        schoolName: tenant.name,
        schoolSlug: tenant.slug,
        // Null when the person already had a working account.
        temporaryPassword,
        // False when SMTP is not configured or the send failed.
        emailSent,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
