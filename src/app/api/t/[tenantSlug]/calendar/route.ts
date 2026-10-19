import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";
import { readSchoolCalendar, breaksBetweenPeriods } from "@/lib/school-calendar";

/**
 * GET /api/t/:tenantSlug/calendar
 *
 * This school's academic year, its terms and its timetable. Every school keeps
 * its own, so the calendar is read from the database rather than assumed.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug);

    const calendar = await readSchoolCalendar(tenant.id);

    return NextResponse.json({
      ...calendar,
      breaks: breaksBetweenPeriods(calendar.periods),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
