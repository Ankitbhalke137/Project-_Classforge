import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError, handleApiError } from "@/lib/errors";
import { requireSuperAdmin } from "@/lib/platform-auth";

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
 * GET /api/platform/schools/:schoolId
 *
 * Retrieves details of a single school for Super Admin.
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
      include: {
        _count: { select: { students: true, teachers: true, classes: true } },
      },
    });

    if (!school) {
      throw new NotFoundError("School not found.");
    }

    return NextResponse.json({
      id: school.id,
      name: school.name,
      slug: school.slug,
      status: school.status,
      studentCount: school._count.students,
      staffCount: school._count.teachers,
      classCount: school._count.classes,
      createdAt: school.createdAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/platform/schools/:schoolId
 *
 * Renames a school, changes its URL slug, or suspends and reactivates it.
 *
 * The slug is the school's URL path, so it has to stay unique — two schools on
 * one path would make every school route ambiguous.
 *
 * Suspending a school does not delete anything. Its members keep their accounts
 * and their data; they simply get 403 on every school route until the school is
 * reactivated.
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

    const school = await prisma.tenant.findUnique({ where: { id: schoolId } });
    if (!school) throw new NotFoundError("School not found.");

    if (slug && slug !== school.slug) {
      const taken = await prisma.tenant.findUnique({ where: { slug } });
      if (taken) {
        throw new ConflictError("A school with that URL slug already exists.", {
          slug: "This URL slug is already taken.",
        });
      }
    }

    const updated = await prisma.tenant.update({
      where: { id: schoolId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(slug !== undefined ? { slug } : {}),
        ...(status !== undefined ? { status } : {}),
      },
      include: { _count: { select: { students: true, teachers: true } } },
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      status: updated.status,
      studentCount: updated._count.students,
      staffCount: updated._count.teachers,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/platform/schools/:schoolId
 *
 * Removes a school and everything inside it. Students, teachers, classes, marks
 * and enrolments go with it — a student record cannot outlive its school.
 *
 * Two guards keep this from being a one-click mistake:
 *   1. The school must already be SUSPENDED. Delete an active school by
 *      accident and the next thing you know is a school has vanished mid-term.
 *   2. A school that still has students or teachers is refused unless
 *      `?force=true` is passed, which is a deliberate second decision.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ schoolId: string }> },
) {
  try {
    await requireSuperAdmin(request);

    const { schoolId } = await context.params;
    const force = request.nextUrl.searchParams.get("force") === "true";

    const school = await prisma.tenant.findUnique({
      where: { id: schoolId },
      include: {
        _count: { select: { students: true, teachers: true, memberships: true } },
      },
    });
    if (!school) throw new NotFoundError("School not found.");

    if (school.status !== "SUSPENDED") {
      throw new ConflictError(
        "Suspend the school before deleting it.",
        { status: "This school is still active. Suspend it first." },
      );
    }

    // Staff added through the platform console are memberships, not rows in the
    // `teachers` table, so memberships have to be counted too. Otherwise a
    // school full of admins would delete without a word.
    const people =
      school._count.students + school._count.teachers + school._count.memberships;

    if (!force && people > 0) {
      throw new ConflictError(
        "This school still has people in it.",
        {
          status: `Remove its ${school._count.memberships} staff members, ${school._count.students} students and ${school._count.teachers} teachers first, or delete with force.`,
        },
      );
    }

    // Deleting the tenant cascades to its students, teachers, classes, sections,
    // subjects, enrolments, attendance, exams, marks and announcements.
    await prisma.tenant.delete({ where: { id: schoolId } });

    return NextResponse.json({ removed: true, id: schoolId });
  } catch (error) {
    return handleApiError(error);
  }
}
