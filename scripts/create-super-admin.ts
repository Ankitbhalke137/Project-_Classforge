/**
 * Creates or updates a platform Super Admin.
 *
 *   npx tsx scripts/create-super-admin.ts <email> [password] [name]
 *
 * With no arguments it falls back to SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD /
 * SUPER_ADMIN_NAME in .env.local.
 *
 * If the email already exists, the password is reset and the account is
 * promoted to SUPER_ADMIN. It is the only supported way to get a real
 * Super Admin — the seed no longer creates demo accounts.
 */
import dotenv from "dotenv";
import { PrismaClient, PlatformRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

dotenv.config({ path: ".env.local" });
dotenv.config();

const prisma = new PrismaClient();

function generatePassword(): string {
  return randomBytes(12).toString("base64url");
}

async function main() {
  const email = (process.argv[2] ?? process.env.SUPER_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.argv[3] ?? process.env.SUPER_ADMIN_PASSWORD ?? "";
  const name = (process.argv[4] ?? process.env.SUPER_ADMIN_NAME ?? "Platform Super Admin").trim();

  if (!email || !email.includes("@")) {
    console.error("Usage: npx tsx scripts/create-super-admin.ts <email> [password] [name]");
    process.exit(1);
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

  console.log(`Super Admin ready: ${user.email} (${user.name})`);
  console.log(`Action: ${existing ? "password reset + promoted" : "created"}`);
  console.log(`Password: ${finalPassword}`);
  console.log("Store it in .env.local as SUPER_ADMIN_PASSWORD and delete it from your shell history.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
