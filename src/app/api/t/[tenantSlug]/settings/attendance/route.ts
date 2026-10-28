import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext, withTenant } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";

const saveSettingsSchema = z.object({
  allowTeacherEdit: z.boolean().default(true),
  requireParentNoteForExcused: z.boolean().default(false),
  lateThresholdMinutes: z
    .number()
    .int()
    .min(0)
    .max(120)
    .default(15),
});

/**
 * GET /api/t/:tenantSlug/settings/attendance
 *
 * Returns the attendance policy for this school. Defaults are returned when no
 * settings have been saved yet.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug);

    const settings = await withTenant(tenant.id, async (tx) =>
      tx.attendanceSettings.findUnique({
        where: { tenantId: tenant.id },
      })
    );

    return NextResponse.json({
      allowTeacherEdit: settings?.allowTeacherEdit ?? true,
      requireParentNoteForExcused: settings?.requireParentNoteForExcused ?? false,
      lateThresholdMinutes: settings?.lateThresholdMinutes ?? 15,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/t/:tenantSlug/settings/attendance
 *
 * Upserts the attendance policy for this school. Only school admins may save.
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant, membership } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
    ]);

    const input = saveSettingsSchema.parse(await request.json().catch(() => null));

    const settings = await withTenant(tenant.id, async (tx) =>
      tx.attendanceSettings.upsert({
        where: { tenantId: tenant.id },
        create: {
          tenantId: tenant.id,
          ...input,
        },
        update: {
          allowTeacherEdit: input.allowTeacherEdit,
          requireParentNoteForExcused: input.requireParentNoteForExcused,
          lateThresholdMinutes: input.lateThresholdMinutes,
        },
      })
    );

    return NextResponse.json({
      allowTeacherEdit: settings.allowTeacherEdit,
      requireParentNoteForExcused: settings.requireParentNoteForExcused,
      lateThresholdMinutes: settings.lateThresholdMinutes,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
