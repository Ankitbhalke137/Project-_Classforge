import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/errors";
import { createAccessToken } from "@/lib/auth";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
  authCookieOptions,
} from "@/lib/auth-cookies";
import { createStoredRefreshToken, deleteRefreshTokens } from "@/lib/refresh-tokens";

/** Bcrypt cost 10 — same factor used everywhere else in the app. */
const BCRYPT_COST = 10;

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required."),
  email: z.string().email("Enter a valid email address.").trim().toLowerCase(),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters.")
    .max(100, "New password must be 100 characters or fewer."),
});

/**
 * POST /api/auth/reset-password
 *
 * Resets a user's password using a one-time reset token.
 *
 * Security:
 * - Token must match the stored `passwordResetToken` for the email
 * - Token must not be expired (`passwordResetExpires` > now)
 * - On success, token is cleared, all refresh tokens are revoked, and new
 *   access + refresh tokens are issued so the user stays signed in
 */
export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json().catch(() => null);
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      const fields = Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path[0] as string, issue.message]),
      );
      return NextResponse.json(
        { message: "Invalid input data.", fields },
        { status: 400 },
      );
    }

    const { token, email, newPassword } = parsed.data;

    // Find the user by email
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal whether the email exists — return success anyway
      return NextResponse.json({
        message: "If the reset link is valid, your password has been reset.",
      });
    }

    // Validate the reset token
    if (
      !user.passwordResetToken ||
      user.passwordResetToken !== token ||
      !user.passwordResetExpires ||
      new Date(user.passwordResetExpires) < new Date()
    ) {
      return NextResponse.json(
        { message: "Invalid or expired reset link. Request a new one." },
        { status: 400 },
      );
    }

    // Hash the new password
    const passwordHash = await hash(newPassword, BCRYPT_COST);

    // Update user: clear reset token, set new password, clear mustChangePassword
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
        mustChangePassword: false,
      },
    });

    // Revoke all refresh tokens so every other session is signed out
    await deleteRefreshTokens(user.id);

    // Issue fresh access + refresh tokens so the user stays signed in
    const accessToken = await createAccessToken({
      userId: user.id,
      email: user.email,
    });
    const { token: refreshToken } = await createStoredRefreshToken(user.id);

    const response = NextResponse.json({
      message: "Your password has been reset successfully.",
    });
    response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
      ...authCookieOptions,
      maxAge: ACCESS_TOKEN_MAX_AGE,
    });
    response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, {
      ...authCookieOptions,
      maxAge: REFRESH_TOKEN_MAX_AGE,
    });

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
