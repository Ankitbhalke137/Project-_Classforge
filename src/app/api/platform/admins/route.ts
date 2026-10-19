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
import { sendEmail } from "@/lib/email/service";
import { staffInviteHtml, staffInviteText } from "@/lib/email/templates";

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
 * A new account is created with a generated password, and that password is
 * emailed to the person from superadminclassforge@gmail.com. The password is
 * also returned once in the response, so the Super Admin can pass it on if the
 * email does not arrive.
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

    // Send the temporary password by email from superadminclassforge@gmail.com.
    // A failed send must not undo the account, so the response still carries the
    // password and the Super Admin can pass it on manually.
    const loginUrl = `${process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? ""}/login`;
    let emailSent = false;
    if (temporaryPassword) {
      const info = await sendEmail({
        to: email,
        subject: `Your ${school.name} staff account is ready`,
        html: staffInviteHtml({
          name,
          tempPassword: temporaryPassword,
          schoolName: school.name,
          loginUrl,
        }),
        text: staffInviteText({
          name,
          tempPassword: temporaryPassword,
          schoolName: school.name,
          loginUrl,
        }),
      });
      emailSent = info !== null;
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
        // False when SMTP was not configured or the send failed. The Super Admin
        // can still copy temporaryPassword from this response.
        emailSent,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}


