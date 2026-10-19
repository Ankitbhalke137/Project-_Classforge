import { NextRequest, NextResponse } from "next/server";
import { resolveTenantContext } from "@/lib/tenant-context";
import { handleApiError } from "@/lib/errors";
import {
  listStudents,
  createStudent,
} from "@/lib/services/student-service";

interface RouteContext {
  params: Promise<{ tenantSlug: string }>;
}

/**
 * GET /api/t/:tenantSlug/students
 *
 * Query params:
 * - page: number (default 1)
 * - limit / pageSize: number (default 20)
 * - search: string
 * - classId: UUID
 * - sectionId: UUID
 * - status: "ACTIVE" | "INACTIVE" | "ALL"
 * - sort: "name:asc" | "admissionNo:asc" | "createdAt:desc" ...
 */

/**
 * GET: Students ki list fetch karta hai.
 *
 * 1. URL se tenantSlug nikalta hai, jisse school identify hota hai.
 *
 * 2. resolveTenantContext() verify karta hai ki user authenticated
 *    hai aur uska role SCHOOL_ADMIN ya TEACHER hai.
 *
 * 3. URL ke query parameters read karta hai:
 *    - page / limit / pageSize: pagination ke liye
 *    - search: students ko search karne ke liye
 *    - classId / sectionId: class aur section ke basis par filter
 *    - status: ACTIVE, INACTIVE ya ALL students ke liye
 *    - sort: records ko required order mein arrange karne ke liye
 *
 * 4. listStudents() ko school ID, filters aur user ki details
 *    pass karta hai. Actual database query service file mein hoti hai.
 *
 * 5. Result ko JSON response mein frontend ko return karta hai.
 *
 * Permission: SCHOOL_ADMIN aur TEACHER students ki list dekh sakte hain.
 * STUDENT role ko is route se roster access nahi diya gaya hai.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { tenantSlug } = await context.params;

    // Allowed roles: SCHOOL_ADMIN, TEACHER (Teachers have view-only access, Students have no roster access)
    const { tenant, membership } = await resolveTenantContext(
      request,
      tenantSlug,
      ["SCHOOL_ADMIN", "TEACHER"],
    );

    const searchParams = request.nextUrl.searchParams;
    const query = {
      page: searchParams.get("page") ? Number(searchParams.get("page")) : undefined,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
      pageSize: searchParams.get("pageSize") ? Number(searchParams.get("pageSize")) : undefined,
      search: searchParams.get("search") ?? undefined,
      classId: searchParams.get("classId") ?? undefined,
      sectionId: searchParams.get("sectionId") ?? undefined,
      status: (searchParams.get("status") as "ACTIVE" | "INACTIVE" | "ALL") ?? undefined,
      sort: searchParams.get("sort") ?? undefined,
    };

    const result = await listStudents(tenant.id, query, {
      userId: membership.userId,
      role: membership.role,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/t/:tenantSlug/students
 *
 * Body:
 * - firstName: string (required)
 * - lastName: string (required)
 * - admissionNo: string (required, unique per school)
 * - dateOfBirth: string (optional, YYYY-MM-DD)
 * - email: string (optional)
 * - sectionId: UUID (optional)
 * - academicYearId: UUID (optional)
 */

/**
 * Student Management API
 *
 * GET  /api/t/:tenantSlug/students
 *      School ke students ki list fetch karta hai.
 *
 * POST /api/t/:tenantSlug/students
 *      Database mein naya student create karta hai.
 *
 * tenantSlug se identify hota hai ki request kis school ki hai.
 * Authentication aur role permissions resolveTenantContext()
 * ke through verify hoti hain.
 *
 * Database ka actual business logic student-service.ts mein hai.
 * Is file ka kaam request lena, access check karna aur response
 * frontend ko return karna hai.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { tenantSlug } = await context.params;

    // Allowed roles: Only SCHOOL_ADMIN can create students
    const { tenant, membership } = await resolveTenantContext(
      request,
      tenantSlug,
      ["SCHOOL_ADMIN"],
    );

    const body = await request.json().catch(() => ({}));

    const newStudent = await createStudent(tenant.id, body, {
      userId: membership.userId,
      role: membership.role,
    });

    return NextResponse.json(newStudent, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
