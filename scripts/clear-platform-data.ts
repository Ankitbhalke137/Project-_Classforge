/**
 * Removes every demo row from the database so a fresh set of real users can be
 * set up through the platform console.
 *
 *   npx tsx scripts/clear-platform-data.ts --yes
 *
 * What it deletes:
 *   - every tenant (schools) and everything hanging off it, by cascade
 *   - every user that is not a platform Super Admin
 *   - every refresh token
 *
 * The `--yes` flag is required. Without it the script only reports what it
 * would remove and exits.
 */
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config({ path: ".env.local" });
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const confirmed = process.argv.includes("--yes");

  const [tenants, users, students, teachers, memberships, tokens] = await Promise.all([
    prisma.tenant.count(),
    prisma.user.count(),
    prisma.student.count(),
    prisma.teacher.count(),
    prisma.membership.count(),
    prisma.refreshToken.count(),
  ]);

  console.log("Current database contents:");
  console.log(`  tenants (schools):  ${tenants}`);
  console.log(`  users:              ${users}`);
  console.log(`  students:           ${students}`);
  console.log(`  teachers:           ${teachers}`);
  console.log(`  memberships:        ${memberships}`);
  console.log(`  refresh tokens:     ${tokens}`);

  if (!confirmed) {
    console.log("\nNothing was deleted. Re-run with --yes to clear the demo data.");
    return;
  }

  // Tenants cascade to students, teachers, memberships, classes, marks and the
  // rest, so removing them first leaves no orphans behind.
  const deletedTenants = await prisma.tenant.deleteMany();
  const deletedTokens = await prisma.refreshToken.deleteMany();

  // Super Admins are kept — they are the platform, not demo data.
  const deletedUsers = await prisma.user.deleteMany({
    where: { platformRole: null },
  });

  console.log("\nCleared:");
  console.log(`  deleted ${deletedTenants.count} tenants`);
  console.log(`  deleted ${deletedUsers.count} non-super-admin users`);
  console.log(`  deleted ${deletedTokens.count} refresh tokens`);

  const remaining = await prisma.user.findMany({
    where: { platformRole: { not: null } },
    select: { email: true, name: true },
  });

  console.log("\nSuper Admins kept:");
  for (const admin of remaining) {
    console.log(`  ${admin.email}  (${admin.name})`);
  }
  if (remaining.length === 0) {
    console.log("  none — run `npm run db:seed` to create one.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
