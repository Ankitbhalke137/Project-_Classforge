import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";
import { createClass, listClasses } from "@/lib/services/academic-service";

interface RouteContext {
  params: Promise<{ tenantSlug: string }>;
}

const READ_ROLES = ["SCHOOL_ADMIN", "TEACHER", "STUDENT"] as const;

/**
 * GET /api/t/:tenantSlug/classes
 *
 * One row per section, because a section is what a roster, a register and a
 * timetable attach to. A class with no sections still appears, using the class
 * id, so it does not vanish from the screen.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, [...READ_ROLES]);

    let rows = await listClasses(tenant.id);
    const grade = request.nextUrl.searchParams.get("grade");
    const search = request.nextUrl.searchParams.get("search")?.trim().toLowerCase();

    if (grade) rows = rows.filter((row) => row.grade === grade);
    if (search) {
      rows = rows.filter(
        (row) =>
          row.name.toLowerCase().includes(search) ||
          row.room.toLowerCase().includes(search) ||
          row.grade.toLowerCase().includes(search),
      );
    }

    return NextResponse.json(rows);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, ["SCHOOL_ADMIN"]);
    const body: unknown = await request.json().catch(() => null);
    return NextResponse.json(await createClass(tenant.id, body), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
