import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth-cookies";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors";
import { assertCsrfProtection, isSafeMethod } from "@/lib/csrf";

/**
 * Throws unless the caller is a platform Super Admin.
 *
 * The Super Admin sits outside every tenant, so there is no membership to check —
 * their platform role on the `users` row is the authority.
 *
 * Enforces CSRF token and origin validation for state-changing operations.
 */
export async function requireSuperAdmin(request: NextRequest): Promise<void> {
  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) throw new UnauthorizedError();

  const payload = await verifyAccessToken(token);
  if (!payload) throw new UnauthorizedError("Invalid or expired access token.");

  if (!isSafeMethod(request.method ?? "GET")) {
    const csrfCheck = assertCsrfProtection(request, {
      expectedUserId: payload.userId,
    });
    if (!csrfCheck.allowed) {
      throw new ForbiddenError(csrfCheck.reason ?? "CSRF token validation failed.");
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { platformRole: true },
  });

  if (user?.platformRole !== "SUPER_ADMIN") {
    throw new ForbiddenError("Only a Super Admin may open the platform area.");
  }
}