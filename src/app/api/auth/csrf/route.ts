import { NextRequest, NextResponse } from "next/server";
import { generateCsrfToken, setCsrfCookie } from "@/lib/csrf";
import { verifyAccessToken } from "@/lib/auth";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth-cookies";

/**
 * GET /api/auth/csrf
 *
 * Provides a fresh cryptographically signed CSRF token.
 * If the user is currently authenticated via access_token cookie, the token
 * is bound to their user ID to prevent cross-session token reuse.
 * Also sets the non-HttpOnly `csrf_token` cookie for double-submit header submission.
 */
export async function GET(request: NextRequest) {
  let binding = "anon";

  // Check if an existing session cookie is present
  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (token) {
    const payload = await verifyAccessToken(token);
    if (payload?.userId) {
      binding = payload.userId;
    }
  }

  const csrfToken = generateCsrfToken(binding);
  const response = NextResponse.json({ csrfToken });
  setCsrfCookie(response, csrfToken);

  return response;
}
