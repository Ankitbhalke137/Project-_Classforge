import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";

const preferencesSchema = z.object({
  inAppNotifications: z.boolean(),
  emailNotifications: z.boolean(),
  classAnnouncements: z.boolean(),
});

/**
 * GET /api/t/:tenantSlug/notification-preferences
 *
 * The signed-in person's own notification choices for this school. A member
 * with no row yet gets the defaults, so the settings screen always shows
 * something real.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant, user } = await resolveTenantContext(request, tenantSlug);

    const preferences = await prisma.notificationPreference.findUnique({
      where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
    });

    return NextResponse.json(
      preferences
        ? {
            inAppNotifications: preferences.inAppNotifications,
            emailNotifications: preferences.emailNotifications,
            classAnnouncements: preferences.classAnnouncements,
          }
        : {
            inAppNotifications: true,
            emailNotifications: false,
            classAnnouncements: true,
          },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/t/:tenantSlug/notification-preferences
 *
 * Saves the signed-in person's notification choices.
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant, user } = await resolveTenantContext(request, tenantSlug);

    const body: unknown = await request.json().catch(() => null);
    const { inAppNotifications, emailNotifications, classAnnouncements } =
      preferencesSchema.parse(body);

    const preferences = await prisma.notificationPreference.upsert({
      where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
      create: {
        tenantId: tenant.id,
        userId: user.id,
        inAppNotifications,
        emailNotifications,
        classAnnouncements,
      },
      update: { inAppNotifications, emailNotifications, classAnnouncements },
    });

    return NextResponse.json({
      inAppNotifications: preferences.inAppNotifications,
      emailNotifications: preferences.emailNotifications,
      classAnnouncements: preferences.classAnnouncements,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
