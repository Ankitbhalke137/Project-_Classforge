import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";
import { BadRequestError } from "@/lib/errors";

/**
 * GET /api/t/:tenantSlug/attendance?date=YYYY-MM-DD
 *
 * One row per section for a single school day. A section nobody marked simply
 * does not appear, so the day sheet reads as empty rather than as zero-marked.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ tenantSlug: string }> }) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, ["SCHOOL_ADMIN", "TEACHER"]);

    const raw = request.nextUrl.searchParams.get("date");
    if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      throw new BadRequestError("Provide a date as YYYY-MM-DD.");
    }

    const day = new Date(`${raw}T00:00:00`);

    const records = await prisma.attendanceRecord.findMany({
      where: { tenantId: tenant.id, attendanceDate: day },
      include: { section: { select: { id: true, name: true, classId: true } } },
    });

    // Group the flat records into one summary per section.
    const bySection = new Map<string, { className: string; total: number; present: number; absent: number; late: number; excused: number }>();

    for (const record of records) {
      const entry = bySection.get(record.sectionId) ?? {
        className: record.section.name,
        total: 0,
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
      };
      entry.total += 1;
      if (record.status === "PRESENT") entry.present += 1;
      else if (record.status === "LATE") entry.late += 1;
      else if (record.status === "ABSENT") entry.absent += 1;
      else entry.excused += 1;
      bySection.set(record.sectionId, entry);
    }

    const data = [...bySection.entries()].map(([sectionId, entry]) => ({
      classId: sectionId,
      className: entry.className,
      date: raw,
      total: entry.total,
      present: entry.present + entry.late,
      absent: entry.absent,
      late: entry.late,
      excused: entry.excused,
      // Late counts as attended, matching the rest of the product.
      percentage: entry.total === 0 ? 0 : Math.round(((entry.present + entry.late) / entry.total) * 100),
    }));

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}