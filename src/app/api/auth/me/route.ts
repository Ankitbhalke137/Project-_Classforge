
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  authCookieOptions,
} from "@/lib/auth-cookies";

export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

    if (!accessToken) {
      return NextResponse.json(
        { message: "Authentication required." },
        { status: 401 },
      );
    }

    const payload = await verifyAccessToken(accessToken);

    if (!payload) {
      return NextResponse.json(
        { message: "Invalid or expired access token." },
        { status: 401 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        name: true,
        email: true,
        platformRole: true,
        memberships: {
          where: { status: "ACTIVE" },
          select: {
            role: true,
            tenant: {
              select: {
                id: true,
                name: true,
                slug: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { message: "User not found." },
        { status: 401 },
      );
    }

    const schools = user.memberships
      .filter((membership) => membership.tenant.status === "ACTIVE")
      .map((membership) => ({
        schoolId: membership.tenant.id,
        schoolSlug: membership.tenant.slug,
        schoolName: membership.tenant.name,
        role: membership.role,
      }));

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isSuperAdmin: user.platformRole === "SUPER_ADMIN",
      },
      schools,
    });
  } catch (error) {
    console.error("Get current user error:", error);

    return NextResponse.json(
      { message: "Unable to retrieve current user." },
      { status: 500 },
    );
  }
}
