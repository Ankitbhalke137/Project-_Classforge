import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveTenantContext, withTenant } from "@/lib/tenant-context";
import { handleApiError, NotFoundError, ForbiddenError } from "@/lib/errors";

type Context = {
  params: Promise<{ tenantSlug: string; id: string }>;
};

const updateAnnouncementSchema = z
  .object({
    title: z.string().trim().min(1, "Title cannot be empty.").max(200).optional(),
    content: z.string().trim().min(1).max(20000).optional(),
    body: z.string().trim().min(1).max(20000).optional(),
    publish: z.boolean().optional(),
  })
  .refine(
    (d) =>
      d.title !== undefined ||
      d.content !== undefined ||
      d.body !== undefined ||
      d.publish !== undefined,
    { message: "At least one field must be provided for update." },
  );

/**
 * GET /api/t/:tenantSlug/announcements/:id
 * Retrieves a single announcement.
 */
export async function GET(request: NextRequest, context: Context) {
  try {
    const { tenantSlug, id } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
      "TEACHER",
      "STUDENT",
    ]);

    const announcement = await withTenant(tenant.id, async (tx) => {
      return tx.announcement.findFirst({
        where: { id, tenantId: tenant.id },
        include: {
          creator: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
        },
      });
    });

    if (!announcement) {
      throw new NotFoundError("Announcement not found.");
    }

    return NextResponse.json({
      id: announcement.id,
      title: announcement.title,
      body: announcement.content,
      audience: ["EVERYONE"],
      priority: "NORMAL",
      pinned: false,
      authorId: announcement.creator.id,
      authorName: announcement.creator.name,
      authorRole: "SCHOOL_ADMIN",
      publishedAt: (announcement.publishedAt ?? announcement.createdAt).toISOString(),
      eventDate: null,
      attachments: [],
      readCount: 0,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/t/:tenantSlug/announcements/:id
 * Updates an announcement.
 * SCHOOL_ADMIN or creator TEACHER.
 */
export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { tenantSlug, id } = await context.params;
    const { tenant, membership } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
      "TEACHER",
    ]);

    const raw = await request.json().catch(() => ({}));
    const validated = updateAnnouncementSchema.parse(raw);
    const textContent = validated.content ?? validated.body;

    const updated = await withTenant(tenant.id, async (tx) => {
      const existing = await tx.announcement.findFirst({
        where: { id, tenantId: tenant.id },
      });
      if (!existing) {
        throw new NotFoundError("Announcement not found.");
      }

      // If TEACHER, verify creator ownership
      if (membership.role === "TEACHER" && existing.createdBy !== membership.userId) {
        throw new ForbiddenError("You may only edit announcements you created.");
      }

      return tx.announcement.update({
        where: { id },
        data: {
          ...(validated.title !== undefined ? { title: validated.title } : {}),
          ...(textContent !== undefined ? { content: textContent } : {}),
          ...(validated.publish !== undefined
            ? { publishedAt: validated.publish ? new Date() : null }
            : {}),
        },
        include: {
          creator: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
        },
      });
    });

    return NextResponse.json({
      id: updated.id,
      title: updated.title,
      body: updated.content,
      audience: ["EVERYONE"],
      priority: "NORMAL",
      pinned: false,
      authorId: updated.creator.id,
      authorName: updated.creator.name,
      authorRole: membership.role,
      publishedAt: (updated.publishedAt ?? updated.createdAt).toISOString(),
      eventDate: null,
      attachments: [],
      readCount: 0,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE /api/t/:tenantSlug/announcements/:id
 * Deletes an announcement.
 * SCHOOL_ADMIN or creator TEACHER.
 */
export async function DELETE(request: NextRequest, context: Context) {
  try {
    const { tenantSlug, id } = await context.params;
    const { tenant, membership } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
      "TEACHER",
    ]);

    await withTenant(tenant.id, async (tx) => {
      const existing = await tx.announcement.findFirst({
        where: { id, tenantId: tenant.id },
      });
      if (!existing) {
        throw new NotFoundError("Announcement not found.");
      }

      if (membership.role === "TEACHER" && existing.createdBy !== membership.userId) {
        throw new ForbiddenError("You may only delete announcements you created.");
      }

      await tx.announcement.delete({ where: { id } });
    });

    return NextResponse.json({ message: "Announcement deleted successfully." });
  } catch (error) {
    return handleApiError(error);
  }
}
