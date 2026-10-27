import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext, withTenant } from "@/lib/tenant-context";
import { BadRequestError, ForbiddenError, handleApiError, NotFoundError } from "@/lib/errors";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const AUDIENCES = ["EVERYONE", "STAFF", "TEACHERS", "STUDENTS", "PARENTS"] as const;
const PRIORITIES = ["NORMAL", "IMPORTANT", "URGENT"] as const;

const updateSchema = z
  .object({
    title: z.string().trim().min(3, "Give the notice a title").max(200).optional(),
    body: z.string().trim().min(1, "Write the notice").max(10_000).optional(),
    audience: z.array(z.enum(AUDIENCES)).min(1, "Choose at least one audience").optional(),
    priority: z.enum(PRIORITIES).optional(),
    pinned: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "Choose at least one field to change.",
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

function assertValidId(id: string) {
  if (!UUID.test(id)) throw new NotFoundError("Announcement not found.");
}

/**
 * GET /api/t/:tenantSlug/announcements/:id
 *
 * Students and parents only reach notices aimed at them, or a notice for a
 * section they are actively enrolled in. Staff can read every notice.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string; id: string }> },
) {
  try {
    const { tenantSlug, id } = await context.params;
    assertValidId(id);
    const { tenant, user, membership } = await resolveTenantContext(request, tenantSlug);

    return await withTenant(tenant.id, async (tx) => {
      const notice = await tx.announcement.findFirst({
        where: { id, tenantId: tenant.id },
        include: { creator: { select: { id: true, name: true } } },
      });
      if (!notice) throw new NotFoundError("Announcement not found.");

      const role: string = membership.role;
      if (role === "STUDENT" || role === "PARENT") {
        if (notice.sectionId) {
          const student =
            role === "STUDENT"
              ? await tx.student.findFirst({
                  where: { tenantId: tenant.id, userId: user.id },
                  select: {
                    enrolments: {
                      where: { status: "ACTIVE", sectionId: notice.sectionId },
                      select: { id: true },
                    },
                  },
                })
              : null;
          if (!student?.enrolments.length) {
            throw new ForbiddenError("This notice is not available to you.");
          }
        } else {
          const allowed = role === "STUDENT" ? ["EVERYONE", "STUDENTS"] : ["EVERYONE", "PARENTS"];
          if (!notice.audience.some((audience) => allowed.includes(audience))) {
            throw new ForbiddenError("This notice is not available to you.");
          }
        }
      }

      return NextResponse.json(formatNotice(notice));
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/** PATCH /api/t/:tenantSlug/announcements/:id — teachers edit only their own notices. */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string; id: string }> },
) {
  try {
    const { tenantSlug, id } = await context.params;
    assertValidId(id);
    const { tenant, membership } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
      "TEACHER",
    ]);

    const parsed = updateSchema.safeParse(await request.json().catch(() => null));
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
      const current = await tx.announcement.findFirst({
        where: { id, tenantId: tenant.id },
        select: { id: true, createdBy: true },
      });
      if (!current) throw new NotFoundError("Announcement not found.");
      if (membership.role === "TEACHER" && current.createdBy !== membership.userId) {
        throw new ForbiddenError("You can only edit notices you created.");
      }

      const notice = await tx.announcement.update({
        where: { id },
        data: {
          title: input.title,
          content: input.body,
          audience: input.audience ? [...new Set(input.audience)] : undefined,
          priority: input.priority,
          pinned: input.pinned,
        },
        include: { creator: { select: { id: true, name: true } } },
      });

      return NextResponse.json(formatNotice(notice));
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE /api/t/:tenantSlug/announcements/:id — same ownership rule as PATCH. */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string; id: string }> },
) {
  try {
    const { tenantSlug, id } = await context.params;
    assertValidId(id);
    const { tenant, membership } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
      "TEACHER",
    ]);

    return await withTenant(tenant.id, async (tx) => {
      const notice = await tx.announcement.findFirst({
        where: { id, tenantId: tenant.id },
        select: { id: true, createdBy: true },
      });
      if (!notice) throw new NotFoundError("Announcement not found.");
      if (membership.role === "TEACHER" && notice.createdBy !== membership.userId) {
        throw new ForbiddenError("You can only delete notices you created.");
      }

      await tx.announcement.delete({ where: { id } });
      return NextResponse.json({ removed: true, id });
    });
  } catch (error) {
    return handleApiError(error);
  }
}
