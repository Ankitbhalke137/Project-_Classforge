import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { BadRequestError, NotFoundError, handleApiError } from "@/lib/errors";
import { requireSuperAdmin } from "@/lib/platform-auth";

const updateAdminSchema = z
  .object({
    tenantId: z.string().uuid("Choose a school."),
    role: z.enum(["SCHOOL_ADMIN", "TEACHER"]).optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  })
  .refine((value) => value.role !== undefined || value.status !== undefined, {
    message: "Choose a role or a status to change.",
  });

/**
 * PATCH /api/platform/admins/:userId
 *
 * Changes one person's role or active status inside one school. The school is in
 * the body because a membership is identified by the pair (school, person).
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  try {
    await requireSuperAdmin(request);

    const { userId } = await context.params;
    const body: unknown = await request.json().catch(() => null);
    const { tenantId, role, status } = updateAdminSchema.parse(body);

    const membership = await prisma.membership.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
      include: {
        user: { select: { id: true, name: true, email: true } },
        tenant: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!membership) throw new NotFoundError("That person is not a member of this school.");

    const updated = await prisma.membership.update({
      where: { tenantId_userId: { tenantId, userId } },
      data: { role, status },
    });

    return NextResponse.json({
      userId: membership.user.id,
      tenantId: membership.tenant.id,
      name: membership.user.name,
      email: membership.user.email,
      role: updated.role,
      status: updated.status,
      schoolId: membership.tenant.id,
      schoolName: membership.tenant.name,
      schoolSlug: membership.tenant.slug,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/platform/admins/:userId?tenantId=…
 *
 * Removes one school membership. The `users` row is kept, because a Student or
 * Teacher record may point at it — without a membership the account simply has
 * no school to sign in to.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  try {
    await requireSuperAdmin(request);

    const { userId } = await context.params;
    const tenantId = request.nextUrl.searchParams.get("tenantId");
    if (!tenantId) throw new BadRequestError("A school must be specified.");

    const membership = await prisma.membership.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });
    if (!membership) throw new NotFoundError("That person is not a member of this school.");

    await prisma.membership.delete({
      where: { tenantId_userId: { tenantId, userId } },
    });

    return NextResponse.json({ removed: true });
  } catch (error) {
    return handleApiError(error);
  }
}
