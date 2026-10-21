import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAccessToken } from "@/lib/auth";
import {
    ACCESS_TOKEN_COOKIE,
    REFRESH_TOKEN_COOKIE,
    ACCESS_TOKEN_MAX_AGE,
    REFRESH_TOKEN_MAX_AGE,
    authCookieOptions
} from "@/lib/auth-cookies";
import { createStoredRefreshToken, consumeRefreshToken } from "@/lib/refresh-tokens";

/**
 * Trades the refresh cookie for a new access token.
 *
 * The old refresh token is deleted as it is used, so it works exactly once. If it
 * is missing or already spent we clear both cookies and send the caller back to
 * the login screen.
 */
export async function POST(request: Request) {
    const token = request.headers
        .get("cookie")
        ?.split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${REFRESH_TOKEN_COOKIE}=`))
        ?.slice(REFRESH_TOKEN_COOKIE.length + 1);

    if(!token) return expired();

    const used = await consumeRefreshToken(token);
    if(!used) return expired();

    const user = await prisma.user.findUnique({ where:{ id: used.userId }});
    if(!user) return expired();

    // Keep the same family so a chain of refreshes stays traceable to one login.
    const { token: refreshToken } = await createStoredRefreshToken(user.id, used.familyId);
    const accessToken = await createAccessToken({ userId: user.id, email: user.email });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, { ...authCookieOptions, maxAge: ACCESS_TOKEN_MAX_AGE });
    response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, { ...authCookieOptions, maxAge: REFRESH_TOKEN_MAX_AGE });

    return response;
}

/** No usable refresh token: drop both cookies so the client stops retrying. */
function expired() {
    const response = NextResponse.json(
        { message: "Your session has expired. Please sign in again." },
        { status: 401 }
    );
    response.cookies.set(ACCESS_TOKEN_COOKIE, "", { ...authCookieOptions, maxAge: 0 });
    response.cookies.set(REFRESH_TOKEN_COOKIE, "", { ...authCookieOptions, maxAge: 0 });
    return response;
}