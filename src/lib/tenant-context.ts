import { NextRequest } from "next/server";
import { Prisma, MembershipRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyAccessToken } from "@/lib/auth";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth-cookies";
import { UnauthorizedError, ForbiddenError, NotFoundError } from "@/lib/errors";

export interface TenantContext {
  tenant: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
    isSuperAdmin: boolean;
  };
  membership: {
    tenantId: string;
    userId: string;
    role: MembershipRole;
    status: string;
  };
}

/**
 * Centralized query context helper.
 *
 * Opens a transaction, sets `app.current_tenant_id` for PostgreSQL Row Level
 * Security using a parameterized query (`set_config`), and executes the
 * handler queries inside it.
 */
export async function withTenant<T>(
  tenantId: string,
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
  options: { timeout?: number } = {},
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      // Sets session variable with parameter binding — behaves like SET LOCAL
      await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
      return callback(tx);
    },
    // Writes on a cold serverless connection can take longer than the 5s
    // default, and a slow transaction is rolled back with P2028.
    { timeout: options.timeout ?? 5_000 },
  );
}

/**
 * Extracts and verifies the access token from request cookies or Authorization header.
 * Returns the authenticated user record with their active school memberships.
 */
export async function authenticateRequest(request: Request | NextRequest) {
  let token: string | undefined;

  // 1. Check cookies
  if ("cookies" in request && typeof request.cookies?.get === "function") {
    token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  } else {
    const cookieHeader = request.headers.get("cookie");
    if (cookieHeader) {
      const match = cookieHeader
        .split(";")
        .map((c) => c.trim())
        .find((c) => c.startsWith(`${ACCESS_TOKEN_COOKIE}=`));
      if (match) {
        token = match.substring(ACCESS_TOKEN_COOKIE.length + 1);
      }
    }
  }

  // 2. Check Authorization Bearer header
  if (!token) {
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    }
  }

  if (!token) {
    throw new UnauthorizedError("Authentication required.");
  }

  const payload = await verifyAccessToken(token);
  if (!payload) {
    throw new UnauthorizedError("Invalid or expired access token.");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: {
      memberships: {
        where: { status: "ACTIVE" },
        include: {
          tenant: true,
        },
      },
    },
  });

  if (!user) {
    throw new UnauthorizedError("User not found.");
  }

  return user;
}

/**
 * Validates authentication and confirms active school membership for tenant-scoped endpoints.
 *
 * - No session returns 401.
 * - Non-existent school returns 404.
 * - Valid session without active membership in that school returns 403.
 * - Disallowed role returns 403.
 * - Super Admin has no implicit access to student data without school membership.
 */
export async function resolveTenantContext(
  request: Request | NextRequest,
  tenantSlug: string,
  allowedRoles?: MembershipRole[],
): Promise<TenantContext> {
  const user = await authenticateRequest(request);

  // 1. Find tenant by slug
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
  });

  if (!tenant) {
    throw new NotFoundError("School not found.");
  }

  if (tenant.status !== "ACTIVE") {
    throw new ForbiddenError("This school is currently suspended.");
  }

  // 2. Find user's active membership in this specific school
  const membership = user.memberships.find((m) => m.tenantId === tenant.id);

  // Strict tenant isolation: Super Admin manages schools but has no implicit access to student data.
  // A valid session without membership in this school returns 403.
  if (!membership) {
    throw new ForbiddenError("You do not have access to this school.");
  }

  // 3. Verify role authorization if specified
  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(membership.role)) {
      throw new ForbiddenError("You do not have permission to perform this action.");
    }
  }

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
    },
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      isSuperAdmin: user.platformRole === "SUPER_ADMIN",
    },
    membership: {
      tenantId: membership.tenantId,
      userId: membership.userId,
      role: membership.role,
      status: membership.status,
    },
  };
}
