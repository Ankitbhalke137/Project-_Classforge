import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext, withTenant } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";

interface RouteContext {
  params: Promise<{ tenantSlug: string }>;
}


/**
 * GET /api/t/:tenantSlug/classes
 *
 * Yeh API current school ki saari classes, unke academic years
 * aur sections ki list database se fetch karti hai.
 *
 * 1. URL se tenantSlug nikalta hai, jisse pata chalta hai ki
 *    request kis school ke liye aayi hai.
 *
 * 2. resolveTenantContext() check karta hai ki user authenticated
 *    hai aur uske paas allowed role (SCHOOL_ADMIN, TEACHER ya
 *    STUDENT) ke saath us school ka access hai.
 *
 * 3. withTenant() ke andar database query chalti hai aur sirf
 *    current school (tenant) ki classes fetch hoti hain.
 *
 * 4. Har class ke saath uska academic year aur sections bhi
 *    fetch hote hain. Classes aur sections naam ke hisaab se
 *    alphabetical order mein aate hain.
 *
 * 5. Data JSON format mein frontend ko return hota hai, jise
 *    Student Form mein class aur section ke dropdowns bharne
 *    ke liye use kiya ja sakta hai.
 *
 * 6. Agar koi error aata hai, toh handleApiError() usse handle
 *    karta hai.
 *
 * Important: Yeh API sirf data fetch karti hai. Yeh student ko
 * create, update ya delete nahi karti.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { tenantSlug } = await context.params;

    const { tenant } = await resolveTenantContext(
      request,
      tenantSlug,
      ["SCHOOL_ADMIN", "TEACHER", "STUDENT"],
    );

    const classes = await withTenant(tenant.id, async (tx) => {
      return tx.schoolClass.findMany({
        where: { tenantId: tenant.id },
        orderBy: { name: "asc" },
        include: {
          academicYear: {
            select: { id: true, name: true, status: true },
          },
          sections: {
            orderBy: { name: "asc" },
            select: { id: true, name: true },
          },
        },
      });
    });

    // Flattened to one row per class *section*, because that is what the app calls
    // a class: "Grade 6 - A" is a section, not a whole grade.
    //
    // The response is a plain array because `listClasses` in `lib/api.ts` is typed
    // `Promise<SchoolClass[]>`. It was returning `{ data: [...] }`, so every
    // caller that did `.map` or `.reduce` on the result threw.
    const data = classes.flatMap((schoolClass) => {
      // A class with no sections still belongs on the roster.
      const sections = schoolClass.sections.length
        ? schoolClass.sections
        : [{ id: schoolClass.id, name: "" }];

      return sections.map((section) => ({
        // `id` is the section, because that is what rosters and registers take.
        // `classId` is exposed separately so a filter can span every section.
        id: section.id,
        classId: schoolClass.id,
        name: section.name ? `${schoolClass.name} - ${section.name}` : schoolClass.name,
        grade: schoolClass.name,
        section: section.name,
        // No column exists for these yet.
        room: "",
        homeroomTeacherId: null,
        subjectIds: [] as string[],
        studentCount: 0,
        capacity: 0,
      }));
    });

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}
