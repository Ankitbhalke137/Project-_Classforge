import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/errors";
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