import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveTenantContext, withTenant } from "@/lib/tenant-context";
import { handleApiError, ConflictError } from "@/lib/errors";

const createAcademicYearSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(50),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be YYYY-MM-DD."),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be YYYY-MM-DD."),
  status: z.enum(["UPCOMING", "ACTIVE", "COMPLETED"]).optional().default("UPCOMING"),
});

/**
 * GET /api/t/:tenantSlug/academic-years
 * Lists all academic years for the school.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
      "TEACHER",
      "STUDENT",
    ]);

    const academicYears = await withTenant(tenant.id, async (tx) => {
      return tx.academicYear.findMany({
        where: { tenantId: tenant.id },
        include: {
          _count: { select: { classes: true, terms: true } },
        },
        orderBy: { startDate: "desc" },
      });
    });

    return NextResponse.json(
      academicYears.map((ay) => ({
        id: ay.id,
        name: ay.name,
        startDate: ay.startDate.toISOString().slice(0, 10),
        endDate: ay.endDate.toISOString().slice(0, 10),
        status: ay.status,
        classCount: ay._count.classes,
        termCount: ay._count.terms,
        createdAt: ay.createdAt.toISOString(),
      })),
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/t/:tenantSlug/academic-years
 * Creates an academic year for the school.
 * SCHOOL_ADMIN only.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, ["SCHOOL_ADMIN"]);

    const body = createAcademicYearSchema.parse(await request.json().catch(() => ({})));

    const created = await withTenant(tenant.id, async (tx) => {
      const existing = await tx.academicYear.findFirst({
        where: { tenantId: tenant.id, name: body.name },
      });
      if (existing) {
        throw new ConflictError("An academic year with this name already exists.", {
          name: "Academic year name already taken.",
        });
      }

      return tx.academicYear.create({
        data: {
          tenantId: tenant.id,
          name: body.name,
          startDate: new Date(`${body.startDate}T00:00:00.000Z`),
          endDate: new Date(`${body.endDate}T00:00:00.000Z`),
          status: body.status,
        },
      });
    });

    return NextResponse.json(
      {
        id: created.id,
        name: created.name,
        startDate: created.startDate.toISOString().slice(0, 10),
        endDate: created.endDate.toISOString().slice(0, 10),
        status: created.status,
        createdAt: created.createdAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
