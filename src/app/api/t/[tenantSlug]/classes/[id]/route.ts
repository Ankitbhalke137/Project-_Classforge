import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext, withTenant } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";

type Context = {
  params: Promise<{ tenantSlug: string; id: string }>;
};

export async function GET(request: NextRequest, context: Context) {
  try {
    const { tenantSlug, id } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
      "TEACHER",
      "STUDENT",
    ]);

    const result = await withTenant(tenant.id, async (tx) => {
      return tx.schoolClass.findFirst({
        where: { id, tenantId: tenant.id },
        include: {
          academicYear: { select: { id: true, name: true, status: true } },
          sections: { select: { id: true, name: true } },
          subjects: { select: { id: true, name: true, code: true } },
        },
      });
    });

    if (!result) {
      return NextResponse.json({ message: "Class not found." }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { tenantSlug, id } = await context.params;
    const { tenant } = await resolveTenantContext(
      request, tenantSlug, ["SCHOOL_ADMIN"]
    );
    const body = await request.json();

    const result = await withTenant(tenant.id, async (tx) => {
      const existing = await tx.schoolClass.findFirst({
        where: { id, tenantId: tenant.id },
      });
      if (!existing) return null;

      const data: { name?: string; academicYearId?: string } = {};

      if (body.name !== undefined) {
        if (typeof body.name !== "string" || !body.name.trim()) {
          throw new Error("INVALID_CLASS_NAME");
        }
        data.name = body.name.trim();
      }

      if (body.academicYearId !== undefined) {
        if (typeof body.academicYearId !== "string") {
          throw new Error("INVALID_ACADEMIC_YEAR");
        }
        const year = await tx.academicYear.findFirst({
          where: { id: body.academicYearId, tenantId: tenant.id },
        });
        if (!year) throw new Error("ACADEMIC_YEAR_NOT_FOUND");
        data.academicYearId = body.academicYearId;
      }

      if (!Object.keys(data).length) throw new Error("NO_UPDATE_FIELDS");

      return tx.schoolClass.update({ where: { id }, data });
    });

    if (!result) {
      return NextResponse.json({ message: "Class not found." }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      const messages: Record<string, string> = {
        INVALID_CLASS_NAME: "Class name must not be empty.",
        INVALID_ACADEMIC_YEAR: "academicYearId must be a string.",
        ACADEMIC_YEAR_NOT_FOUND: "Academic year not found in this school.",
        NO_UPDATE_FIELDS: "Provide name or academicYearId to update.",
      };
      if (messages[error.message]) {
        return NextResponse.json({ message: messages[error.message] }, { status: 400 });
      }
    }
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const { tenantSlug, id } = await context.params;
    const { tenant } = await resolveTenantContext(
      request, tenantSlug, ["SCHOOL_ADMIN"]
    );

    const result = await withTenant(tenant.id, async (tx) => {
      const existing = await tx.schoolClass.findFirst({
        where: { id, tenantId: tenant.id },
        include: { sections: { select: { id: true } } },
      });

      if (!existing) return "NOT_FOUND";
      if (existing.sections.length) return "HAS_SECTIONS";

      await tx.schoolClass.delete({ where: { id } });
      return "DELETED";
    });

    if (result === "NOT_FOUND") {
      return NextResponse.json({ message: "Class not found." }, { status: 404 });
    }
    if (result === "HAS_SECTIONS") {
      return NextResponse.json(
        { message: "Remove or reassign this class's sections before deleting it." },
        { status: 409 }
      );
    }

    return NextResponse.json({ message: "Class deleted successfully." });
  } catch (error) {
    return handleApiError(error);
  }
}
