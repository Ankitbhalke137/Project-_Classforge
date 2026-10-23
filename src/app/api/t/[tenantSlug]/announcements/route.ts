import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant-context";
import { BadRequestError, handleApiError } from "@/lib/errors";

const AUDIENCES = ["EVERYONE", "STAFF", "TEACHERS", "STUDENTS", "PARENTS"] as const;
const PRIORITIES = ["NORMAL", "IMPORTANT", "URGENT"] as const;

const createSchema = z.object({
  title: z.string().trim().min(3, "Give the notice a title").max(200),
  body: z.string().trim().min(1, "Write the notice").max(10_000),
  audience: z.array(z.enum(AUDIENCES)).min(1, "Choose at least one audience"),
  priority: z.enum(PRIORITIES).default("NORMAL"),
  pinned: z.boolean().optional(),
});

type NoticeRow = {
  id: string;
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
 * GET /api/t/:tenantSlug/announcements?page=1&search=&priority=&audience=
 *
 * Newest first, with pinned notices above the rest.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant, user, membership } = await resolveTenantContext(request, tenantSlug);

    // Students see school-wide notices plus notices for their own class. Staff
    // keep the full list because they write and manage notices. The cast keeps
    // this branch ready for a PARENT membership even though today's enum only
    // stores staff and students.
    const role: string = membership.role;
    const scope: Prisma.AnnouncementWhereInput[] = [];
    if (role === "STUDENT") {
      const student = await prisma.student.findFirst({
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
    const page = Math.max(Number(params.get("page") ?? 1) || 1, 1);
    const pageSize = 10;

    if (priority && !PRIORITIES.includes(priority as (typeof PRIORITIES)[number])) {
      throw new BadRequestError("Unknown priority filter.");
    }
    if (audience && !AUDIENCES.includes(audience as (typeof AUDIENCES)[number])) {
      throw new BadRequestError("Unknown audience filter.");
    }

    const where = {
      tenantId: tenant.id,
      publishedAt: { not: null },
      ...(scope.length ? { AND: scope } : {}),
      ...(search
        ? { OR: [{ title: { contains: search } }, { content: { contains: search } }] }
        : {}),
      ...(priority ? { priority: priority as (typeof PRIORITIES)[number] } : {}),
      ...(audience ? { audience: { has: audience } } : {}),
    };

    const [total, notices] = await Promise.all([
      prisma.announcement.count({ where }),
      prisma.announcement.findMany({
        where,
        include: { creator: { select: { id: true, name: true } } },
        orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      data: notices.map(formatNotice),
      total,
      page,
      pageSize,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/t/:tenantSlug/announcements — publishes immediately. */
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
    const notice = await prisma.announcement.create({
      data: {
        tenantId: tenant.id,
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
  } catch (error) {
    return handleApiError(error);
  }
}
