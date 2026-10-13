
import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth-cookies";

export async function requireAuth(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!accessToken) {
    return {
      user: null,
      response: NextResponse.json(
        { message: "Authentication required." },
        { status: 401 },
      ),
    };
  }

  const user = await verifyAccessToken(accessToken);

  if (!user) {
    return {
      user: null,
      response: NextResponse.json(
        { message: "Invalid or expired access token." },
        { status: 401 },
      ),
    };
  }

  return {
    user,
    response: null,
  };
}
