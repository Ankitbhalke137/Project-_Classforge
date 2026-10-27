import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext, withTenant } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";

/**
 * GET /api/t/:tenantSlug/attendance/trend?days=14
 *
 * One point per school day, oldest first. Weekends are skipped because no
 * register is ever marked on them. Days with no marks are omitted rather than
 * plotted as 0%, which would read as "everybody was absent".
 */
export async function GET(request: NextRequest, context: { params: Promise<{ tenantSlug: string }> }) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, ["SCHOOL_ADMIN", "TEACHER"]);

    const days = Math.min(Number(request.nextUrl.searchParams.get("days") ?? 14) || 14, 90);
    const today = new Date();
    const since = new Date(today);
    since.setDate(since.getDate() - days);

    const records = await withTenant(tenant.id, async (tx) => {
      return tx.attendanceRecord.findMany({
        where: { tenantId: tenant.id, attendanceDate: { gte: since } },
        select: { attendanceDate: true, status: true },
      });
    });

    const byDay = new Map<string, { present: number; total: number }>();
    for (const record of records) {
      const key = record.attendanceDate.toISOString().slice(0, 10);
      const entry = byDay.get(key) ?? { present: 0, total: 0 };
      entry.total += 1;
      if (record.status === "PRESENT" || record.status === "LATE") entry.present += 1;
      byDay.set(key, entry);
    }

    const data = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, entry]) => ({
        date,
        percentage: entry.total === 0 ? 0 : Math.round((entry.present / entry.total) * 100),
        marked: entry.total,
      }));

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}