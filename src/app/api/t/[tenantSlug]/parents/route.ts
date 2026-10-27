import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";
import type { Parent } from "@/types";

/**
 * GET /api/t/:tenantSlug/parents
 *
 * Lists parents / guardians of students in this school.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug);

    const searchParams = request.nextUrl.searchParams;
    const search = (searchParams.get("search") ?? "").toLowerCase().trim();
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = Math.max(1, Number(searchParams.get("pageSize") || searchParams.get("limit")) || 10);

    const students = await prisma.student.findMany({
      where: { tenantId: tenant.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        guardianName: true,
        guardianPhone: true,
      },
    });

    const parentsMap = new Map<string, Parent>();

    students.forEach((st) => {
      const name = st.guardianName?.trim() || `Parent of ${st.firstName}`;
      const phone = st.guardianPhone?.trim() || "";
      // Name alone merges two unrelated guardians who happen to share it, so
      // the phone is part of the identity where the school recorded one.
      const key = `${name.toLowerCase()}|${phone}`;

      if (parentsMap.has(key)) {
        parentsMap.get(key)!.studentIds.push(st.id);
      } else {
        parentsMap.set(key, {
          // The directory is derived from student rows, so the id is an opaque
          // encoding of the guardian key — stable across reloads and reversible
          // by the children endpoint. It is not a database row.
          id: `par_${Buffer.from(key).toString("base64url")}`,
          name,
          email: null,
          phone: phone || null,
          occupation: null,
          studentIds: [st.id],
        });
      }
    });

    let allParents = Array.from(parentsMap.values());

    if (search) {
      allParents = allParents.filter(
        (p) =>
          p.name.toLowerCase().includes(search) ||
          (p.email?.toLowerCase().includes(search) ?? false) ||
          (p.phone?.includes(search) ?? false),
      );
    }

    const total = allParents.length;
    const skip = (page - 1) * pageSize;
    const paginated = allParents.slice(skip, skip + pageSize);

    return NextResponse.json({
      data: paginated,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
