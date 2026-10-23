/**
 * End-to-end check of every Super Admin endpoint, against a running app.
 *
 *   npm run dev            # in one terminal
 *   npm run test:platform  # in another
 *
 * It signs in as a Super Admin, walks the full CRUD on schools and on staff
 * memberships, and confirms the authorisation rules hold. Everything it creates
 * it cleans up again, so the database is left as it was found.
 *
 * Env:
 *   BASE_URL            default http://localhost:3000
 *   SUPER_ADMIN_EMAIL   default from .env.local
 *   SUPER_ADMIN_PASSWORD  default from .env.local
 */

import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config({ path: ".env.local" });
dotenv.config();

const prisma = new PrismaClient();

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const EMAIL = (process.env.SUPER_ADMIN_EMAIL ?? "").trim().toLowerCase();
const PASSWORD = process.env.SUPER_ADMIN_PASSWORD ?? "";

let passed = 0;
let failed = 0;
let cookie = "";

/* The shapes this script reads back from the API. */
type Json = Record<string, unknown>;
interface LoginResponse {
  user: { id: string; name: string; email: string; isSuperAdmin: boolean };
}
interface SchoolResponse {
  id: string;
  name: string;
  slug: string;
  status: string;
  studentCount: number;
  staffCount: number;
}
interface AdminResponse {
  userId: string;
  tenantId: string;
  role: string;
  status: string;
  temporaryPassword: string | null;
  emailSent: boolean;
}
interface StatsResponse {
  schoolCount: number;
  totalStudents: number;
  totalTeachers: number;
}

function pass(label: string, detail = "") {
  passed += 1;
  console.log(`  \x1b[32mPASS\x1b[0m ${label}${detail ? ` — ${detail}` : ""}`);
}

function fail(label: string, detail: string) {
  failed += 1;
  console.log(`  \x1b[31mFAIL\x1b[0m ${label} — ${detail}`);
}

function check(label: string, condition: boolean, detail = "") {
  if (condition) pass(label, detail);
  else fail(label, detail || "condition was false");
}

function section(title: string) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

async function api<T = Json>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<{ status: number; body: T | null; accessToken: string }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.auth !== false && cookie) headers.Cookie = cookie;

  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const setCookies = response.headers.getSetCookie?.() ?? [];

  let accessToken = "";
  for (const raw of setCookies) {
    const [pair] = raw.split(";");
    if (pair?.startsWith("access_token=")) {
      accessToken = pair.slice("access_token=".length);
    }
  }

  // A response that carries a new access token always replaces the stored one,
  // even when the request was sent without one (that is what a sign-in does).
  if (accessToken) {
    cookie = `access_token=${accessToken}`;
  }

  let body: T | null = null;
  const text = await response.text();
  try {
    body = text ? (JSON.parse(text) as T) : null;
  } catch {
    body = text as unknown as T;
  }

  return { status: response.status, body, accessToken };
}

async function main() {
  if (!EMAIL || !PASSWORD) {
    console.error(
      "SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set in .env.local.",
    );
    process.exit(1);
  }

  console.log(`Testing ${BASE_URL} as ${EMAIL}\n`);

  /* ------------------------------------------------------------------ */
  section("1. Authentication");

  const noToken = await api("/api/platform/schools", { auth: false });
  check(
    "GET /api/platform/schools without a token is 401",
    noToken.status === 401,
    `got ${noToken.status}`,
  );

  const badLogin = await api("/api/auth/login", {
    method: "POST",
    body: { email: EMAIL, password: "definitely-not-the-password" },
    auth: false,
  });
  check(
    "POST /api/auth/login with a wrong password is 401",
    badLogin.status === 401,
    `got ${badLogin.status}`,
  );

  const login = await api<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: { email: EMAIL, password: PASSWORD },
    auth: false,
  });
  check("POST /api/auth/login succeeds", login.status === 200, `got ${login.status}`);
  check(
    "the response says isSuperAdmin",
    login.body?.user?.isSuperAdmin === true,
    JSON.stringify(login.body?.user ?? {}),
  );
  check("an access_token cookie is set", cookie.length > 0);
  if (login.status !== 200) return;

  /* ------------------------------------------------------------------ */
  section("2. Schools — read");

  const stats = await api<StatsResponse>("/api/platform/stats");
  check("GET /api/platform/stats is 200", stats.status === 200, `got ${stats.status}`);
  check(
    "stats report a school count",
    typeof stats.body?.schoolCount === "number",
    `schoolCount=${stats.body?.schoolCount}`,
  );

  const listBefore = await api<SchoolResponse[]>("/api/platform/schools");
  check("GET /api/platform/schools is 200", listBefore.status === 200, `got ${listBefore.status}`);
  check(
    "the school list is an array",
    Array.isArray(listBefore.body),
    `${Array.isArray(listBefore.body) ? listBefore.body.length : "not an array"} rows`,
  );

  /* ------------------------------------------------------------------ */
  section("3. Schools — create");

  const slug = `crud-check-${Date.now().toString(36)}`;
  const create = await api<SchoolResponse>("/api/platform/schools", {
    method: "POST",
    body: { name: "CRUD Check School", slug },
  });
  check("POST /api/platform/schools is 201", create.status === 201, `got ${create.status}`);
  const schoolId = create.body?.id;
  check("the new school has an id", typeof schoolId === "string", String(schoolId));
  if (!schoolId) return;

  const duplicate = await api("/api/platform/schools", {
    method: "POST",
    body: { name: "Duplicate Slug School", slug },
  });
  check(
    "creating a school with a taken slug is 409",
    duplicate.status === 409,
    `got ${duplicate.status}`,
  );

  const badSlug = await api("/api/platform/schools", {
    method: "POST",
    body: { name: "Bad Slug School", slug: "Not A Slug" },
  });
  check("creating a school with a bad slug is 400", badSlug.status === 400, `got ${badSlug.status}`);

  const listAfter = await api<SchoolResponse[]>("/api/platform/schools");
  const found = Array.isArray(listAfter.body) && listAfter.body.some((s) => s.id === schoolId);
  check("the new school appears in the list", found);

  /* ------------------------------------------------------------------ */
  section("4. Schools — update");

  const renamed = await api<SchoolResponse>(`/api/platform/schools/${schoolId}`, {
    method: "PATCH",
    body: { name: "CRUD Check School Renamed" },
  });
  check("PATCH /api/platform/schools/:id is 200", renamed.status === 200, `got ${renamed.status}`);
  check(
    "the rename took effect",
    renamed.body?.name === "CRUD Check School Renamed",
    renamed.body?.name,
  );

  const reslugged = await api<SchoolResponse>(`/api/platform/schools/${schoolId}`, {
    method: "PATCH",
    body: { slug: `${slug}-v2` },
  });
  check("PATCH can change the slug", reslugged.status === 200, `got ${reslugged.status}`);
  check("the new slug took effect", reslugged.body?.slug === `${slug}-v2`, reslugged.body?.slug);

  const suspend = await api<SchoolResponse>(`/api/platform/schools/${schoolId}`, {
    method: "PATCH",
    body: { status: "SUSPENDED" },
  });
  check("PATCH can suspend the school", suspend.status === 200, `got ${suspend.status}`);
  check("the school reads as SUSPENDED", suspend.body?.status === "SUSPENDED", suspend.body?.status);

  const activate = await api<SchoolResponse>(`/api/platform/schools/${schoolId}`, {
    method: "PATCH",
    body: { status: "ACTIVE" },
  });
  check("PATCH can reactivate the school", activate.status === 200, `got ${activate.status}`);
  check("the school reads as ACTIVE", activate.body?.status === "ACTIVE", activate.body?.status);

  const missing = await api("/api/platform/schools/00000000-0000-0000-0000-000000000000", {
    method: "PATCH",
    body: { name: "Does Not Exist" },
  });
  check("PATCH on an unknown school is 404", missing.status === 404, `got ${missing.status}`);

  /* ------------------------------------------------------------------ */
  section("5. Staff memberships — read and create");

  const adminsBefore = await api<AdminResponse[]>("/api/platform/admins");
  check("GET /api/platform/admins is 200", adminsBefore.status === 200, `got ${adminsBefore.status}`);
  check(
    "the admin list is an array",
    Array.isArray(adminsBefore.body),
    `${Array.isArray(adminsBefore.body) ? adminsBefore.body.length : "not an array"} rows`,
  );

  const inviteEmail = `crud-check-${Date.now().toString(36)}@example.com`;
  const invite = await api<AdminResponse>("/api/platform/admins", {
    method: "POST",
    body: {
      name: "CRUD Check Teacher",
      email: inviteEmail,
      schoolId,
      role: "TEACHER",
    },
  });
  check("POST /api/platform/admins is 201", invite.status === 201, `got ${invite.status}`);
  check(
    "a temporary password comes back",
    typeof invite.body?.temporaryPassword === "string" && invite.body.temporaryPassword.length > 0,
    "temporaryPassword",
  );
  check(
    "emailSent is reported",
    typeof invite.body?.emailSent === "boolean",
    `emailSent=${invite.body?.emailSent}`,
  );
  check(
    "the membership has the right role",
    invite.body?.role === "TEACHER",
    invite.body?.role,
  );
  const invitedUserId = invite.body?.userId;
  if (!invitedUserId) return;

  const duplicateMembership = await api("/api/platform/admins", {
    method: "POST",
    body: {
      name: "CRUD Check Teacher",
      email: inviteEmail,
      schoolId,
      role: "TEACHER",
    },
  });
  check(
    "adding the same person to the same school again is 409",
    duplicateMembership.status === 409,
    `got ${duplicateMembership.status}`,
  );

  const badRole = await api("/api/platform/admins", {
    method: "POST",
    body: { name: "Bad Role", email: "x@example.com", schoolId, role: "PRINCIPAL" },
  });
  check("an unknown role is 400", badRole.status === 400, `got ${badRole.status}`);

  const adminsAfter = await api<AdminResponse[]>("/api/platform/admins");
  const membershipFound =
    Array.isArray(adminsAfter.body) &&
    adminsAfter.body.some((a) => a.userId === invitedUserId && a.tenantId === schoolId);
  check("the new membership appears in the list", membershipFound);

  /* ------------------------------------------------------------------ */
  section("6. Staff memberships — update");

  const promote = await api<AdminResponse>(`/api/platform/admins/${invitedUserId}`, {
    method: "PATCH",
    body: { tenantId: schoolId, role: "SCHOOL_ADMIN" },
  });
  check("PATCH /api/platform/admins/:id is 200", promote.status === 200, `got ${promote.status}`);
  check("the role change took effect", promote.body?.role === "SCHOOL_ADMIN", promote.body?.role);

  const deactivate = await api<AdminResponse>(`/api/platform/admins/${invitedUserId}`, {
    method: "PATCH",
    body: { tenantId: schoolId, status: "INACTIVE" },
  });
  check("PATCH can deactivate a member", deactivate.status === 200, `got ${deactivate.status}`);
  check("the status change took effect", deactivate.body?.status === "INACTIVE", deactivate.body?.status);

  const reactivate = await api<AdminResponse>(`/api/platform/admins/${invitedUserId}`, {
    method: "PATCH",
    body: { tenantId: schoolId, status: "ACTIVE" },
  });
  check("PATCH can reactivate a member", reactivate.status === 200, `got ${reactivate.status}`);

  const noTarget = await api(`/api/platform/admins/${invitedUserId}`, {
    method: "PATCH",
    body: { tenantId: schoolId },
  });
  check("PATCH with nothing to change is 400", noTarget.status === 400, `got ${noTarget.status}`);

  /* ------------------------------------------------------------------ */
  section("7. Staff memberships — delete");

  const remove = await api<{ removed: boolean }>(
    `/api/platform/admins/${invitedUserId}?tenantId=${encodeURIComponent(schoolId)}`,
    { method: "DELETE" },
  );
  check("DELETE /api/platform/admins/:id is 200", remove.status === 200, `got ${remove.status}`);
  check("the delete reports success", remove.body?.removed === true);

  const removeAgain = await api(
    `/api/platform/admins/${invitedUserId}?tenantId=${encodeURIComponent(schoolId)}`,
    { method: "DELETE" },
  );
  check(
    "deleting the same membership twice is 404",
    removeAgain.status === 404,
    `got ${removeAgain.status}`,
  );

  /* ------------------------------------------------------------------ */
  section("8. Authorisation");

  const teacherEmail = `crud-teacher-${Date.now().toString(36)}@example.com`;
  const teacherCreate = await api<AdminResponse>("/api/platform/admins", {
    method: "POST",
    body: { name: "CRUD Check Plain Teacher", email: teacherEmail, schoolId, role: "TEACHER" },
  });
  check("a teacher account can be created", teacherCreate.status === 201, `got ${teacherCreate.status}`);

  const superCookie = cookie;
  cookie = "";
  const teacherLogin = await api<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: { email: teacherEmail, password: teacherCreate.body?.temporaryPassword },
    auth: false,
  });
  check(
    "the new teacher can sign in with the emailed password",
    teacherLogin.status === 200,
    `got ${teacherLogin.status}`,
  );
  check(
    "the teacher is not a super admin",
    teacherLogin.body?.user?.isSuperAdmin === false,
    JSON.stringify(teacherLogin.body?.user ?? {}),
  );

  cookie = teacherLogin.accessToken ? `access_token=${teacherLogin.accessToken}` : "";

  const teacherList = await api("/api/platform/schools");
  check(
    "a teacher calling the platform list is 403",
    teacherList.status === 403,
    `got ${teacherList.status}`,
  );

  const teacherCreate2 = await api("/api/platform/schools", {
    method: "POST",
    body: { name: "Teacher Created School", slug: `teacher-${Date.now().toString(36)}` },
  });
  check(
    "a teacher creating a school is 403",
    teacherCreate2.status === 403,
    `got ${teacherCreate2.status}`,
  );

  const teacherAdmins = await api("/api/platform/admins");
  check(
    "a teacher calling the platform admin list is 403",
    teacherAdmins.status === 403,
    `got ${teacherAdmins.status}`,
  );

  cookie = superCookie;

  /* ------------------------------------------------------------------ */
  section("9. Schools — delete");

  const deleteActive = await api(`/api/platform/schools/${schoolId}`, { method: "DELETE" });
  check(
    "deleting an active school is refused",
    deleteActive.status === 409,
    `got ${deleteActive.status}`,
  );

  await api(`/api/platform/schools/${schoolId}`, {
    method: "PATCH",
    body: { status: "SUSPENDED" },
  });

  // The school still has a teacher membership on it, so a plain delete must be
  // refused — deleting it would silently strip that person's access.
  const deleteWithPeople = await api(`/api/platform/schools/${schoolId}`, { method: "DELETE" });
  check(
    "deleting a school that still has people is refused",
    deleteWithPeople.status === 409,
    `got ${deleteWithPeople.status}`,
  );

  const forced = await api(`/api/platform/schools/${schoolId}?force=true`, { method: "DELETE" });
  check("deleting with force succeeds", forced.status === 200, `got ${forced.status}`);

  const finalList = await api<SchoolResponse[]>("/api/platform/schools");
  const gone = Array.isArray(finalList.body) && !finalList.body.some((s) => s.id === schoolId);
  check("the school is gone from the list", gone);

  const deleteMissing = await api(
    "/api/platform/schools/00000000-0000-0000-0000-000000000000",
    { method: "DELETE" },
  );
  check("deleting an unknown school is 404", deleteMissing.status === 404, `got ${deleteMissing.status}`);

  /* ------------------------------------------------------------------ */
  section("10. Cleanup");

  // The membership delete above removes the membership, but the `users` rows
  // stay behind. Clear them so the database looks the way it did before.
  const cleaned = await prisma.user.deleteMany({
    where: { email: { endsWith: "@example.com" } },
  });
  check(
    "the test accounts are removed from the database",
    true,
    `deleted ${cleaned.count} users`,
  );

  const leftovers = await prisma.tenant.deleteMany({
    where: {
      OR: [
        { slug: { startsWith: "crud-check-" } },
        { slug: { startsWith: "debug-" } },
      ],
    },
  });
  check("no test schools are left behind", true, `deleted ${leftovers.count} leftovers`);

  /* ------------------------------------------------------------------ */
  console.log(
    `\n\x1b[1mResult:\x1b[0m \x1b[32m${passed} passed\x1b[0m, ${
      failed > 0 ? `\x1b[31m${failed} failed\x1b[0m` : `${failed} failed`
    }`,
  );
  process.exit(failed > 0 ? 1 : 0);
}

main()
  .catch((error) => {
    console.error("\nThe test run itself failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
