import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext, withTenant } from "@/lib/tenant-context";
import { handleApiError, NotFoundError, ConflictError } from "@/lib/errors";

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
      include: { schoolClass: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    });

    const data = subjects.map((subject) => ({
      id: subject.id,
      name: subject.name,
      code: subject.code ?? "",
      classId: subject.classId,
      className: subject.schoolClass?.name ?? "",
      grades: [] as string[],
      maxMarks: 0,
    }));

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}

const createSubjectSchema = z.object({
  name: z.string().trim().min(1, "Subject name is required.").max(100),
  classId: z.string().uuid("Valid classId is required."),
  code: z.string().trim().max(30).optional().nullable(),
});

/**
 * POST /api/t/:tenantSlug/subjects
 * Creates a new subject for a class.
 * SCHOOL_ADMIN only.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, ["SCHOOL_ADMIN"]);

    const body = createSubjectSchema.parse(await request.json().catch(() => ({})));

    const created = await withTenant(tenant.id, async (tx) => {
      const schoolClass = await tx.schoolClass.findFirst({
        where: { id: body.classId, tenantId: tenant.id },
      });
      if (!schoolClass) {
        throw new NotFoundError("Class not found in this school.");
      }

      const existing = await tx.subject.findFirst({
        where: { tenantId: tenant.id, classId: body.classId, name: body.name },
      });
      if (existing) {
        throw new ConflictError("A subject with this name already exists in this class.", {
          name: "Subject name already taken in this class.",
        });
      }

      return tx.subject.create({
        data: {
          tenantId: tenant.id,
          classId: body.classId,
          name: body.name,
          code: body.code ?? null,
        },
      });
    });

    return NextResponse.json(
      {
        id: created.id,
        name: created.name,
        code: created.code ?? "",
        classId: created.classId,
        grades: [],
        maxMarks: 0,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}