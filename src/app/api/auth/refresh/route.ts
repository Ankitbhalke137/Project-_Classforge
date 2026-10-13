
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAccessToken } from "@/lib/auth";
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_MAX_AGE,
  authCookieOptions,
} from "@/lib/auth-cookies";

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { message: "Refresh token is required." },
        { status: 401 },
      );
    }

    const tokenHash = createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !storedToken ||
      storedToken.revokedAt ||
      storedToken.expiresAt <= new Date()
    ) {
      const response = NextResponse.json(
        { message: "Invalid or expired refresh token. Please log in again." },
        { status: 401 },
      );

      response.cookies.set(ACCESS_TOKEN_COOKIE, "", {
        ...authCookieOptions,
        maxAge: 0,
      });
      response.cookies.set(REFRESH_TOKEN_COOKIE, "", {
        ...authCookieOptions,
        maxAge: 0,
      });

      return response;
    }

    const newRefreshToken = randomBytes(32).toString("base64url");
    const newTokenHash = createHash("sha256")
      .update(newRefreshToken)
      .digest("hex");

    const newFamilyId = storedToken.familyId;
    const newExpiresAt = new Date(
      Date.now() + REFRESH_TOKEN_MAX_AGE * 1000,
    );

    const accessToken = await createAccessToken({
      userId: storedToken.user.id,
      email: storedToken.user.email,
    });

    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      }),
      prisma.refreshToken.create({
        data: {
          tokenHash: newTokenHash,
          familyId: newFamilyId,
          userId: storedToken.user.id,
          expiresAt: newExpiresAt,
        },
      }),
    ]);

    const response = NextResponse.json({
      message: "Access token refreshed successfully.",
      token: accessToken,
    });

    response.cookies.set(
      ACCESS_TOKEN_COOKIE,
      accessToken,
      {
        ...authCookieOptions,
        maxAge: ACCESS_TOKEN_MAX_AGE,
      },
    );

    response.cookies.set(
      REFRESH_TOKEN_COOKIE,
      newRefreshToken,
      {
        ...authCookieOptions,
        maxAge: REFRESH_TOKEN_MAX_AGE,
      },
    );

    return response;
  } catch (error) {
    console.error("Refresh token error:", error);

    return NextResponse.json(
      { message: "Unable to refresh session." },
      { status: 500 },
    );
  }
}
