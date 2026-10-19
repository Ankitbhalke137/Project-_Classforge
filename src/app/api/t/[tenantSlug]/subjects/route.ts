import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";

/**
 * GET /api/t/:tenantSlug/subjects
 *
 * Reads the `subjects` table. The table has no grade or max-marks column, so
 * those come back as empty values rather than guessed ones.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ tenantSlug: string }> }) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
      "TEACHER",
      "STUDENT",
    ]);

    const subjects = await prisma.subject.findMany({
      where: { tenantId: tenant.id },
      orderBy: { name: "asc" },
    });

    const data = subjects.map((subject) => ({
      id: subject.id,
      name: subject.name,
      code: subject.code ?? "",
      // No column behind these yet.
      grades: [] as string[],
      maxMarks: 0,
    }));

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}