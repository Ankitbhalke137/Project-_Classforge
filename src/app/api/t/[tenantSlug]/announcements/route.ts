import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext, withTenant } from "@/lib/tenant-context";
import { handleApiError, NotFoundError } from "@/lib/errors";

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

const createAnnouncementSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required.").max(200),
    content: z.string().trim().min(1).max(20000).optional(),
    body: z.string().trim().min(1).max(20000).optional(),
    sectionId: z.string().uuid("Invalid sectionId.").optional().nullable(),
    publish: z.boolean().optional().default(true),
  })
  .refine((data) => data.content !== undefined || data.body !== undefined, {
    message: "Announcement content or body is required.",
  });

/**
 * POST /api/t/:tenantSlug/announcements
 * Creates a new announcement.
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

    const raw = await request.json().catch(() => ({}));
    const validated = createAnnouncementSchema.parse(raw);
    const textContent = (validated.content ?? validated.body)!.trim();

    const announcement = await withTenant(tenant.id, async (tx) => {
      if (validated.sectionId) {
        const section = await tx.section.findFirst({
          where: { id: validated.sectionId, tenantId: tenant.id },
        });
        if (!section) {
          throw new NotFoundError("Section not found in this school.");
        }
      }

      return tx.announcement.create({
        data: {
          tenantId: tenant.id,
          createdBy: membership.userId,
          title: validated.title,
          content: textContent,
          sectionId: validated.sectionId ?? null,
          publishedAt: validated.publish ? new Date() : null,
        },
        include: {
          creator: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
        },
      });
    });

    return NextResponse.json(
      {
        id: announcement.id,
        title: announcement.title,
        body: announcement.content,
        audience: ["EVERYONE"],
        priority: "NORMAL",
        pinned: false,
        authorId: announcement.creator.id,
        authorName: announcement.creator.name,
        authorRole: membership.role,
        publishedAt: (announcement.publishedAt ?? announcement.createdAt).toISOString(),
        eventDate: null,
        attachments: [],
        readCount: 0,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}