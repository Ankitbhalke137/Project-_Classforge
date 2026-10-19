import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";

/**
 * GET /api/t/:tenantSlug/exams?page=1&search=
 *
 * Reads the `exams` table joined to its subject. The table has no term,
 * pass-marks or teacher column, so those come back empty.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ tenantSlug: string }> }) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug);

    const search = (request.nextUrl.searchParams.get("search") ?? "").toLowerCase();
    const page = Math.max(Number(request.nextUrl.searchParams.get("page") ?? 1) || 1, 1);
    const pageSize = 10;

    const where = {
      tenantId: tenant.id,
      ...(search
        ? { OR: [{ name: { contains: search } }, { subject: { name: { contains: search } } }] }
        : {}),
    };

    const [total, exams] = await Promise.all([
      prisma.exam.count({ where }),
      prisma.exam.findMany({
        where,
        include: { subject: { select: { name: true } } },
        orderBy: { examDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      data: exams.map((exam) => ({
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
      })),
      total,
      page,
      pageSize,
    });
  } catch (error) {
    return handleApiError(error);
  }
}