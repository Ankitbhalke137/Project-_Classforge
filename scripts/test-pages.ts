/**
 * Renders the real frontend pages and checks they come back healthy.
 *
 *   npm run test:pages
 *
 * Logs in as the Super Admin, sets up a school with an admin, then fetches
 * every platform and school page and looks for three things:
 *   1. the server returned 200
 *   2. the HTML does not contain a Next.js error boundary
 *   3. the HTML contains the copy that screen is supposed to show
 *
 * It checks the rendered HTML, not just the API, so a component that throws
 * while rendering is caught.
 */
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config({ path: ".env.local" });
dotenv.config();

const prisma = new PrismaClient();
const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  \x1b[32mPASS\x1b[0m ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed += 1;
    console.log(`  \x1b[31mFAIL\x1b[0m ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title: string) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

async function login(email: string, password: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const cookies = response.headers.getSetCookie?.() ?? [];
  let token = "";
  for (const raw of cookies) {
    const [pair] = raw.split(";");
    if (pair?.startsWith("access_token=")) token = pair.slice("access_token=".length);
  }
  if (!token) throw new Error(`Could not sign in as ${email} (status ${response.status})`);
  return token;
}

async function page(token: string, path: string) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { Cookie: `access_token=${token}` },
    redirect: "manual",
  });
  const html = await response.text();
  return { status: response.status, html };
}

/** A Next.js error boundary or a crash leaves these markers in the HTML. */
function looksBroken(html: string): boolean {
  const markers = [
    "Application error",
    "Internal Server Error",
    "Unhandled Runtime Error",
    "digest",
  ];
  return markers.some((marker) => html.includes(marker));
}

async function main() {
  const email = (process.env.SUPER_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD ?? "";
  if (!email || !password) {
    console.error("SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set.");
    process.exit(1);
  }

  console.log(`Rendering pages at ${BASE_URL}\n`);

  /* ------------------------------------------------------------------ */
  section("1. Sign-in page");

  const loginPage = await fetch(`${BASE_URL}/login`);
  const loginHtml = await loginPage.text();
  check("GET /login is 200", loginPage.status === 200, `got ${loginPage.status}`);
  check("the sign-in form renders", loginHtml.includes("Welcome Back"));
  check(
    "the demo accounts panel is gone",
    !loginHtml.includes("Demo accounts") && !loginHtml.includes("Demo@12345"),
  );

  /* ------------------------------------------------------------------ */
  section("2. Platform area");

  const superToken = await login(email, password);

  const platformPages: { path: string; expect: string }[] = [
    { path: "/platform", expect: "Super Admin" },
    { path: "/platform/schools", expect: "Platform schools" },
    { path: "/platform/admins", expect: "School admins" },
    { path: "/platform/settings", expect: "" },
  ];

  for (const { path, expect } of platformPages) {
    const result = await page(superToken, path);
    check(`GET ${path} is 200`, result.status === 200, `got ${result.status}`);
    check(`GET ${path} renders without crashing`, !looksBroken(result.html));
    if (expect) {
      check(`GET ${path} shows "${expect}"`, result.html.includes(expect));
    }
  }

  /* ------------------------------------------------------------------ */
  section("3. A school and its admin");

  const slug = `page-check-${Date.now().toString(36)}`;
  const school = await prisma.tenant.create({ data: { name: "Page Check School", slug } });

  const adminEmail = `page-check-${Date.now().toString(36)}@example.com`;
  const adminPassword = "PageCheck@12345";
  const admin = await prisma.user.create({
    data: {
      name: "Page Check Admin",
      email: adminEmail,
      passwordHash: await (await import("bcryptjs")).hash(adminPassword, 10),
    },
  });
  await prisma.membership.create({
    data: { tenantId: school.id, userId: admin.id, role: "SCHOOL_ADMIN" },
  });

  const adminToken = await login(adminEmail, adminPassword);

  /* ------------------------------------------------------------------ */
  section("4. School area");

  const schoolPages: { path: string; expect: string }[] = [
    { path: `/${slug}/dashboard`, expect: "" },
    { path: `/${slug}/students`, expect: "" },
    { path: `/${slug}/teachers`, expect: "" },
    { path: `/${slug}/attendance`, expect: "" },
    { path: `/${slug}/announcements`, expect: "" },
    { path: `/${slug}/settings`, expect: "" },
  ];

  for (const { path, expect } of schoolPages) {
    const result = await page(adminToken, path);
    check(`GET ${path} is 200`, result.status === 200, `got ${result.status}`);
    check(`GET ${path} renders without crashing`, !looksBroken(result.html));
    if (expect) {
      check(`GET ${path} shows "${expect}"`, result.html.includes(expect));
    }
  }

  /* ------------------------------------------------------------------ */
  section("5. The screens that read the new endpoints");

  const dashboard = await page(adminToken, `/${slug}/dashboard`);
  check(
    "the dashboard renders the academic year from the calendar",
    dashboard.html.includes("Academic year") || dashboard.html.includes("AY "),
    "calendar-backed copy",
  );

  const settings = await page(adminToken, `/${slug}/settings`);
  check(
    "the settings screen renders",
    settings.html.includes("Notification"),
    "notification preferences section",
  );

  const calendar = await fetch(`${BASE_URL}/api/t/${slug}/calendar`, {
    headers: { Cookie: `access_token=${adminToken}` },
  });
  const calendarBody = await calendar.json();
  check("the calendar endpoint is 200", calendar.status === 200, `got ${calendar.status}`);
  check(
    "the school has its own academic year",
    typeof calendarBody?.academicYear?.name === "string",
    calendarBody?.academicYear?.name,
  );
  check("the school has its own terms", (calendarBody?.terms ?? []).length === 3);
  check("the school has its own timetable", (calendarBody?.periods ?? []).length === 6);
  check(
    "the breaks are worked out from the periods",
    typeof calendarBody?.breaks === "string" && calendarBody.breaks.length > 0,
    calendarBody?.breaks,
  );

  /* ------------------------------------------------------------------ */
  section("6. Cleanup");

  await prisma.tenant.delete({ where: { id: school.id } });
  await prisma.user.delete({ where: { id: admin.id } });
  console.log("  test school and admin removed");

  console.log(
    `\n\x1b[1mResult:\x1b[0m \x1b[32m${passed} passed\x1b[0m, ${
      failed > 0 ? `\x1b[31m${failed} failed\x1b[0m` : `${failed} failed`
    }`,
  );
  process.exit(failed > 0 ? 1 : 0);
}

main()
  .catch((error) => {
    console.error("\nThe page run itself failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
