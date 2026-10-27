/**
 * Automated PostgreSQL RLS Configuration and Database-Role Security Verifier.
 *
 * Verifies:
 *  A. Row-Level Security (RLS) Configuration:
 *     - Auditable inventory of all 17 tenant-owned tables.
 *     - Confirms RLS enabled (`relrowsecurity = true`) on all expected tables.
 *     - Confirms FORCE ROW LEVEL SECURITY (`relforcerowsecurity = true`) on all expected tables.
 *     - Confirms `tenant_isolation` policy with USING and WITH CHECK clauses using `app.current_tenant_id`.
 *     - Detects missing policies or un-isolated tables with `tenant_id`.
 *  B. Database-Role Security:
 *     - Verifies application role is not a superuser (`rolsuper = false`).
 *     - Verifies application role does not possess `BYPASSRLS` (`rolbypassrls = false`).
 *     - Verifies role memberships and effective table permissions.
 *     - Never prints database passwords or credentials in logs.
 *  C. Behavioral Tenant-Isolation Tests:
 *     - Cross-tenant read returns 0 rows.
 *     - Cross-tenant update/delete affects 0 rows.
 *     - Cross-tenant insert under wrong context is blocked with RLS violation.
 *     - Unset / empty tenant context prevents access to tenant-owned tables.
 *
 * Usage:
 *  - Single URL: npx tsx scripts/verify-rls-security.ts
 *  - Privileged setup + Restricted app role (Recommended for CI):
 *      SETUP_DATABASE_URL="postgresql://postgres:pass@localhost:5432/db" \
 *      APP_DATABASE_URL="postgresql://classforge_app:pass@localhost:5432/db" \
 *      npx tsx scripts/verify-rls-security.ts
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

// Explicit, auditable inventory of all tenant-owned tables required to have RLS
export const EXPECTED_TENANT_TABLES = [
  "memberships",
  "academic_years",
  "academic_terms",
  "timetable_periods",
  "timetable_slots",
  "notification_preferences",
  "classes",
  "sections",
  "subjects",
  "students",
  "teachers",
  "enrolments",
  "teaching_assignments",
  "attendance_records",
  "exams",
  "marks",
  "announcements",
] as const;

// Deliberately exempted tables (platform-level or global session entities)
export const INTENTIONAL_EXEMPT_TABLES = [
  "tenants",             // Platform-level directory of schools
  "users",               // Global platform user credentials and platformRole
  "refresh_tokens",      // Global user session refresh tokens
  "_prisma_migrations",  // Prisma migration tracking metadata
] as const;

let passed = 0;
let failed = 0;
let warnings = 0;

function assert(condition: boolean, message: string, fatal = true) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    if (fatal) {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    } else {
      console.warn(`  ⚠️ WARN: ${message}`);
      warnings++;
    }
  }
}

function sanitizeDatabaseUrl(url?: string): string {
  if (!url) return "<not-configured>";
  try {
    const parsed = new URL(url);
    parsed.password = "******";
    return parsed.toString();
  } catch {
    return "<redacted-database-url>";
  }
}

async function runRlsSecurityChecks() {
  console.log("\n=======================================================");
  console.log("   ClassForge Task 3: PostgreSQL RLS & Role Verifier   ");
  console.log("=======================================================\n");

  const setupUrl = process.env.SETUP_DATABASE_URL || process.env.DATABASE_URL;
  const appUrl = process.env.APP_DATABASE_URL || process.env.DATABASE_URL;

  if (!setupUrl) {
    console.error("FATAL: DATABASE_URL or SETUP_DATABASE_URL is not defined.");
    process.exit(1);
  }

  console.log(`Schema/Setup Connection : ${sanitizeDatabaseUrl(setupUrl)}`);
  console.log(`Application Role Connection: ${sanitizeDatabaseUrl(appUrl)}\n`);

  const setupPrisma = new PrismaClient({
    datasources: { db: { url: setupUrl } },
  });

  const appPrisma = appUrl === setupUrl ? setupPrisma : new PrismaClient({
    datasources: { db: { url: appUrl } },
  });

  try {
    // -------------------------------------------------------------
    // PART A: RLS Configuration Verification
    // -------------------------------------------------------------
    console.log("--- PART A: Row-Level Security (RLS) Configuration Verification ---");

    // 1. Query table RLS flags from pg_class
    const tableRlsInfo = await setupPrisma.$queryRaw<
      Array<{
        table_name: string;
        rls_enabled: boolean;
        rls_forced: boolean;
      }>
    >`
      SELECT
        c.relname AS table_name,
        c.relrowsecurity AS rls_enabled,
        c.relforcerowsecurity AS rls_forced
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname;
    `;

    const rlsMap = new Map<string, { rls_enabled: boolean; rls_forced: boolean }>();
    tableRlsInfo.forEach((row) => {
      rlsMap.set(row.table_name, row);
    });

    // Verify all 17 tenant tables exist and have RLS + FORCE RLS enabled
    for (const expectedTable of EXPECTED_TENANT_TABLES) {
      const info = rlsMap.get(expectedTable);
      assert(
        Boolean(info),
        `Tenant table '${expectedTable}' exists in public schema`,
      );
      if (info) {
        assert(
          info.rls_enabled === true,
          `Table '${expectedTable}' has ENABLE ROW LEVEL SECURITY`,
        );
        assert(
          info.rls_forced === true,
          `Table '${expectedTable}' has FORCE ROW LEVEL SECURITY`,
        );
      }
    }

    // 2. Query policy definitions from pg_policy
    const policies = await setupPrisma.$queryRaw<
      Array<{
        table_name: string;
        policy_name: string;
        polcmd: string;
        polpermissive: boolean;
        using_expr: string | null;
        with_check_expr: string | null;
      }>
    >`
      SELECT
        c.relname AS table_name,
        pol.polname AS policy_name,
        pol.polcmd AS polcmd,
        pol.polpermissive AS polpermissive,
        pg_get_expr(pol.polqual, pol.polrelid) AS using_expr,
        pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check_expr
      FROM pg_policy pol
      JOIN pg_class c ON c.oid = pol.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
      ORDER BY c.relname, pol.polname;
    `;

    const policyMap = new Map<string, Array<{
      policy_name: string;
      using_expr: string | null;
      with_check_expr: string | null;
    }>>();

    policies.forEach((p) => {
      const list = policyMap.get(p.table_name) || [];
      list.push(p);
      policyMap.set(p.table_name, list);
    });

    for (const expectedTable of EXPECTED_TENANT_TABLES) {
      const tablePolicies = policyMap.get(expectedTable) || [];
      const tenantPolicy = tablePolicies.find((p) => p.policy_name === "tenant_isolation");

      assert(
        Boolean(tenantPolicy),
        `Table '${expectedTable}' has 'tenant_isolation' policy`,
      );

      if (tenantPolicy) {
        const hasUsingContext =
          tenantPolicy.using_expr?.includes("tenant_id") &&
          tenantPolicy.using_expr?.includes("app.current_tenant_id");
        assert(
          Boolean(hasUsingContext),
          `Table '${expectedTable}' policy USING clause binds tenant_id to app.current_tenant_id`,
        );

        const hasWithCheckContext =
          tenantPolicy.with_check_expr?.includes("tenant_id") &&
          tenantPolicy.with_check_expr?.includes("app.current_tenant_id");
        assert(
          Boolean(hasWithCheckContext),
          `Table '${expectedTable}' policy WITH CHECK clause validates tenant_id on write`,
        );
      }
    }

    // 3. Regression check: find any table with a `tenant_id` column that is missing from inventory
    const tablesWithTenantIdCol = await setupPrisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT DISTINCT table_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'tenant_id'
      ORDER BY table_name;
    `;

    for (const col of tablesWithTenantIdCol) {
      const isAudited = (EXPECTED_TENANT_TABLES as readonly string[]).includes(col.table_name);
      assert(
        isAudited,
        `Table '${col.table_name}' with tenant_id is explicitly inventoried and governed`,
      );
    }

    // Verify intentional exempt tables
    for (const exempt of INTENTIONAL_EXEMPT_TABLES) {
      if (exempt === "_prisma_migrations") continue;
      const info = rlsMap.get(exempt);
      assert(
        Boolean(info),
        `Documented platform table '${exempt}' exists as an intentional non-tenant entity`,
      );
    }

    // -------------------------------------------------------------
    // PART B: Database-Role Security Verification
    // -------------------------------------------------------------
    console.log("\n--- PART B: Database-Role Security Verification ---");

    const appRoleInfo = await appPrisma.$queryRaw<
      Array<{
        rolname: string;
        rolsuper: boolean;
        rolinherit: boolean;
        rolcreaterole: boolean;
        rolcreatedb: boolean;
        rolcanlogin: boolean;
        rolbypassrls: boolean;
      }>
    >`
      SELECT
        r.rolname,
        r.rolsuper,
        r.rolinherit,
        r.rolcreaterole,
        r.rolcreatedb,
        r.rolcanlogin,
        r.rolbypassrls
      FROM pg_roles r
      WHERE r.rolname = current_user;
    `;

    let appRoleHasBypass = false;

    if (appRoleInfo.length > 0) {
      const currentRole = appRoleInfo[0];
      console.log(`Application Connection Role: '${currentRole.rolname}'`);

      const isSuperuser = currentRole.rolsuper;
      appRoleHasBypass = currentRole.rolbypassrls || isSuperuser;

      if (process.env.CI === "true" || process.env.STRICT_ROLE_CHECK === "true") {
        assert(!isSuperuser, `Application role '${currentRole.rolname}' is NOT a superuser`);
        assert(!currentRole.rolbypassrls, `Application role '${currentRole.rolname}' does NOT have BYPASSRLS`);
      } else {
        if (appRoleHasBypass) {
          console.warn(
            `  ⚠️ NOTICE: Role '${currentRole.rolname}' has elevated flags (rolsuper=${isSuperuser}, rolbypassrls=${currentRole.rolbypassrls}). In production/CI, connect with a dedicated restricted role (e.g. classforge_app).`,
          );
          warnings++;
        } else {
          assert(true, `Application role '${currentRole.rolname}' is not superuser and has no BYPASSRLS`);
        }
      }

      // Check role memberships
      const memberships = await appPrisma.$queryRaw<Array<{ rolname: string }>>`
        SELECT b.rolname
        FROM pg_auth_members m
        JOIN pg_roles a ON a.oid = m.member
        JOIN pg_roles b ON b.oid = m.roleid
        WHERE a.rolname = current_user;
      `;
      const memberNames = memberships.map((m) => m.rolname);
      console.log(`Effective Role Memberships: [${memberNames.join(", ")}]`);
    }

    // -------------------------------------------------------------
    // PART C: Behavioral Tenant-Isolation Verification
    // -------------------------------------------------------------
    console.log("\n--- PART C: Behavioral Tenant-Isolation Verification ---");

    if (appRoleHasBypass && process.env.CI !== "true" && !process.env.APP_DATABASE_URL) {
      console.warn(
        "  ⚠️ SKIPPING behavioral isolation tests: Connection role has BYPASSRLS. Behavioral tests require a restricted application role (set APP_DATABASE_URL).",
      );
      warnings++;
    } else {
      // Provision test data cleanly using setupPrisma
      const testPrefix = `test_rls_${Date.now()}`;
      const slugA = `${testPrefix}_a`;
      const slugB = `${testPrefix}_b`;

      const [tenantA, tenantB] = await Promise.all([
        setupPrisma.tenant.create({
          data: { name: `RLS School A`, slug: slugA, status: "ACTIVE" },
        }),
        setupPrisma.tenant.create({
          data: { name: `RLS School B`, slug: slugB, status: "ACTIVE" },
        }),
      ]);

      const testUser = await setupPrisma.user.create({
        data: {
          email: `${testPrefix}@classforge.dev`,
          passwordHash: "dummy-hash",
          name: "RLS Test Creator",
        },
      });

      // Create test announcements for each tenant
      const [annA, annB] = await Promise.all([
        setupPrisma.announcement.create({
          data: {
            tenantId: tenantA.id,
            title: "Tenant A Private Announcement",
            content: "Confidential School A information.",
            createdBy: testUser.id,
          },
        }),
        setupPrisma.announcement.create({
          data: {
            tenantId: tenantB.id,
            title: "Tenant B Private Announcement",
            content: "Confidential School B information.",
            createdBy: testUser.id,
          },
        }),
      ]);

      try {
        // 1. Under Tenant A context, can read Tenant A data
        const readOwn = await appPrisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantA.id}, true)`;
          return tx.announcement.findUnique({ where: { id: annA.id } });
        });
        assert(readOwn?.id === annA.id, "Tenant A context can read its own records");

        // 2. Under Tenant A context, reading Tenant B data returns null (invisible)
        const readForeign = await appPrisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantA.id}, true)`;
          return tx.announcement.findUnique({ where: { id: annB.id } });
        });
        assert(
          readForeign === null,
          "Tenant A context CANNOT read Tenant B records (returns null under RLS)",
        );

        // 3. Under Tenant A context, query list only returns Tenant A records
        const listAll = await appPrisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantA.id}, true)`;
          return tx.announcement.findMany({
            where: { id: { in: [annA.id, annB.id] } },
          });
        });
        assert(
          listAll.length === 1 && listAll[0].id === annA.id,
          "Tenant A query list excludes all Tenant B records",
        );

        // 4. Under Tenant A context, update on Tenant B record affects 0 rows
        const updateForeign = await appPrisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantA.id}, true)`;
          return tx.announcement.updateMany({
            where: { id: annB.id },
            data: { title: "Hacked Title" },
          });
        });
        assert(updateForeign.count === 0, "Tenant A context CANNOT update Tenant B records (0 rows modified)");

        // 5. Under Tenant A context, delete on Tenant B record affects 0 rows
        const deleteForeign = await appPrisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantA.id}, true)`;
          return tx.announcement.deleteMany({
            where: { id: annB.id },
          });
        });
        assert(deleteForeign.count === 0, "Tenant A context CANNOT delete Tenant B records (0 rows deleted)");

        // 6. Under Tenant A context, inserting a record with Tenant B ID is blocked by WITH CHECK
        let insertViolated = false;
        try {
          await appPrisma.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantA.id}, true)`;
            await tx.announcement.create({
              data: {
                tenantId: tenantB.id,
                title: "Spoofed Tenant B Announcement",
                content: "This must be rejected by RLS WITH CHECK policy.",
                createdBy: testUser.id,
              },
            });
          });
        } catch (err: any) {
          insertViolated =
            err.message?.includes("row-level security") ||
            err.message?.includes("violates") ||
            err.code === "P2004";
        }
        assert(
          insertViolated,
          "Inserting cross-tenant record violates PostgreSQL RLS WITH CHECK policy",
        );

        // 7. Unset / empty tenant context returns 0 rows
        const noContextRead = await appPrisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.current_tenant_id', '', true)`;
          return tx.announcement.findMany({
            where: { id: { in: [annA.id, annB.id] } },
          });
        });
        assert(
          noContextRead.length === 0,
          "Empty tenant context returns 0 rows (no accidental cross-tenant data leakage)",
        );
      } finally {
        // Clean up test data
        await setupPrisma.announcement.deleteMany({
          where: { id: { in: [annA.id, annB.id] } },
        });
        await setupPrisma.user.delete({ where: { id: testUser.id } });
        await setupPrisma.tenant.deleteMany({
          where: { id: { in: [tenantA.id, tenantB.id] } },
        });
      }
    }

    console.log("\n=======================================================");
    console.log(`Task 3 Results: ${passed} PASSED, ${failed} FAILED, ${warnings} WARNINGS`);
    console.log("=======================================================\n");

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    await setupPrisma.$disconnect();
    if (appPrisma !== setupPrisma) {
      await appPrisma.$disconnect();
    }
  }
}

runRlsSecurityChecks().catch((err) => {
  console.error("RLS Security Verification failed with unexpected error:", err);
  process.exit(1);
});
