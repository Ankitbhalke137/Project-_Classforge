import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant-context";
import { BadRequestError, handleApiError } from "@/lib/errors";

const notificationPrefsSchema = z.object({
  inAppNotifications: z.boolean().default(true),
  emailNotifications: z.boolean().default(false),
  classAnnouncements: z.boolean().default(true),
});

/**
 * GET /api/t/:tenantSlug/notification-preferences
 *
 * Fetches the signed-in user's notification preferences inside this school.
 * Returns defaults if no explicit preferences have been stored yet.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant, user } = await resolveTenantContext(request, tenantSlug);

    const pref = await prisma.notificationPreference.findUnique({
      where: {
        tenantId_userId: {
          tenantId: tenant.id,
          userId: user.id,
        },
      },
    });

    return NextResponse.json({
      inAppNotifications: pref?.inAppNotifications ?? true,
      emailNotifications: pref?.emailNotifications ?? false,
      classAnnouncements: pref?.classAnnouncements ?? true,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/t/:tenantSlug/notification-preferences
 *
 * Upserts the signed-in user's notification preferences for this school.
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant, user } = await resolveTenantContext(request, tenantSlug);

    const rawBody: unknown = await request.json().catch(() => null);
    const parsed = notificationPrefsSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new BadRequestError("Invalid notification preferences payload.", {
        prefs: "Please provide valid boolean values for notification options.",
      });
    }

    const { inAppNotifications, emailNotifications, classAnnouncements } = parsed.data;

    const saved = await prisma.notificationPreference.upsert({
      where: {
        tenantId_userId: {
          tenantId: tenant.id,
          userId: user.id,
        },
      },
      update: {
        inAppNotifications,
        emailNotifications,
        classAnnouncements,
      },
      create: {
        tenantId: tenant.id,
        userId: user.id,
        inAppNotifications,
        emailNotifications,
        classAnnouncements,
      },
    });

    return NextResponse.json({
      inAppNotifications: saved.inAppNotifications,
      emailNotifications: saved.emailNotifications,
      classAnnouncements: saved.classAnnouncements,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
