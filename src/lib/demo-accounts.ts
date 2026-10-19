/**
 * The accounts the sign-in screen offers, and the one password they share.
 *
 * These must match what `prisma/seed.ts` creates in the database. Kept as a
 * literal here on purpose: the login screen should never have to import from
 * the database, so the sign-in screen never depends on test fixtures.
 */

export const DEMO_PASSWORD = "Demo@12345";

export const DEMO_ACCOUNTS: Record<string, string> = {
  "admin@greenvalley.demo": "School Admin — Green Valley School",
  "user@greenvalley.demo": "Student — Green Valley School",
  "teacher@sunrise.demo": "Teacher — Sunrise Public School",
  "superadmin@classforge.demo": "Super Admin — sits outside every school",
};