import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  ConflictError,
  NotFoundError,
  handleApiError,
} from "@/lib/errors";
import { requireSuperAdmin } from "@/lib/platform-auth";

/** The staff roles a Super Admin may hand out. Students are created from a roster. */
const STAFF_ROLES = ["SCHOOL_ADMIN", "TEACHER"] as const;

/** One readable temporary password, shown to the Super Admin exactly once. */
function generateTemporaryPassword(): string {
  return randomBytes(12).toString("base64url");
}

/**
 * GET /api/platform/admins
 *
 * Every staff membership across every school. Students are excluded: this screen
 * is about who administers a school, not who attends it.
 */
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin(request);

    const memberships = await prisma.membership.findMany({
      where: { role: { in: [...STAFF_ROLES] } },
      include: {
        user: { select: { id: true, name: true, email: true } },
        tenant: { select: { id: true, name: true, slug: true } },
      },
      orderBy: [{ tenant: { name: "asc" } }, { user: { name: "asc" } }],
    });

    return NextResponse.json(
      memberships.map((membership) => ({
        userId: membership.user.id,
        tenantId: membership.tenant.id,
        name: membership.user.name,
        email: membership.user.email,
        role: membership.role,
        status: membership.status,
        schoolId: membership.tenant.id,
        schoolName: membership.tenant.name,
        schoolSlug: membership.tenant.slug,
      })),
    );
  } catch (error) {
    return handleApiError(error);
  }
}

const createAdminSchema = z.object({
  name: z.string().trim().min(2, "Name is too short.").max(150),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .transform((email) => email.toLowerCase()),
  schoolId: z.string().uuid("Choose a school."),
  role: z.enum(STAFF_ROLES),
});

/**
 * POST /api/platform/admins
 *
 * Gives one person staff access to one school.
 *
 * Email delivery is not configured yet, so a new account is created with a
 * generated password and the password is returned once for the Super Admin to
 * pass on. When SMTP is added, this same endpoint can send it instead — the
 * account and membership already exist, so nothing else has to change.
 *
 * An email that already has an account keeps its name and password; only the
 * membership is added. An account with no password yet (a student imported from
 * the roster) is given one, because otherwise it could never sign in.
 */
export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin(request);

    const body: unknown = await request.json().catch(() => null);
    const { name, email, schoolId, role } = createAdminSchema.parse(body);

    const school = await prisma.tenant.findUnique({ where: { id: schoolId } });
    if (!school) throw new NotFoundError("School not found.");

    let user = await prisma.user.findUnique({ where: { email } });
    let temporaryPassword: string | null = null;

    if (user) {
      const existing = await prisma.membership.findUnique({
        where: { tenantId_userId: { tenantId: school.id, userId: user.id } },
      });
      if (existing) {
        throw new ConflictError("This person already has access to that school.", {
          email: "Already a member of this school.",
        });
      }
    }

    if (!user) {
      temporaryPassword = generateTemporaryPassword();
      user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash: await hash(temporaryPassword, 10),
        },
      });
    } else if (!user.passwordHash) {
      temporaryPassword = generateTemporaryPassword();
      user = await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await hash(temporaryPassword, 10) },
      });
    }

    const membership = await prisma.membership.create({
      data: { tenantId: school.id, userId: user.id, role },
    });

    return NextResponse.json(
      {
        userId: user.id,
        tenantId: school.id,
        name: user.name,
        email: user.email,
        role: membership.role,
        status: membership.status,
        schoolId: school.id,
        schoolName: school.name,
        schoolSlug: school.slug,
        // Null when the person already had a working account. The screen only
        // shows the credentials panel when this is present.
        temporaryPassword,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}


