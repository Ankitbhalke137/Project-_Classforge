import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext, withTenant } from "@/lib/tenant-context";
import { handleApiError, NotFoundError } from "@/lib/errors";

/**
 * GET /api/t/:tenantSlug/attendance/register?sectionId=&date=
 *
 * The register for one section on one day: the students enrolled in it and the
 * status recorded for each.
 *
 * The app's contract passes `classId`, but a class in this schema is a grade
 * with many sections, so `sectionId` is what the row is actually keyed on. Both
 * are accepted to keep the client unchanged.
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
    ]);

    const params = request.nextUrl.searchParams;
    const sectionId = params.get("sectionId") ?? params.get("classId") ?? "";
    const rawDate = params.get("date") ?? "";

    if (!sectionId) {
      return NextResponse.json({
        date: rawDate,
        class: null,
        students: [],
        records: [],
      });
    }

    // Date-only columns live at UTC midnight; using local midnight would store
    // (and then look up) the previous day in timezones east of UTC.
    const now = new Date();
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate(),
    ).padStart(2, "0")}`;
    const day = new Date(
      `${/^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : localToday}T00:00:00.000Z`,
    );

    const enrolmentsAndRecords = await withTenant(tenant.id, async (tx) => {
      const enrolments = await tx.enrolment.findMany({
        where: { tenantId: tenant.id, sectionId, status: "ACTIVE" },
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true, admissionNo: true },
          },
        },
        orderBy: { student: { admissionNo: "asc" } },
      });

      const records = await tx.attendanceRecord.findMany({
        where: { tenantId: tenant.id, sectionId, attendanceDate: day },
      });

      const section = await tx.section.findFirst({
        where: { tenantId: tenant.id, id: sectionId },
        include: { schoolClass: { select: { id: true, name: true } } },
      });

      if (!section) throw new NotFoundError("That section was not found.");

      return { enrolments, records, section };
    });

    const { enrolments, records, section } = enrolmentsAndRecords;

    return NextResponse.json({
      date: rawDate,
      class: {
        id: section.schoolClass.id,
        name: `${section.schoolClass.name} - ${section.name}`,
        grade: section.schoolClass.name,
        section: section.name,
        room: "",
        homeroomTeacherId: null,
        subjectIds: [],
        studentCount: enrolments.length,
        capacity: 0,
      },
      students: enrolments.map((enrolment) => ({
        id: enrolment.student.id,
        name: `${enrolment.student.firstName} ${enrolment.student.lastName}`.trim(),
        email: "",
        admissionNo: enrolment.student.admissionNo,
        className: `${section.schoolClass.name} - ${section.name}`,
        status: "ACTIVE",
        classId: sectionId,
        grade: section.schoolClass.name,
        section: section.name,
        gender: "OTHER",
        dateOfBirth: "",
        phone: "",
        address: "",
        bloodGroup: "",
        parentId: null,
        admittedOn: enrolment.student.id,
      })),
      records: records.map((record) => ({
        id: record.id,
        date: record.attendanceDate.toISOString().slice(0, 10),
        classId: sectionId,
        studentId: record.studentId,
        status: record.status,
        markedByTeacherId: record.markedBy,
        markedAt: record.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}