
import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext, withTenant } from "@/lib/tenant-context";
import { handleApiError, NotFoundError } from "@/lib/errors";

interface RouteContext {
  params: Promise<{ tenantSlug: string }>;
}

/**
 * GET /api/t/:tenantSlug/classes
 * Fetches classes, academic years and sections for the current tenant.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { tenantSlug } = await context.params;

    const { tenant } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
      "TEACHER",
      "STUDENT",
    ]);

    const classes = await withTenant(tenant.id, async (tx) => {
      return tx.schoolClass.findMany({
        where: { tenantId: tenant.id },
        orderBy: { name: "asc" },
        include: {
          academicYear: {
            select: { id: true, name: true, status: true },
          },
          sections: {
            orderBy: { name: "asc" },
            select: { id: true, name: true },
          },
        },
      });
    });

    const data = classes.flatMap((schoolClass) => {
      const sections = schoolClass.sections.length
        ? schoolClass.sections
        : [{ id: schoolClass.id, name: "" }];

      return sections.map((section) => ({
        id: section.id,
        name: section.name
          ? `${schoolClass.name} - ${section.name}`
          : schoolClass.name,
        grade: schoolClass.name,
        section: section.name,
        room: "",
        homeroomTeacherId: null,
        subjectIds: [] as string[],
        studentCount: 0,
        capacity: 0,
      }));
    });

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/t/:tenantSlug/classes
 * Creates a class for the current school.
 * SCHOOL_ADMIN only.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { tenantSlug } = await context.params;

    const { tenant } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
    ]);

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const academicYearId = body.academicYearId;

    if (!name || typeof academicYearId !== "string" || !academicYearId) {
      return NextResponse.json(
        { message: "name and academicYearId are required." },
        { status: 400 },
      );
    }

    const created = await withTenant(tenant.id, async (tx) => {
      const year = await tx.academicYear.findFirst({
        where: {
          id: academicYearId,
          tenantId: tenant.id,
        },
      });

      if (!year) {
        throw new NotFoundError("Academic year not found.");
      }

      return tx.schoolClass.create({
        data: {
          name,
          academicYearId,
          tenantId: tenant.id,
        },
      });
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}