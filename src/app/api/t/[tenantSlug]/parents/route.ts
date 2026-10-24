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

    students.forEach((st, idx) => {
      const gName = st.guardianName?.trim() || `Parent of ${st.firstName}`;
      const key = gName.toLowerCase();

      if (parentsMap.has(key)) {
        parentsMap.get(key)!.studentIds.push(st.id);
      } else {
        const email = `${gName.toLowerCase().replace(/[^a-z0-9]/g, ".")}@${tenantSlug}.edu`;
        parentsMap.set(key, {
          id: `par_${st.id.slice(0, 8)}`,
          name: gName,
          email,
          phone: st.guardianPhone || `+91 98${idx}10 ${1000 + idx}`,
          occupation: "Guardian",
          studentIds: [st.id],
        });
      }
    });

    let allParents = Array.from(parentsMap.values());

    if (search) {
      allParents = allParents.filter(
        (p) =>
          p.name.toLowerCase().includes(search) ||
          p.email.toLowerCase().includes(search) ||
          p.phone.includes(search),
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
