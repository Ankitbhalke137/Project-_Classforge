import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/no-access", "/reset-password"];

/**
 * Server-side redirect for signed-out users, checked before any page renders.
 *
 * The backend sets an httpOnly cookie on sign-in, so this is the first gate: no
 * protected screen ever flashes before the login page. The client-side guards in
 * `components/auth/guards.tsx` then keep the session in step.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  if (isPublic || request.cookies.get("access_token")) {
    return NextResponse.next();
  }

  if (pathname === "/") return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)",
  ],
};