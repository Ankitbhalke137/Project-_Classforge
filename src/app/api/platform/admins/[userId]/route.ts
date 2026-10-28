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

    const membership = await prisma.membership.findFirst({
      where: { tenantId, userId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        tenant: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!membership) throw new NotFoundError("That person is not a member of this school.");

    const updated = await prisma.membership.update({
      where: { tenantId_userId_role: { tenantId, userId, role: membership.role } },
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
 * Fully removes the user from the database so they can no longer log in
 * anywhere. Deletes the user account, all memberships, refresh tokens, and
 * linked student/teacher/attendance/announcement records across every school.
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

    // Confirm the user has membership in this school
    const membership = await prisma.membership.findFirst({
      where: { tenantId, userId },
      include: { user: { select: { id: true, platformRole: true } } },
    });
    if (!membership) throw new NotFoundError("That person is not a member of this school.");

    // Protect the last Super Admin from being deleted
    if (membership.user.platformRole === "SUPER_ADMIN") {
      const superAdminCount = await prisma.user.count({
        where: { platformRole: "SUPER_ADMIN" },
      });
      if (superAdminCount <= 1) {
        throw new BadRequestError(
          "Cannot delete the last Super Admin. At least one must remain.",
        );
      }
    }

    // Full deletion: remove the user entirely so they cannot log in anywhere
    // Delete related records in dependency order (child records first)
    await prisma.refreshToken.deleteMany({ where: { userId } });
    await prisma.membership.deleteMany({ where: { userId } });
    await prisma.student.deleteMany({ where: { userId } });
    await prisma.teacher.deleteMany({ where: { userId } });
    await prisma.attendanceRecord.deleteMany({ where: { markedBy: userId } });
    await prisma.announcement.deleteMany({ where: { createdBy: userId } });
    await prisma.mark.updateMany({
      where: { gradedBy: userId },
      data: { gradedBy: null },
    });

    // Delete the user account
    await prisma.user.delete({ where: { id: userId } });

    return NextResponse.json({ removed: true, deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
