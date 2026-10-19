import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
    ACCESS_TOKEN_COOKIE,
    REFRESH_TOKEN_COOKIE,
    authCookieOptions
} from "@/lib/auth-cookies";
import { hashRefreshToken } from "@/lib/refresh-tokens";

/**
 * Signs the user out.
 *
 * Deletes just the refresh token that was presented, then clears both cookies.
 * Other devices stay signed in, which is what "sign out here" should mean.
 */
export async function POST(request: Request) {
    const token = request.headers
        .get("cookie")
        ?.split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${REFRESH_TOKEN_COOKIE}=`))
        ?.slice(REFRESH_TOKEN_COOKIE.length + 1);

    if(token) {
        await prisma.refreshToken.deleteMany({ where:{ tokenHash: hashRefreshToken(token) }});
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(ACCESS_TOKEN_COOKIE, "", { ...authCookieOptions, maxAge: 0 });
    response.cookies.set(REFRESH_TOKEN_COOKIE, "", { ...authCookieOptions, maxAge: 0 });

    return response;
}