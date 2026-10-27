import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { BadRequestError, NotFoundError, handleApiError } from "@/lib/errors";
import { requireSuperAdmin } from "@/lib/platform-auth";
import { sendCredentialsEmail, appUrl } from "@/lib/mail";

const resendSchema = z.object({
  tenantId: z.string().uuid("Choose a school."),
});

const ROLE_LABEL: Record<string, string> = {
  SCHOOL_ADMIN: "School Admin",
  TEACHER: "Teacher",
};

/**
 * POST /api/platform/admins/:userId/resend
 *
 * Issues a fresh temporary password and emails it again.
 *
 * This is what an invite cannot do. An invite only generates a password for a
 * brand-new account; if the person already exists, or the first email never
 * arrived, there is nothing to resend. This gives them a new password instead.
 *
 * The school comes in the body because the email names it, but the password is
 * on the account, not the membership — so this also signs them out everywhere.
 *
 * If the message cannot be sent the old hash is put back. Nobody knows the new
 * password at that point, and leaving it in place would lock the person out of
 * every school they belong to.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  try {
    await requireSuperAdmin(request);

    const { userId } = await context.params;
    const body: unknown = await request.json().catch(() => null);
    const { tenantId } = resendSchema.parse(body);

    const membership = await prisma.membership.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            passwordHash: true,
            mustChangePassword: true,
            platformRole: true,
          },
        },
        tenant: { select: { id: true, name: true } },
      },
    });

    if (!membership) throw new NotFoundError("That person is not a member of this school.");

    // The platform owner changes their own password from the Security tab, and
    // no staff row should be able to reset it from here.
    if (membership.user.platformRole === "SUPER_ADMIN") {
      throw new BadRequestError(
        "The platform Super Admin changes their own password from the Security tab.",
      );
    }

    const previousHash = membership.user.passwordHash;
    const previousMustChange = membership.user.mustChangePassword;
    const temporaryPassword = randomBytes(12).toString("base64url");

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await hash(temporaryPassword, 10),
        mustChangePassword: true,
      },
    });

    const result = await sendCredentialsEmail({
      to: membership.user.email,
      name: membership.user.name,
      schoolName: membership.tenant.name,
      role: ROLE_LABEL[membership.role] ?? membership.role,
      temporaryPassword,
      signInUrl: `${appUrl()}/login`,
    });

    if (!result.sent) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash: previousHash,
          mustChangePassword: previousMustChange,
        },
      });

      return NextResponse.json(
        {
          emailSent: false,
          emailError: result.error ?? "The email could not be sent.",
        },
        { status: 502 },
      );
    }

    // Only once the password is safely in their inbox: end every other session.
    // Doing this before sending would sign them out even when nothing changed.
    await prisma.refreshToken.deleteMany({ where: { userId } });

    return NextResponse.json({
      userId,
      tenantId,
      name: membership.user.name,
      email: membership.user.email,
      schoolName: membership.tenant.name,
      emailSent: true,
      emailError: null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
