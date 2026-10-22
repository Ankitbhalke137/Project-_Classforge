import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext, withTenant } from "@/lib/tenant-context";
import { handleApiError, NotFoundError } from "@/lib/errors";

type Context = {
  params: Promise<{ tenantSlug: string; id: string }>;
};

/**
 * POST /api/t/:tenantSlug/exams/:id/publish
 * Publishes an exam by marking its status as COMPLETED.
 * SCHOOL_ADMIN only.
 */
export async function POST(request: NextRequest, context: Context) {
  try {
    const { tenantSlug, id } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, ["SCHOOL_ADMIN"]);

    const exam = await withTenant(tenant.id, async (tx) => {
      const existing = await tx.exam.findFirst({
        where: { id, tenantId: tenant.id },
        include: {
          subject: { select: { name: true } },
          section: { select: { id: true, name: true } },
        },
      });

      if (!existing) {
        throw new NotFoundError("Exam not found.");
      }

      return tx.exam.update({
        where: { id },
        data: { status: "COMPLETED" },
        include: {
          subject: { select: { name: true } },
          section: { select: { id: true, name: true } },
        },
      });
    });

    return NextResponse.json({
      id: exam.id,
      name: `${exam.subject.name} — ${exam.name}`,
      term: "",
      classId: exam.sectionId,
      subjectId: exam.subjectId,
      teacherId: "",
      date: exam.examDate.toISOString(),
      maxMarks: exam.maxMarks,
      passMarks: 0,
      status: exam.status,
      publishedAt: exam.createdAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
