import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { PrismaClient } from "@prisma/client";

/**
 * Provisions a restricted application role for CI and test isolation verification.
 * The created role possesses:
 *  - NOSUPERUSER
 *  - NOBYPASSRLS
 *  - NOCREATEDB
 *  - NOCREATEROLE
 *  - SELECT, INSERT, UPDATE, DELETE on all public schema tables
 */
async function main() {
  const setupUrl = process.env.SETUP_DATABASE_URL || process.env.DATABASE_URL;
  if (!setupUrl) {
    console.error("SETUP_DATABASE_URL or DATABASE_URL is required to provision test role.");
    process.exit(1);
  }

  const prisma = new PrismaClient({ datasources: { db: { url: setupUrl } } });

  try {
    console.log("Provisioning restricted application role 'classforge_app'...");

    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'classforge_app') THEN
          CREATE ROLE classforge_app WITH LOGIN PASSWORD 'ci_app_password' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
        ELSE
          ALTER ROLE classforge_app WITH NOSUPERUSER NOBYPASSRLS;
        END IF;
      END
      $$;
    `);

    // Determine target database name safely
    let dbName = "classforge_ci_test";
    try {
      const parsed = new URL(setupUrl);
      const pathname = parsed.pathname.replace(/^\//, "");
      if (pathname) dbName = pathname;
    } catch {}

    await prisma.$executeRawUnsafe(`GRANT CONNECT ON DATABASE "${dbName}" TO classforge_app;`);
    await prisma.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO classforge_app;`);
    await prisma.$executeRawUnsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO classforge_app;`);
    await prisma.$executeRawUnsafe(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO classforge_app;`);
    await prisma.$executeRawUnsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO classforge_app;`);

    console.log("✅ Role 'classforge_app' successfully configured without superuser or BYPASSRLS permissions.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Failed to provision test role:", err);
  process.exit(1);
});
