import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext, withTenant } from "@/lib/tenant-context";
import { handleApiError, NotFoundError, ConflictError } from "@/lib/errors";

type Context = {
  params: Promise<{ tenantSlug: string; id: string }>;
};

// GET: Fetch sections belonging to a class
export async function GET(request: NextRequest, context: Context) {
  try {
    const { tenantSlug, id } = await context.params;

    const { tenant } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
      "TEACHER",
      "STUDENT",
    ]);

    const result = await withTenant(tenant.id, async (tx) => {
      const schoolClass = await tx.schoolClass.findFirst({
        where: { id, tenantId: tenant.id },
      });

      if (!schoolClass) {
        throw new NotFoundError("Class not found.");
      }

      return tx.section.findMany({
        where: { classId: id, tenantId: tenant.id },
        orderBy: { name: "asc" },
      });
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

// POST: Create a section inside a class
export async function POST(request: NextRequest, context: Context) {
  try {
    const { tenantSlug, id } = await context.params;

    const { tenant } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
    ]);

    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      return NextResponse.json(
        { message: "Section name is required." },
        { status: 400 },
      );
    }

    const created = await withTenant(tenant.id, async (tx) => {
      const schoolClass = await tx.schoolClass.findFirst({
        where: { id, tenantId: tenant.id },
      });

      if (!schoolClass) {
        throw new NotFoundError("Class not found.");
      }

      const existing = await tx.section.findFirst({
        where: { classId: id, tenantId: tenant.id, name },
      });

      if (existing) {
        throw new ConflictError("A section with this name already exists in this class.", {
          name: "Section name already taken in this class.",
        });
      }

      return tx.section.create({
        data: {
          name,
          classId: id,
          tenantId: tenant.id,
        },
      });
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

