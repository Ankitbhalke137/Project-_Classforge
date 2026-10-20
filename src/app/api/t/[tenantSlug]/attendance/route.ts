import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";
import { BadRequestError } from "@/lib/errors";

/** Date-only columns are read and written at UTC midnight so they never shift. */
function parseDay(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

const markSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  classId: z.string().uuid("Choose a class"),
  records: z
    .array(
      z.object({
        studentId: z.string().uuid(),
        status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
      }),
    )
    .min(1, "There is nobody to mark.")
    .max(500),
});

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

    const day = parseDay(raw);

    const records = await prisma.attendanceRecord.findMany({
      where: { tenantId: tenant.id, attendanceDate: day },
      include: {
        section: {
          select: {
            id: true,
            name: true,
            classId: true,
            schoolClass: { select: { name: true } },
          },
        },
      },
    });

    // Group the flat records into one summary per section.
    const bySection = new Map<string, { className: string; total: number; present: number; absent: number; late: number; excused: number }>();

    for (const record of records) {
      const entry = bySection.get(record.sectionId) ?? {
        className: `${record.section.schoolClass.name} - ${record.section.name}`,
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

/**
 * POST /api/t/:tenantSlug/attendance
 *
 * Saves one section's register for one day. A re-save updates the same rows
 * instead of adding duplicates, which is what a teacher correcting a mistake
 * expects.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant, membership } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
      "TEACHER",
    ]);

    const parsed = markSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new BadRequestError(
        parsed.error.issues[0]?.message ?? "Check the register and try again.",
      );
    }
    const input = parsed.data;
    const day = parseDay(input.date);

    const section = await prisma.section.findFirst({
      where: { id: input.classId, tenantId: tenant.id },
      select: { id: true },
    });
    if (!section) throw new BadRequestError("That class was not found in this school.");

    const enrolments = await prisma.enrolment.findMany({
      where: {
        tenantId: tenant.id,
        sectionId: input.classId,
        status: "ACTIVE",
        studentId: { in: input.records.map((record) => record.studentId) },
      },
      select: { studentId: true },
    });

    const enrolled = new Set(enrolments.map((row) => row.studentId));
    const stranger = input.records.find((record) => !enrolled.has(record.studentId));
    if (stranger) {
      throw new BadRequestError(
        "One of those students is not enrolled in this class. Refresh and try again.",
      );
    }

    await prisma.$transaction(
      input.records.map((record) =>
        prisma.attendanceRecord.upsert({
          where: {
            tenantId_sectionId_studentId_attendanceDate: {
              tenantId: tenant.id,
              sectionId: input.classId,
              studentId: record.studentId,
              attendanceDate: day,
            },
          },
          create: {
            tenantId: tenant.id,
            sectionId: input.classId,
            studentId: record.studentId,
            attendanceDate: day,
            status: record.status,
            markedBy: membership.userId,
          },
          update: {
            status: record.status,
            markedBy: membership.userId,
          },
        }),
      ),
      { timeout: 20_000 },
    );

    const records = await prisma.attendanceRecord.findMany({
      where: { tenantId: tenant.id, sectionId: input.classId, attendanceDate: day },
      orderBy: { studentId: "asc" },
    });

    return NextResponse.json(
      {
        records: records.map((record) => ({
          id: record.id,
          date: record.attendanceDate.toISOString().slice(0, 10),
          classId: input.classId,
          studentId: record.studentId,
          status: record.status,
          markedByTeacherId: record.markedBy,
          markedAt: record.createdAt.toISOString(),
        })),
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}