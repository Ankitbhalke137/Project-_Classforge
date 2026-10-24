import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant-context";
import { ForbiddenError, BadRequestError, handleApiError } from "@/lib/errors";

const updateProfileSchema = z.object({
  schoolName: z.string().trim().min(2, "School name is too short.").max(150),
  schoolSlug: z.string().trim().min(2).max(100).optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().max(50).optional().or(z.literal("")),
  address: z.string().max(300).optional().or(z.literal("")),
});

/**
 * GET /api/t/:tenantSlug/profile
 *
 * Retrieves the basic profile details of this school.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug);

    return NextResponse.json({
      schoolName: tenant.name,
      schoolSlug: tenant.slug,
      status: tenant.status,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/t/:tenantSlug/profile
 *
 * Updates the school profile. Restricted to School Admins and Super Admins.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant, user, membership } = await resolveTenantContext(request, tenantSlug);

    if (membership.role !== "SCHOOL_ADMIN" && !user.isSuperAdmin) {
      throw new ForbiddenError("Only school administrators can update school settings.");
    }

    const rawBody: unknown = await request.json().catch(() => null);
    const parsed = updateProfileSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new BadRequestError("Invalid school profile payload.");
    }

    const { schoolName } = parsed.data;

    const updated = await prisma.tenant.update({
      where: { id: tenant.id },
      data: { name: schoolName },
    });

    return NextResponse.json({
      schoolName: updated.name,
      schoolSlug: updated.slug,
      status: updated.status,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
