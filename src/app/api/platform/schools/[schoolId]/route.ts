import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError, handleApiError } from "@/lib/errors";
import { requireSuperAdmin } from "@/lib/platform-auth";

/**
 * GET /api/platform/schools/:schoolId
 *
 * One tenant, with the same shape as the list so the platform area can refresh
 * a single row after an edit.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ schoolId: string }> },
) {
  try {
    await requireSuperAdmin(request);

    const { schoolId } = await context.params;

    const school = await prisma.tenant.findUnique({
      where: { id: schoolId },
      include: { _count: { select: { students: true, teachers: true } } },
    });
    if (!school) throw new NotFoundError("School not found.");

    return NextResponse.json({
      id: school.id,
      name: school.name,
      slug: school.slug,
      status: school.status,
      studentCount: school._count.students,
      staffCount: school._count.teachers,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

const updateSchoolSchema = z
  .object({
    name: z.string().trim().min(2, "School name is too short.").max(150).optional(),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(2, "URL slug is too short.")
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens only.")
      .optional(),
    status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  })
  .refine(
    (value) => value.name !== undefined || value.slug !== undefined || value.status !== undefined,
    { message: "Choose a name, URL slug or status to change." },
  );

/**
 * PATCH /api/platform/schools/:schoolId
 *
 * Renames a school, moves its URL slug, or suspends it. The slug is the school's
 * URL path, so it must stay unique — two schools sharing one path would make
 * every school route ambiguous.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ schoolId: string }> },
) {
  try {
    await requireSuperAdmin(request);

    const { schoolId } = await context.params;
    const body: unknown = await request.json().catch(() => null);
    const { name, slug, status } = updateSchoolSchema.parse(body);

    const existing = await prisma.tenant.findUnique({ where: { id: schoolId } });
    if (!existing) throw new NotFoundError("School not found.");

    if (slug && slug !== existing.slug) {
      const slugOwner = await prisma.tenant.findUnique({ where: { slug } });
      if (slugOwner) {
        throw new ConflictError("A school with that URL slug already exists.", {
          slug: "This URL slug is already taken.",
        });
      }
    }

    const school = await prisma.tenant.update({
      where: { id: schoolId },
      data: { name, slug, status },
      include: { _count: { select: { students: true, teachers: true } } },
    });

    return NextResponse.json({
      id: school.id,
      name: school.name,
      slug: school.slug,
      status: school.status,
      studentCount: school._count.students,
      staffCount: school._count.teachers,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/platform/schools/:schoolId
 *
 * Removes a school permanently. Cascades handle every child row — memberships,
 * students, classes and the rest all go with it.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ schoolId: string }> },
) {
  try {
    await requireSuperAdmin(request);

    const { schoolId } = await context.params;

    const existing = await prisma.tenant.findUnique({ where: { id: schoolId } });
    if (!existing) throw new NotFoundError("School not found.");

    await prisma.tenant.delete({ where: { id: schoolId } });

    return NextResponse.json({ removed: true, id: schoolId });
  } catch (error) {
    return handleApiError(error);
  }
}
