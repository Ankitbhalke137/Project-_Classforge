import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

config({ path: ".env.local" });

const prisma = new PrismaClient();
const BASE = process.env.PROBE_BASE_URL ?? "http://localhost:3000";
const stamp = Date.now().toString(36);
const adminEmail = `superadminclassforge+section${stamp}@gmail.com`;
const schoolSlug = `probe-section-${stamp}`;

let pass = 0;
let fail = 0;

function check(ok: unknown, label: string, detail?: unknown) {
  if (ok) {
    pass += 1;
    console.log(`  ok  ${label}`);
  } else {
    fail += 1;
    console.error(`FAIL  ${label}`, detail !== undefined ? JSON.stringify(detail).slice(0, 500) : "");
  }
}

async function call(path: string, options: { method?: string; body?: unknown; cookie?: string } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.cookie ? { cookie: options.cookie } : {}),
      ...(options.body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null), setCookie: res.headers.getSetCookie?.() ?? [] };
}

async function login(email: string, password: string) {
  const result = await call("/api/auth/login", { method: "POST", body: { email, password } });
  return {
    status: result.status,
    cookie: result.setCookie.map((value) => value.split(";")[0]).join("; "),
  };
}

async function main() {
  const superEmail = process.env.SUPER_ADMIN_EMAIL;
  const superPassword = process.env.SUPER_ADMIN_PASSWORD;
  if (!superEmail || !superPassword) throw new Error("Super admin env missing");

  const superLogin = await login(superEmail, superPassword);
  check(superLogin.status === 200, "super admin login", superLogin.status);

  const school = await call("/api/platform/schools", {
    method: "POST",
    cookie: superLogin.cookie,
    body: { name: `Probe Section ${stamp}`, slug: schoolSlug },
  });
  check(school.status === 201, "create probe school", school.data);
  const schoolId = school.data?.id;

  const admin = await call("/api/platform/admins", {
    method: "POST",
    cookie: superLogin.cookie,
    body: { name: "Section Admin", email: adminEmail, schoolId, role: "SCHOOL_ADMIN" },
  });
  check(admin.status === 201 && Boolean(admin.data?.temporaryPassword), "create probe admin", admin.data);

  const adminLogin = await login(adminEmail, admin.data.temporaryPassword);
  check(adminLogin.status === 200, "admin login", adminLogin.status);

  const year = await call(`/api/t/${schoolSlug}/academic-years`, {
    method: "POST",
    cookie: adminLogin.cookie,
    body: { name: "2026–27", startDate: "2026-04-01", endDate: "2027-03-31", status: "ACTIVE" },
  });
  check(year.status === 201, "create active year", year.data);

  const createdClass = await call(`/api/t/${schoolSlug}/classes`, {
    method: "POST",
    cookie: adminLogin.cookie,
    body: { name: "Grade 6", academicYearId: year.data.id, room: "101", capacity: 40, sections: ["A"] },
  });
  check(createdClass.status === 201, "create class with section A", createdClass.data);
  const classId = createdClass.data?.id;

  const createdSection = await call(`/api/t/${schoolSlug}/classes/${classId}/sections`, {
    method: "POST",
    cookie: adminLogin.cookie,
    body: { name: "B" },
  });
  check(createdSection.status === 201 && createdSection.data?.name === "B", "create additional section B", createdSection.data);

  const duplicate = await call(`/api/t/${schoolSlug}/classes/${classId}/sections`, {
    method: "POST",
    cookie: adminLogin.cookie,
    body: { name: "B" },
  });
  check(duplicate.status === 409, "duplicate section rejected", duplicate.data);

  const list = await call(`/api/t/${schoolSlug}/classes`, { cookie: adminLogin.cookie });
  check(
    list.status === 200 && list.data?.length === 2 && list.data.every((row: { classId: string }) => row.classId === classId),
    "class list shows both sections",
    list.data,
  );

  const teacherCannotCreateClass = await call(`/api/t/${schoolSlug}/classes`, {
    method: "POST",
    cookie: adminLogin.cookie,
    body: { name: "Nope" },
  });
  // This checks the shape of the route, not a teacher session: a second class
  // without an active year/name should fail validation, not silently create.
  check(teacherCannotCreateClass.status === 400, "invalid class payload rejected", teacherCannotCreateClass.data);
}

main()
  .catch((error) => {
    fail += 1;
    console.error("PROBE CRASH", error);
  })
  .finally(async () => {
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: "probe-section-" } } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { email: adminEmail } }).catch(() => undefined);
    await prisma.$disconnect();
    console.log(`\nResult: ${pass} passed, ${fail} failed`);
    process.exit(fail > 0 ? 1 : 0);
  });
