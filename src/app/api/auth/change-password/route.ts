import { NextRequest, NextResponse } from "next/server";
import { compare, hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticateRequest } from "@/lib/tenant-context";
import { BadRequestError, handleApiError } from "@/lib/errors";
import { createAccessToken } from "@/lib/auth";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
  authCookieOptions,
} from "@/lib/auth-cookies";
import { createStoredRefreshToken, deleteRefreshTokens } from "@/lib/refresh-tokens";

/**
 * Bcrypt cost 10 — the same factor the seed and the admin-invite endpoint use,
 * so every hash in the `users` table costs the same to verify.
 */
const BCRYPT_COST = 10;

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters.")
      .max(100, "New password must be 100 characters or fewer."),
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

/**
 * POST /api/auth/change-password
 *
 * Changes the signed-in account's own password.
 *
 * The caller must prove they know the current password — a stolen session alone
 * is not enough to lock the owner out. The current password is compared with
 * bcrypt against the stored hash; the plain text never touches the database.
 *
 * On success every refresh token for that account is dropped, so any other
 * device signed in with the old password is signed out. This browser is then
 * given a fresh access and refresh token so it stays signed in.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);

    const body: unknown = await request.json().catch(() => null);
    const parsed = changePasswordSchema.safeParse(body);

    if (!parsed.success) {
      // One message per field, matching the shape the client already reads.
      const fields = Object.fromEntries(
        parsed.error.issues.map((issue) => [issue.path[0] as string, issue.message]),
      );
      throw new BadRequestError("Invalid input data.", fields);
    }

    const { currentPassword, newPassword } = parsed.data;

    // The account must actually know its current password.
    const matches = await compare(currentPassword, user.passwordHash);
    if (!matches) {
      throw new BadRequestError("Your current password is not correct.", {
        currentPassword: "Your current password is not correct.",
      });
    }

    // Changing to the same password would look like a successful change while
    // leaving the old credentials valid.
    const sameAsCurrent = await compare(newPassword, user.passwordHash);
    if (sameAsCurrent) {
      throw new BadRequestError("The new password must be different from the current one.", {
        newPassword: "The new password must be different from the current one.",
      });
    }

    const passwordHash = await hash(newPassword, BCRYPT_COST);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Sign out every other session, then re-issue this one.
    await deleteRefreshTokens(user.id);

    const accessToken = await createAccessToken({
      userId: user.id,
      email: user.email,
    });
    const { token: refreshToken } = await createStoredRefreshToken(user.id);

    const response = NextResponse.json({
      message: "Your password has been changed.",
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
