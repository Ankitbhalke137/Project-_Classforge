/**
 * End-to-end check for the two flows added with the first-login password change:
 *
 *   1. A credentials account issued a temporary password is told
 *      `mustChangePassword: true`, and the flag clears only after a real
 *      password change.
 *   2. Fee invoices live in Postgres, are scoped by the session, and payment
 *      recording cannot overpay an invoice.
 *
 * Run against a server (default http://localhost:3000):
 *
 *   npm run test:fees
 *   BASE_URL=http://localhost:3100 npm run test:fees
 *
 * It creates one throwaway school, two users and one student, then removes all
 * of them in a `finally` block so the database is left as it was found.
 */
import { loadEnvFile } from "node:process";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

// Next loads .env.local; the Prisma CLI config only reads .env. Match the app.
loadEnvFile(".env.local");

const prisma = new PrismaClient();
const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

const suffix = randomBytes(4).toString("hex");
const slug = `test-fees-${suffix}`;
const adminEmail = `fees.admin.${suffix}@example.com`;
const parentEmail = `fees.parent.${suffix}@example.com`;
const temporaryPassword = "TempPass123!";
const newPassword = "ChangedPass456!";

let tenantId: string | undefined;
let adminId: string | undefined;
let parentId: string | undefined;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function cookieFrom(response: Response): string {
  const raw = response.headers.getSetCookie();
  assert(raw.length > 0, "The server did not set a session cookie.");
  return raw.map((value) => value.split(";")[0]).join("; ");
}

async function request(
  path: string,
  options: { method?: string; body?: unknown; cookie?: string } = {},
) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.cookie ? { Cookie: options.cookie } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

async function main() {
  // ---------------------------------------------------------------- fixtures
  const tenant = await prisma.tenant.create({
    data: { name: `Fee Test ${suffix}`, slug },
  });
  tenantId = tenant.id;

  const admin = await prisma.user.create({
    data: {
      name: "Fee Test Admin",
      email: adminEmail,
      passwordHash: await hash(temporaryPassword, 10),
      mustChangePassword: true,
    },
  });
  adminId = admin.id;

  await prisma.membership.create({
    data: { tenantId, userId: admin.id, role: "SCHOOL_ADMIN" },
  });

  const parent = await prisma.user.create({
    data: {
      name: "Fee Test Parent",
      email: parentEmail,
      passwordHash: await hash(newPassword, 10),
    },
  });
  parentId = parent.id;
  await prisma.membership.create({
    data: { tenantId, userId: parent.id, role: "PARENT" },
  });

  const year = await prisma.academicYear.create({
    data: {
      tenantId,
      name: "2026-27",
      startDate: new Date("2026-06-01"),
      endDate: new Date("2027-03-31"),
      status: "ACTIVE",
    },
  });
  await prisma.academicTerm.create({
    data: {
      tenantId,
      academicYearId: year.id,
      label: "Term 1",
      startDate: new Date("2026-06-01"),
      endDate: new Date("2026-09-30"),
      position: 1,
    },
  });
  const schoolClass = await prisma.schoolClass.create({
    data: { tenantId, academicYearId: year.id, name: "Grade 8" },
  });
  const section = await prisma.section.create({
    data: { tenantId, classId: schoolClass.id, name: "A" },
  });
  const student = await prisma.student.create({
    data: {
      tenantId,
      firstName: "Meera",
      lastName: "Kapoor",
      admissionNo: `ADM-${suffix}`,
      status: "ACTIVE",
    },
  });
  await prisma.enrolment.create({
    data: {
      tenantId,
      studentId: student.id,
      sectionId: section.id,
      academicYearId: year.id,
      status: "ACTIVE",
    },
  });

  // ------------------------------------------------- 1. first-login password
  const login = await request("/api/auth/login", {
    method: "POST",
    body: { email: adminEmail, password: temporaryPassword },
  });
  assert(login.response.ok, `Login failed: ${login.response.status} ${JSON.stringify(login.payload)}`);
  assert(login.payload.user.mustChangePassword === true, "Login did not return mustChangePassword: true");
  let cookie = cookieFrom(login.response);

  const meBefore = await request("/api/auth/me", { cookie });
  assert(meBefore.response.ok, "GET /api/auth/me failed.");
  assert(meBefore.payload.user.mustChangePassword === true, "GET /me did not return the first-login flag.");

  const blocked = await request(`/api/t/${slug}/fees`, { cookie });
  assert(blocked.response.status === 403, "A temporary-password session reached a school endpoint.");

  const weak = await request("/api/auth/change-password", {
    method: "POST",
    cookie,
    body: { currentPassword: temporaryPassword, newPassword: "short", confirmPassword: "short" },
  });
  assert(weak.response.status === 400, "A short new password was accepted.");
  assert(Boolean(weak.payload.fields?.newPassword), "Short password did not return a field error.");

  const changed = await request("/api/auth/change-password", {
    method: "POST",
    cookie,
    body: {
      currentPassword: temporaryPassword,
      newPassword,
      confirmPassword: newPassword,
    },
  });
  assert(changed.response.ok, `Password change failed: ${JSON.stringify(changed.payload)}`);
  cookie = cookieFrom(changed.response);

  const meAfter = await request("/api/auth/me", { cookie });
  assert(meAfter.payload.user.mustChangePassword === false, "The flag did not clear after changing the password.");

  const oldLogin = await request("/api/auth/login", {
    method: "POST",
    body: { email: adminEmail, password: temporaryPassword },
  });
  assert(oldLogin.response.status === 401, "The temporary password still works after the change.");

  const freshLogin = await request("/api/auth/login", {
    method: "POST",
    body: { email: adminEmail, password: newPassword },
  });
  assert(freshLogin.response.ok, "Login with the new password failed.");
  cookie = cookieFrom(freshLogin.response);

  // --------------------------------------------------------- 2. fee backend
  const unauthorised = await request(`/api/t/${slug}/fees`);
  assert(unauthorised.response.status === 401, "The fees endpoint answered without a session.");

  const invalid = await request(`/api/t/${slug}/fees`, {
    method: "POST",
    cookie,
    body: { studentId: student.id, feeType: "Tuition", term: "Term 1", amount: 0, dueDate: "2026-07-01" },
  });
  assert(invalid.response.status === 400, "A zero-value invoice was accepted.");
  assert(Boolean(invalid.payload.fields?.amount), "Zero amount did not return a field error.");

  const created = await request(`/api/t/${slug}/fees`, {
    method: "POST",
    cookie,
    body: {
      studentId: student.id,
      feeType: "Tuition",
      term: "Term 1",
      amount: 15000,
      dueDate: "2027-01-15",
    },
  });
  assert(created.response.status === 201, `Invoice create failed: ${JSON.stringify(created.payload)}`);
  assert(created.payload.invoiceNo?.startsWith("INV-"), "Invoice number was not generated.");
  assert(created.payload.status === "PENDING", "A future invoice was not PENDING.");
  const invoiceId = created.payload.id as string;

  const list = await request(`/api/t/${slug}/fees?search=Meera`, { cookie });
  assert(list.response.ok, "Fee list failed.");
  assert(list.payload.total === 1, `Expected one invoice, got ${list.payload.total}.`);
  assert(list.payload.data[0].className === "Grade 8 - A", "The invoice did not carry the student's class.");

  const summaryBefore = await request(`/api/t/${slug}/fees/summary`, { cookie });
  assert(summaryBefore.payload.totalBilled === 15000, "Summary totalBilled is wrong.");
  assert(summaryBefore.payload.outstanding === 15000, "Summary outstanding is wrong.");

  const part = await request(`/api/t/${slug}/fees/${invoiceId}`, {
    method: "PATCH",
    cookie,
    body: { amount: 5000 },
  });
  assert(part.response.ok, `Partial payment failed: ${JSON.stringify(part.payload)}`);
  assert(part.payload.status === "PARTIAL", "A partial payment was not marked PARTIAL.");
  assert(part.payload.amountPaid === 5000, "Partial payment was not stored.");

  const overpay = await request(`/api/t/${slug}/fees/${invoiceId}`, {
    method: "PATCH",
    cookie,
    body: { amount: 20000 },
  });
  assert(overpay.response.status === 400, "An overpayment was accepted.");
  assert(Boolean(overpay.payload.fields?.amount), "Overpayment did not return a field error.");

  const paid = await request(`/api/t/${slug}/fees/${invoiceId}`, {
    method: "PATCH",
    cookie,
    body: { amount: 10000 },
  });
  assert(paid.response.ok, "Final payment failed.");
  assert(paid.payload.status === "PAID", "A fully paid invoice was not marked PAID.");
  assert(paid.payload.paidAt !== null, "A paid invoice has no paidAt timestamp.");

  const summaryAfter = await request(`/api/t/${slug}/fees/summary`, { cookie });
  assert(summaryAfter.payload.totalCollected === 15000, "Summary totalCollected is wrong.");
  assert(summaryAfter.payload.outstanding === 0, "Summary outstanding should be zero.");
  assert(summaryAfter.payload.collectionRate === 100, "Collection rate should be 100.");

  // A parent must not see the school's ledger through the same endpoint.
  const parentLogin = await request("/api/auth/login", {
    method: "POST",
    body: { email: parentEmail, password: newPassword },
  });
  assert(parentLogin.response.ok, "Parent login failed.");
  const parentCookie = cookieFrom(parentLogin.response);
  const parentFees = await request(`/api/t/${slug}/fees`, { cookie: parentCookie });
  assert(parentFees.response.ok, "Parent fee list failed.");
  assert(parentFees.payload.total === 0, "A parent saw invoices that are not theirs.");

  const parentWrite = await request(`/api/t/${slug}/fees`, {
    method: "POST",
    cookie: parentCookie,
    body: { studentId: student.id, feeType: "Tuition", term: "Term 1", amount: 1, dueDate: "2027-01-15" },
  });
  assert(parentWrite.response.status === 403, "A parent was allowed to raise an invoice.");

  console.log("PASS  first-login password flag, change flow and field validation");
  console.log("PASS  fee create/list/summary, partial and full payment, overpay rejection");
  console.log("PASS  session-scoped fee reads and write authorisation");
}

async function cleanup() {
  if (tenantId) await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});
  const ids = [adminId, parentId].filter((id): id is string => Boolean(id));
  if (ids.length) {
    await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(() => {});
  }
}

main()
  .catch((error) => {
    console.error("FAIL ", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
  });
