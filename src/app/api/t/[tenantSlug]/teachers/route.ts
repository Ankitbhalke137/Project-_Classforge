import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveTenantContext, withTenant } from "@/lib/tenant-context";
import { handleApiError, ConflictError } from "@/lib/errors";

const createTeacherSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(100),
  lastName: z.string().trim().min(1, "Last name is required.").max(100),
  employeeNo: z.string().trim().min(1).max(50).optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
});

/**
 * GET /api/t/:tenantSlug/teachers
 *
 * Reads the `teachers` table. The database stores fewer columns than the app's
 * `Teacher` type asks for, so the fields with no column behind them come back
 * empty rather than being invented — a blank phone number is honest, a made-up
 * one is not.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ tenantSlug: string }> }) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, [
      "SCHOOL_ADMIN",
      "TEACHER",
    ]);

    const teachers = await prisma.teacher.findMany({
      where: { tenantId: tenant.id },
      include: {
        user: { select: { email: true } },
        teachingAssignments: {
          select: { sectionId: true, subjectId: true },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    const data = teachers.map((teacher) => ({
      id: teacher.id,
      name: `${teacher.firstName} ${teacher.lastName}`.trim(),
      email: teacher.user?.email ?? "",
      employeeNo: teacher.employeeNo ?? "",
      // No column exists for these yet.
      phone: "",
      qualification: "",
      designation: "",
      joinedOn: teacher.createdAt.toISOString(),
      subject: "",
      subjectIds: [...new Set(teacher.teachingAssignments.map((row) => row.subjectId))],
      classIds: [...new Set(teacher.teachingAssignments.map((row) => row.sectionId))],
    }));

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/t/:tenantSlug/teachers
 *
 * Adds a new teacher record to the school roster.
 * SCHOOL_ADMIN only.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ tenantSlug: string }> }) {
  try {
    const { tenantSlug } = await context.params;
    const { tenant } = await resolveTenantContext(request, tenantSlug, ["SCHOOL_ADMIN"]);

    const body = createTeacherSchema.parse(await request.json().catch(() => ({})));

    const teacher = await withTenant(tenant.id, async (tx) => {
      if (body.employeeNo) {
        const existing = await tx.teacher.findFirst({
          where: { tenantId: tenant.id, employeeNo: body.employeeNo },
        });
        if (existing) {
          throw new ConflictError("A teacher with this employee number already exists.", {
            employeeNo: "Employee number is already taken.",
          });
        }
      }

      return tx.teacher.create({
        data: {
          tenantId: tenant.id,
          firstName: body.firstName,
          lastName: body.lastName,
          employeeNo: body.employeeNo ?? null,
          userId: body.userId ?? null,
        },
        include: {
          user: { select: { email: true } },
        },
      });
    });

    return NextResponse.json(
      {
        id: teacher.id,
        name: `${teacher.firstName} ${teacher.lastName}`.trim(),
        email: teacher.user?.email ?? "",
        employeeNo: teacher.employeeNo ?? "",
        phone: "",
        qualification: "",
        designation: "",
        joinedOn: teacher.createdAt.toISOString(),
        subject: "",
        subjectIds: [],
        classIds: [],
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}