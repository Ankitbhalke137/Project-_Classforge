import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/service";
import { appUrl } from "@/lib/mail";
import { handleApiError } from "@/lib/errors";

const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address.").trim().toLowerCase(),
});

/**
 * POST /api/auth/forgot-password
 *
 * Starts a password reset flow for the given email.
 *
 * Security: always returns success, whether or not the email exists. This
 * prevents email enumeration through this endpoint. The email itself only
 * goes out when a matching user is found.
 */
export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json().catch(() => null);
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      throw new NextResponse(
        JSON.stringify({ message: "Enter a valid email address." }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }

    const { email } = parsed.data;

    // Look up the user without revealing whether the email exists.
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      // Generate a single-use reset token valid for 1 hour.
      const resetToken = randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: resetToken,
          passwordResetExpires: expiresAt,
        },
      });

      const resetUrl = `${appUrl()}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

      await sendEmail({
        to: email,
        subject: "Reset your ClassForge password",
        html: `
          <h2>Reset your password</h2>
          <p>Hello ${user.name},</p>
          <p>Click the button below to reset your ClassForge password. This link expires in 1 hour.</p>
          <a href="${resetUrl}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Reset password</a>
          <p style="margin-top:20px;font-size:14px;color:#666;">If you did not request this, you can safely ignore this email.</p>
        `,
        text: `Reset your ClassForge password. Visit: ${resetUrl}`,
      });
    }

    // Always return success to prevent email enumeration.
    return NextResponse.json({
      message:
        "If an account exists for this email, a password reset link has been sent.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
