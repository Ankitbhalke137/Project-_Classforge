import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/no-access"];

/**
 * Server-side redirect for signed-out users, checked before any page renders.
 *
 * While the mock API is on there is no cookie yet (the demo keeps the session
 * in sessionStorage), so the guards in `components/auth/guards.tsx` do the
 * redirect instead. Once the real backend sets its HTTP-only cookie this takes
 * over and no protected screen flashes before the login page.
 */
export function proxy(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_ENABLE_MOCKS !== "false") return NextResponse.next();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  if (isPublic || request.cookies.get("cf_access_token")) {
    return NextResponse.next();
  }

  if (pathname === "/") return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|mockServiceWorker.js|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)",
  ],
};