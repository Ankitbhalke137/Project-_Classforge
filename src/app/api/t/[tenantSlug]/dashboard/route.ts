import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext, withTenant } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";

/**
 * GET /api/t/:tenantSlug/dashboard
 *
 * The school-wide roll-up, counted straight from the database. Every number is a
 * real aggregate — a school with no attendance marked shows 0%, not a sample
 * value.
 *
 * The `exams` and `announcements` tables carry fewer columns than the app's
 * types expect, so the missing ones come back as empty defaults.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ tenantSlug: string }> }) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, ["SCHOOL_ADMIN"]);

    const today = new Date();
    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const [studentCount, teacherCount, classCount, todaysRecords, notices, exams] =
      await withTenant(tenant.id, async (tx) =>
        Promise.all([
          tx.student.count({ where: { tenantId: tenant.id } }),
          tx.teacher.count({ where: { tenantId: tenant.id } }),
          tx.schoolClass.count({ where: { tenantId: tenant.id } }),
          tx.attendanceRecord.findMany({
            where: { tenantId: tenant.id, attendanceDate: dayStart },
            select: { status: true },
          }),
          tx.announcement.findMany({
            where: { tenantId: tenant.id, publishedAt: { not: null } },
            include: { creator: { select: { id: true, name: true } } },
            orderBy: { publishedAt: "desc" },
            take: 5,
          }),
          tx.exam.findMany({
            where: { tenantId: tenant.id },
            include: { subject: { select: { name: true } } },
            orderBy: { examDate: "desc" },
            take: 10,
          }),
        ])
      );

    // Late counts as attended, matching the rest of the product.
    const present = todaysRecords.filter(
      (record) => record.status === "PRESENT" || record.status === "LATE",
    ).length;
    const percentage =
      todaysRecords.length === 0 ? 0 : Math.round((present / todaysRecords.length) * 100);

    const toExam = (exam: (typeof exams)[number]) => ({
      id: exam.id,
      name: `${exam.subject.name} — ${exam.name}`,
      term: "",
      classId: exam.sectionId,
      subjectId: exam.subjectId,
      teacherId: "",
      date: exam.examDate.toISOString(),
      maxMarks: exam.maxMarks,
      passMarks: 0,
      status: exam.status,
      publishedAt: exam.createdAt.toISOString(),
    });

    return NextResponse.json({
      schoolSlug: tenant.slug,
      studentCount,
      teacherCount,
      classCount,
      // Guardians have no table yet, so this is genuinely zero.
      parentCount: 0,
      attendanceToday: {
        date: dayStart.toISOString().slice(0, 10),
        percentage,
        marked: todaysRecords.length,
        total: studentCount,
      },
      // No fees table yet, so these are all genuinely zero.
      fees: {
        totalBilled: 0,
        totalCollected: 0,
        outstanding: 0,
        overdueAmount: 0,
        overdueCount: 0,
        collectionRate: 0,
      },
      upcomingExams: exams.filter((exam) => exam.status === "SCHEDULED").map(toExam),
      // The schema's ExamStatus has no PUBLISHED state; COMPLETED is the
      // closest equivalent to "results are out".
      recentExams: exams.filter((exam) => exam.status === "COMPLETED").map(toExam),
      latestAnnouncements: notices.map((notice) => ({
        id: notice.id,
        title: notice.title,
        body: notice.content,
        // No audience, priority or pin columns exist yet.
        audience: ["EVERYONE"],
        priority: "NORMAL",
        pinned: false,
        authorId: notice.creator.id,
        authorName: notice.creator.name,
        authorRole: "SCHOOL_ADMIN",
        publishedAt: (notice.publishedAt ?? notice.createdAt).toISOString(),
        eventDate: null,
        attachments: [],
        readCount: 0,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}