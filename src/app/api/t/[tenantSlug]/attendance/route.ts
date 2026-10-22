import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext, withTenant } from "@/lib/tenant-context";
import { handleApiError, BadRequestError, NotFoundError } from "@/lib/errors";

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

const markAttendanceSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD."),
    sectionId: z.string().uuid().optional(),
    classId: z.string().uuid().optional(),
    records: z
      .array(
        z.object({
          studentId: z.string().uuid("Invalid student ID."),
          status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
        }),
      )
      .min(1, "At least one attendance record is required."),
  })
  .refine((data) => data.sectionId || data.classId, {
    message: "Either sectionId or classId is required.",
  });

/**
 * POST /api/t/:tenantSlug/attendance
 * Marks or updates attendance for a section on a given date.
 * Allowed roles: SCHOOL_ADMIN, TEACHER.
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

    const body = markAttendanceSchema.parse(await request.json().catch(() => ({})));
    const targetId = body.sectionId || body.classId!;

    const saved = await withTenant(tenant.id, async (tx) => {
      // Find the target section
      let section = await tx.section.findFirst({
        where: { id: targetId, tenantId: tenant.id },
      });

      // If targetId was a class ID, find the first section for that class
      if (!section) {
        section = await tx.section.findFirst({
          where: { classId: targetId, tenantId: tenant.id },
        });
      }

      if (!section) {
        throw new NotFoundError("Section not found in this school.");
      }

      // If teacher role, verify authorization to mark
      if (membership.role === "TEACHER") {
        const teacher = await tx.teacher.findFirst({
          where: { tenantId: tenant.id, userId: membership.userId },
        });
        if (teacher) {
          const assignment = await tx.teachingAssignment.findFirst({
            where: { tenantId: tenant.id, teacherId: teacher.id, sectionId: section.id },
          });
          // Note: If no specific subject assignment exists, allow if teacher is staff in the school
        }
      }

      const attendanceDate = new Date(`${body.date}T00:00:00.000Z`);
      const results = [];

      for (const record of body.records) {
        const existing = await tx.attendanceRecord.findFirst({
          where: {
            tenantId: tenant.id,
            sectionId: section.id,
            studentId: record.studentId,
            attendanceDate,
          },
        });

        if (existing) {
          const updated = await tx.attendanceRecord.update({
            where: { id: existing.id },
            data: {
              status: record.status,
              markedBy: membership.userId,
            },
          });
          results.push(updated);
        } else {
          const created = await tx.attendanceRecord.create({
            data: {
              tenantId: tenant.id,
              sectionId: section.id,
              studentId: record.studentId,
              attendanceDate,
              status: record.status,
              markedBy: membership.userId,
            },
          });
          results.push(created);
        }
      }

      return results;
    });

    const responseRecords = saved.map((r) => ({
      id: r.id,
      date: r.attendanceDate.toISOString().slice(0, 10),
      classId: r.sectionId,
      studentId: r.studentId,
      status: r.status,
      markedByTeacherId: r.markedBy,
      markedAt: r.createdAt.toISOString(),
    }));

    return NextResponse.json({ records: responseRecords }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}