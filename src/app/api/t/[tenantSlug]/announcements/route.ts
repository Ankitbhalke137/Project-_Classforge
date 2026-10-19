import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";

/**
 * GET /api/t/:tenantSlug/announcements?page=1&search=
 *
 * Reads the `announcements` table. It has no audience, priority or pin columns,
 * so every notice comes back as a school-wide NORMAL notice.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ tenantSlug: string }> }) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug);

    const search = (request.nextUrl.searchParams.get("search") ?? "").toLowerCase();
    const page = Math.max(Number(request.nextUrl.searchParams.get("page") ?? 1) || 1, 1);
    const pageSize = 10;

    const where = {
      tenantId: tenant.id,
      publishedAt: { not: null },
      ...(search
        ? { OR: [{ title: { contains: search } }, { content: { contains: search } }] }
        : {}),
    };

    const [total, notices] = await Promise.all([
      prisma.announcement.count({ where }),
      prisma.announcement.findMany({
        where,
        include: { creator: { select: { id: true, name: true } } },
        orderBy: { publishedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      data: notices.map((notice) => ({
        id: notice.id,
        title: notice.title,
        body: notice.content,
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
      total,
      page,
      pageSize,
    });
  } catch (error) {
    return handleApiError(error);
  }
}