import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext, withTenant } from "@/lib/tenant-context";
import { handleApiError, NotFoundError } from "@/lib/errors";

type Context = {
  params: Promise<{ tenantSlug: string; id: string }>;
};

/**
 * DELETE /api/t/:tenantSlug/teaching-assignments/:id
 * Removes a teaching assignment.
 * SCHOOL_ADMIN only.
 */
export async function DELETE(request: NextRequest, context: Context) {
  try {
    const { tenantSlug, id } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, ["SCHOOL_ADMIN"]);

    await withTenant(tenant.id, async (tx) => {
      const assignment = await tx.teachingAssignment.findFirst({
        where: { id, tenantId: tenant.id },
      });

      if (!assignment) {
        throw new NotFoundError("Teaching assignment not found.");
      }

      await tx.teachingAssignment.delete({ where: { id } });
    });

    return NextResponse.json({ message: "Teaching assignment removed successfully." });
  } catch (error) {
    return handleApiError(error);
  }
}
