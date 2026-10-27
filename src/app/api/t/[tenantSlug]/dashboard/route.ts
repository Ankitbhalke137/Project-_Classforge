import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";
import { getFeeSummary } from "@/lib/services/fee-service";

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
    const { tenant, membership } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
    ]);

    const today = new Date();
    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const [studentCount, teacherCount, classCount, todaysRecords, notices, exams] =
      await Promise.all([
        prisma.student.count({ where: { tenantId: tenant.id } }),
        prisma.teacher.count({ where: { tenantId: tenant.id } }),
        prisma.schoolClass.count({ where: { tenantId: tenant.id } }),
        prisma.attendanceRecord.findMany({
          where: { tenantId: tenant.id, attendanceDate: dayStart },
          select: { status: true },
        }),
        prisma.announcement.findMany({
          where: { tenantId: tenant.id, publishedAt: { not: null } },
          include: { creator: { select: { id: true, name: true } } },
          orderBy: { publishedAt: "desc" },
          take: 5,
        }),
        prisma.exam.findMany({
          where: { tenantId: tenant.id },
          include: { subject: { select: { name: true } } },
          orderBy: { examDate: "desc" },
          take: 10,
        }),
      ]);

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

    const feeMetrics = await getFeeSummary(tenant.id, {
      role: membership.role,
      userId: membership.userId,
    });
    const guardians = await prisma.student.findMany({
      where: { tenantId: tenant.id, guardianName: { not: null } },
      select: { guardianName: true },
      distinct: ["guardianName"],
    });
    const parentCount = guardians.length;

    return NextResponse.json({
      schoolSlug: tenant.slug,
      studentCount,
      teacherCount,
      classCount,
      parentCount,
      attendanceToday: {
        date: dayStart.toISOString().slice(0, 10),
        percentage,
        marked: todaysRecords.length,
        total: studentCount,
      },
      fees: feeMetrics,
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