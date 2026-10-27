import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext, withTenant } from "@/lib/tenant-context";
import { BadRequestError, ForbiddenError, NotFoundError, handleApiError } from "@/lib/errors";

const AUDIENCES = ["EVERYONE", "STAFF", "TEACHERS", "STUDENTS", "PARENTS"] as const;
const PRIORITIES = ["NORMAL", "IMPORTANT", "URGENT"] as const;

const createSchema = z.object({
  title: z.string().trim().min(3, "Give the notice a title").max(200),
  body: z.string().trim().min(1, "Write the notice").max(10_000),
  audience: z.array(z.enum(AUDIENCES)).default(["EVERYONE"]),
  priority: z.enum(PRIORITIES).default("NORMAL"),
  pinned: z.boolean().optional(),
  sectionId: z.string().uuid("Invalid section ID").optional().nullable(),
});

type NoticeRow = {
  id: string;
  tenantId: string;
  sectionId: string | null;
  title: string;
  content: string;
  audience: string[];
  priority: string;
  pinned: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  creator: { id: string; name: string };
};

function formatNotice(notice: NoticeRow) {
  return {
    id: notice.id,
    sectionId: notice.sectionId ?? null,
    title: notice.title,
    body: notice.content,
    audience: notice.audience,
    priority: notice.priority,
    pinned: notice.pinned,
    authorId: notice.creator.id,
    authorName: notice.creator.name,
    authorRole: "SCHOOL_ADMIN",
    publishedAt: (notice.publishedAt ?? notice.createdAt).toISOString(),
    eventDate: null,
    attachments: [],
    // There is no read-receipt table yet; zero is the honest number.
    readCount: 0,
  };
}

/**
 * GET /api/t/:tenantSlug/announcements?page=1&limit=10&search=&priority=&audience=&sectionId=
 *
 * Newest first, with pinned notices above the rest. Returns standardized pagination shape.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant, user, membership } = await resolveTenantContext(request, tenantSlug);

    return await withTenant(tenant.id, async (tx) => {
      // Students see school-wide notices plus notices for their own class.
      const role: string = membership.role;
      const scope: Prisma.AnnouncementWhereInput[] = [];
      if (role === "STUDENT") {
        const student = await tx.student.findFirst({
          where: { tenantId: tenant.id, userId: user.id },
          select: {
            enrolments: {
              where: { status: "ACTIVE" },
              select: { sectionId: true },
            },
          },
        });
        const sectionIds = student?.enrolments.map((row) => row.sectionId) ?? [];
        scope.push({
          OR: [
            { sectionId: null, audience: { hasSome: ["EVERYONE", "STUDENTS"] } },
            ...(sectionIds.length ? [{ sectionId: { in: sectionIds } }] : []),
          ],
        });
      } else if (role === "PARENT") {
        scope.push({
          sectionId: null,
          audience: { hasSome: ["EVERYONE", "PARENTS"] },
        });
      }

      const params = request.nextUrl.searchParams;
      const search = (params.get("search") ?? "").trim();
      const priority = params.get("priority") ?? "";
      const audience = params.get("audience") ?? "";
      const sectionId = params.get("sectionId") ?? "";
      const page = Math.max(Number(params.get("page") ?? 1) || 1, 1);
      const limit = Math.min(
        Math.max(Number(params.get("limit") ?? params.get("pageSize") ?? 10) || 10, 1),
        100,
      );

      if (priority && !PRIORITIES.includes(priority as (typeof PRIORITIES)[number])) {
        throw new BadRequestError("Unknown priority filter.");
      }
      if (audience && !AUDIENCES.includes(audience as (typeof AUDIENCES)[number])) {
        throw new BadRequestError("Unknown audience filter.");
      }

      const where: Prisma.AnnouncementWhereInput = {
        tenantId: tenant.id,
        publishedAt: { not: null },
        ...(scope.length ? { AND: scope } : {}),
        ...(sectionId ? { sectionId } : {}),
        ...(search
          ? { OR: [{ title: { contains: search, mode: "insensitive" } }, { content: { contains: search, mode: "insensitive" } }] }
          : {}),
        ...(priority ? { priority: priority as (typeof PRIORITIES)[number] } : {}),
        ...(audience ? { audience: { has: audience } } : {}),
      };

      const [total, notices] = await Promise.all([
        tx.announcement.count({ where }),
        tx.announcement.findMany({
          where,
          include: { creator: { select: { id: true, name: true } } },
          orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);

      const totalPages = Math.max(Math.ceil(total / limit), 1);

      return NextResponse.json({
        data: notices.map(formatNotice),
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
        total,
        page,
        pageSize: limit,
        limit,
        totalPages,
      });
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/t/:tenantSlug/announcements
 *
 * Publishes an announcement.
 * - School Admins can post school-wide notices or section-specific notices.
 * - Teachers are restricted to posting announcements only to sections they are
 *   assigned to teach or homeroom.
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

    const parsed = createSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new BadRequestError(
        parsed.error.issues[0]?.message ?? "Check the notice and try again.",
        Object.fromEntries(
          parsed.error.issues.map((issue) => [String(issue.path[0] ?? "form"), issue.message]),
        ),
      );
    }

    const input = parsed.data;

    return await withTenant(tenant.id, async (tx) => {
      // Verify section belongs to current tenant if sectionId is passed
      if (input.sectionId) {
        const section = await tx.section.findFirst({
          where: { id: input.sectionId, tenantId: tenant.id },
          select: { id: true },
        });
        if (!section) {
          throw new NotFoundError("Selected class section was not found in this school.");
        }
      }

      // Teachers must be assigned to the section and cannot post school-wide
      if (membership.role === "TEACHER") {
        if (!input.sectionId) {
          throw new ForbiddenError(
            "Teachers cannot post school-wide announcements. Please choose an assigned class section.",
          );
        }

        const teacher = await tx.teacher.findFirst({
          where: { tenantId: tenant.id, userId: membership.userId },
          select: { id: true },
        });

        if (!teacher) {
          throw new ForbiddenError("Your account is not linked to a teacher profile in this school.");
        }

        const teaches = await tx.teachingAssignment.findFirst({
          where: { tenantId: tenant.id, teacherId: teacher.id, sectionId: input.sectionId },
          select: { id: true },
        });

        const homeroom = teaches
          ? null
          : await tx.schoolClass.findFirst({
              where: {
                tenantId: tenant.id,
                homeroomTeacherId: teacher.id,
                sections: { some: { id: input.sectionId } },
              },
              select: { id: true },
            });

        if (!teaches && !homeroom) {
          throw new ForbiddenError("You can only post announcements to class sections assigned to you.");
        }
      }

      const notice = await tx.announcement.create({
        data: {
          tenantId: tenant.id,
          sectionId: input.sectionId || null,
          createdBy: membership.userId,
          title: input.title,
          content: input.body,
          audience: [...new Set(input.audience)],
          priority: input.priority,
          pinned: input.pinned ?? false,
          publishedAt: new Date(),
        },
        include: { creator: { select: { id: true, name: true } } },
      });

      return NextResponse.json(formatNotice(notice), { status: 201 });
    });
  } catch (error) {
    return handleApiError(error);
  }
}
