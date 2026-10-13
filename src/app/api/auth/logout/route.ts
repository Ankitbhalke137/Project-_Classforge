
import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  authCookieOptions,
} from "@/lib/auth-cookies";

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

    if (refreshToken) {
      const tokenHash = createHash("sha256")
        .update(refreshToken)
        .digest("hex");

      await prisma.refreshToken.updateMany({
        where: {
          tokenHash,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    }

    const response = NextResponse.json({
      message: "Logged out successfully.",
    });

    response.cookies.set(ACCESS_TOKEN_COOKIE, "", {
      ...authCookieOptions,
      maxAge: 0,
    });

    response.cookies.set(REFRESH_TOKEN_COOKIE, "", {
      ...authCookieOptions,
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error("Logout error:", error);

    return NextResponse.json(
      { message: "Unable to log out." },
      { status: 500 },
    );
  }
}
