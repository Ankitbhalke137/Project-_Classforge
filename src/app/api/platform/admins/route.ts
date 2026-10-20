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
import { sendCredentialsEmail, appUrl } from "@/lib/mail";

/** The staff roles a Super Admin may hand out. Students are created from a roster. */
const STAFF_ROLES = ["SCHOOL_ADMIN", "TEACHER"] as const;

/** One readable temporary password, shown to the Super Admin exactly once. */
function generateTemporaryPassword(): string {
  return randomBytes(12).toString("base64url");
}

/** The role as a person would read it in an email, not the database enum. */
const ROLE_LABEL: Record<string, string> = {
  SCHOOL_ADMIN: "School Admin",
  TEACHER: "Teacher",
};

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
 * The account is created with a generated password, which is emailed to them.
 * The same password is returned once to the Super Admin as a backup — it is
 * only ever stored as a bcrypt hash, so it cannot be looked up later. If the
 * email cannot be sent the account still exists and the Super Admin shares the
 * password by hand.
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

    // Only a brand new account has a password worth emailing. Someone who
    // already had one keeps it, and re-sending it would be wrong.
    let emailSent = false;
    if (temporaryPassword) {
      const result = await sendCredentialsEmail({
        to: user.email,
        name: user.name,
        schoolName: school.name,
        role: ROLE_LABEL[membership.role] ?? membership.role,
        temporaryPassword,
        signInUrl: `${appUrl()}/login`,
      });
      emailSent = result.sent;
    }

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
        emailSent,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}


