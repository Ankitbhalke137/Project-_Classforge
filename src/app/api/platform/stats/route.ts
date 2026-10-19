import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/errors";
import { requireSuperAdmin } from "@/lib/platform-auth";

/**
 * GET /api/platform/stats
 *
 * Cross-tenant counters. Counts only — no school's roster is ever returned here.
 */
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);

    const [schoolCount, active, suspended, students, teachers] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { status: "ACTIVE" } }),
      prisma.tenant.count({ where: { status: "SUSPENDED" } }),
      prisma.student.count(),
      prisma.teacher.count(),
    ]);

    return NextResponse.json({
      schoolCount,
      activeSchoolCount: active,
      suspendedSchoolCount: suspended,
      totalStudents: students,
      totalTeachers: teachers,
      // Seats on the current plan. Set by the platform, not fixed in the code.
      tenantLimit: Number(process.env.PLATFORM_TENANT_LIMIT ?? 25),
    });
  } catch (error) {
    return handleApiError(error);
  }
}