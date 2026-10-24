import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";
import { getMyResults } from "@/lib/services/exam-service";

/**
 * GET /api/t/:tenantSlug/me/results
 *
 * Published results for the signed-in student or parent's child.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant, user, membership } = await resolveTenantContext(request, tenantSlug, [
      "STUDENT",
      "PARENT",
    ]);

    if (membership.role === "PARENT" || membership.role.toString() === "PARENT") {
      // Find the student linked to this parent
      const child = await prisma.student.findFirst({
        where: {
          tenantId: tenant.id,
          OR: [
            { guardianName: { contains: user.name, mode: "insensitive" } },
            { userId: user.id },
          ],
        },
        select: { userId: true, id: true },
      });
      if (child?.userId) {
        return NextResponse.json(await getMyResults(tenant.id, child.userId));
      }
      return NextResponse.json({ student: null, results: [], summary: { totalExams: 0, averageScore: null, bestGrade: "—" } });
    }

    return NextResponse.json(await getMyResults(tenant.id, user.id));
  } catch (error) {
    return handleApiError(error);
  }
}
