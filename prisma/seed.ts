/**
 * Provisions the one account a fresh database needs: the platform Super Admin.
 *
 * Nothing else is seeded. Schools, staff and students are created through the
 * platform console or the tenant APIs, so every row in the database belongs to a
 * real person and a real school.
 *
 * The Super Admin is described entirely by environment variables, so no
 * credential is written into this repository:
 *
 *   SUPER_ADMIN_EMAIL     the sign-in address
 *   SUPER_ADMIN_PASSWORD  the initial password (change it after the first sign-in)
 *   SUPER_ADMIN_NAME      display name, defaults to "Platform Super Admin"
 */

import {
  PrismaClient,
  PlatformRole,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const prisma = new PrismaClient();

function generatePassword(): string {
  return randomBytes(12).toString("base64url");
}

async function main() {
  const email = (process.env.SUPER_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const name = (process.env.SUPER_ADMIN_NAME ?? "Platform Super Admin").trim();
  const password = process.env.SUPER_ADMIN_PASSWORD ?? "";

  if (!email || !email.includes("@")) {
    throw new Error(
      "SUPER_ADMIN_EMAIL is not set. Add it to .env.local before running the seed.",
    );
  }

  const finalPassword = password || generatePassword();
  const passwordHash = await bcrypt.hash(finalPassword, 10);

  const existing = await prisma.user.findUnique({ where: { email } });

  const user = existing
    ? await prisma.user.update({
        where: { email },
        data: { name, passwordHash, platformRole: PlatformRole.SUPER_ADMIN },
      })
    : await prisma.user.create({
        data: { name, email, passwordHash, platformRole: PlatformRole.SUPER_ADMIN },
      });

  console.log("Seed completed successfully!");
  console.log(`Super Admin: ${user.email}`);
  console.log(existing ? "Existing account: password reset." : "Account created.");
  if (!password) {
    console.log(`Generated password: ${finalPassword}`);
    console.log("Save it to .env.local as SUPER_ADMIN_PASSWORD and change it after signing in.");
  }
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
