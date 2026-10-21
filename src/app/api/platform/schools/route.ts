import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ConflictError, handleApiError } from "@/lib/errors";
import { requireSuperAdmin } from "@/lib/platform-auth";

/**
 * GET /api/platform/schools
 *
 * The Super Admin's list of every tenant. Reads the `tenants` table and counts
 * its students and teachers.
 */
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);

    const schools = await prisma.tenant.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { students: true, teachers: true } } },
    });

    return NextResponse.json(
      schools.map((school) => ({
        id: school.id,
        name: school.name,
        slug: school.slug,
        status: school.status,
        studentCount: school._count.students,
        staffCount: school._count.teachers,
      })),
    );
  } catch (error) {
    return handleApiError(error);
  }
}

const createSchoolSchema = z.object({
  name: z.string().trim().min(2, "School name is too short.").max(150),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "URL slug is too short.")
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens only."),
});

/**
 * POST /api/platform/schools
 *
 * Creates a tenant. The slug is the school's URL path, so it must stay unique —
 * two schools sharing one path would make every school route ambiguous.
 */
export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin(request);

    const body: unknown = await request.json().catch(() => null);
    const { name, slug } = createSchoolSchema.parse(body);

    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictError("A school with that URL slug already exists.", {
        slug: "This URL slug is already taken.",
      });
    }

    const school = await prisma.tenant.create({
      data: { name, slug },
      include: { _count: { select: { students: true, teachers: true } } },
    });

    return NextResponse.json(
      {
        id: school.id,
        name: school.name,
        slug: school.slug,
        status: school.status,
        studentCount: school._count.students,
        staffCount: school._count.teachers,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
