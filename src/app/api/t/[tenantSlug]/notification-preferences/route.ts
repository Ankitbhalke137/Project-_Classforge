import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext, withTenant } from "@/lib/tenant-context";
import { BadRequestError, handleApiError } from "@/lib/errors";

const savePreferencesSchema = z.object({
  inAppNotifications: z.boolean().default(true),
  emailNotifications: z.boolean().default(false),
  classAnnouncements: z.boolean().default(true),
});

/**
 * GET /api/t/:tenantSlug/notification-preferences
 *
 * Fetches the signed-in user's notification preferences inside this school.
 * The signed-in person's choices for this school. Someone who has never saved
 * them gets the defaults; nothing is written until they actually choose.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant, user } = await resolveTenantContext(request, tenantSlug);

    const preferences = await withTenant(tenant.id, async (tx) =>
      tx.notificationPreference.findUnique({
        where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
      })
    );

    return NextResponse.json({
      inAppNotifications: preferences?.inAppNotifications ?? true,
      emailNotifications: preferences?.emailNotifications ?? false,
      classAnnouncements: preferences?.classAnnouncements ?? true,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/t/:tenantSlug/notification-preferences
 *
 * Upserts the signed-in user's notification preferences for this school.
 * Stores all three switches together. Per school, not per account — the same
 * person may want a different mix in each school they belong to.
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant, user } = await resolveTenantContext(request, tenantSlug);

    const rawBody: unknown = await request.json().catch(() => null);
    const parsed = savePreferencesSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new BadRequestError("Invalid notification preferences payload.", {
        prefs: "Please provide valid boolean values for notification options.",
      });
    }

    const { inAppNotifications, emailNotifications, classAnnouncements } = parsed.data;

    const saved = await withTenant(tenant.id, async (tx) =>
      tx.notificationPreference.upsert({
        where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
        update: { inAppNotifications, emailNotifications, classAnnouncements },
        create: {
          tenantId: tenant.id,
          userId: user.id,
          inAppNotifications,
          emailNotifications,
          classAnnouncements,
        },
      })
    );

    return NextResponse.json({
      inAppNotifications: saved.inAppNotifications,
      emailNotifications: saved.emailNotifications,
      classAnnouncements: saved.classAnnouncements,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
