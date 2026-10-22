import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext, withTenant } from "@/lib/tenant-context";
import { handleApiError, NotFoundError } from "@/lib/errors";

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

const createExamSchema = z.object({
  name: z.string().trim().min(1, "Exam name is required.").max(100),
  sectionId: z.string().uuid("Valid sectionId is required."),
  subjectId: z.string().uuid("Valid subjectId is required."),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Exam date must be YYYY-MM-DD."),
  maxMarks: z.number().int().positive().max(100000),
});

/**
 * POST /api/t/:tenantSlug/exams
 * Creates a scheduled exam for a section and subject.
 * SCHOOL_ADMIN only.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, ["SCHOOL_ADMIN"]);

    const body = createExamSchema.parse(await request.json().catch(() => ({})));

    const exam = await withTenant(tenant.id, async (tx) => {
      const [section, subject] = await Promise.all([
        tx.section.findFirst({
          where: { id: body.sectionId, tenantId: tenant.id },
          select: { id: true, classId: true, name: true },
        }),
        tx.subject.findFirst({
          where: { id: body.subjectId, tenantId: tenant.id },
          select: { id: true, classId: true, name: true },
        }),
      ]);

      if (!section) {
        throw new NotFoundError("Section not found in this school.");
      }
      if (!subject) {
        throw new NotFoundError("Subject not found in this school.");
      }

      if (section.classId !== subject.classId) {
        throw new NotFoundError("Subject does not belong to this section's class.");
      }

      return tx.exam.create({
        data: {
          tenantId: tenant.id,
          sectionId: body.sectionId,
          subjectId: body.subjectId,
          name: body.name,
          examDate: new Date(`${body.examDate}T00:00:00.000Z`),
          maxMarks: body.maxMarks,
          status: "SCHEDULED",
        },
        include: {
          section: { select: { id: true, name: true } },
          subject: { select: { id: true, name: true } },
        },
      });
    });

    return NextResponse.json(
      {
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
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}