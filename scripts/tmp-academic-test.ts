import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

config({ path: ".env.local" });

const prisma = new PrismaClient();
const BASE = process.env.PROBE_BASE_URL ?? "http://localhost:3000";
const stamp = Date.now().toString(36);
const suffix = `${stamp}@gmail.com`;
const emails = {
  admin: `superadminclassforge+acad${suffix}`,
  teacher: `superadminclassforge+acadt${suffix}`,
  student: `superadminclassforge+acads${suffix}`,
};

let pass = 0;
let fail = 0;

function assert(condition: unknown, label: string, detail?: unknown) {
  if (condition) {
    pass += 1;
    console.log(`  ok  ${label}`);
    return;
  }
  fail += 1;
  console.error(`FAIL  ${label}`);
  if (detail !== undefined) console.error("      ", JSON.stringify(detail).slice(0, 600));
}

async function call(
  path: string,
  options: { method?: string; body?: unknown; cookie?: string } = {},
): Promise<{ status: number; data: any; cookie: string }> {
  const method = options.method ?? "GET";
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(options.cookie ? { cookie: options.cookie } : {}),
      ...(options.body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => null);
  const setCookies = res.headers.getSetCookie?.() ?? [];
  return {
    status: res.status,
    data,
    cookie: setCookies.map((value) => value.split(";")[0]).join("; "),
  };
}

async function login(email: string, password: string) {
  const result = await call("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  assert(result.status === 200, `login ${email}`, result.data);
  return result.cookie;
}

async function main() {
  console.log(`Academic probe → ${BASE}`);

  const superEmail = process.env.SUPER_ADMIN_EMAIL;
  const superPassword = process.env.SUPER_ADMIN_PASSWORD;
  if (!superEmail || !superPassword) throw new Error("Super admin env missing");

  const superCookie = await login(superEmail, superPassword);

  const schoolSlug = `probe-acad-${stamp}`;
  const school = await call("/api/platform/schools", {
    method: "POST",
    cookie: superCookie,
    body: { name: `Probe Academy ${stamp}`, slug: schoolSlug },
  });
  assert(school.status === 201, "create probe school", school.data);
  const schoolId: string = school.data?.id;

  const admin = await call("/api/platform/admins", {
    method: "POST",
    cookie: superCookie,
    body: {
      name: "Probe Academic Admin",
      email: emails.admin,
      schoolId,
      role: "SCHOOL_ADMIN",
    },
  });
  assert(admin.status === 201 && Boolean(admin.data?.temporaryPassword), "create probe admin", admin.data);

  const adminCookie = await login(emails.admin, admin.data.temporaryPassword);

  /* --- Years + terms ------------------------------------------------ */

  const year = await call(`/api/t/${schoolSlug}/academic-years`, {
    method: "POST",
    cookie: adminCookie,
    body: { name: "2026–27", startDate: "2026-04-01", endDate: "2027-03-31", status: "ACTIVE" },
  });
  assert(year.status === 201 && year.data?.status === "ACTIVE", "create active year", year.data);

  const term = await call(`/api/t/${schoolSlug}/terms`, {
    method: "POST",
    cookie: adminCookie,
    body: {
      academicYearId: year.data.id,
      label: "Term 1",
      startDate: "2026-04-01",
      endDate: "2026-09-30",
    },
  });
  assert(term.status === 201 && term.data?.label === "Term 1", "create term", term.data);

  const duplicateTerm = await call(`/api/t/${schoolSlug}/terms`, {
    method: "POST",
    cookie: adminCookie,
    body: {
      academicYearId: year.data.id,
      label: "Term 1",
      startDate: "2026-04-01",
      endDate: "2026-09-30",
    },
  });
  assert(duplicateTerm.status === 409, "duplicate term rejected", duplicateTerm.data);

  /* --- Timetable periods -------------------------------------------- */

  const period1 = await call(`/api/t/${schoolSlug}/timetable-periods`, {
    method: "POST",
    cookie: adminCookie,
    body: { period: 1, startTime: "08:00", endTime: "08:45" },
  });
  assert(period1.status === 201, "create period 1", period1.data);

  const period2 = await call(`/api/t/${schoolSlug}/timetable-periods`, {
    method: "POST",
    cookie: adminCookie,
    body: { period: 2, startTime: "08:50", endTime: "09:35" },
  });
  assert(period2.status === 201, "create period 2", period2.data);

  /* --- Class + sections --------------------------------------------- */

  const created = await call(`/api/t/${schoolSlug}/classes`, {
    method: "POST",
    cookie: adminCookie,
    body: {
      name: "Grade 6",
      academicYearId: year.data.id,
      room: "101",
      capacity: 40,
      sections: ["A", "B"],
    },
  });
  assert(created.status === 201, "create class with two sections", created.data);

  const classList = await call(`/api/t/${schoolSlug}/classes`, { cookie: adminCookie });
  assert(classList.status === 200 && classList.data.length === 2, "list class sections", classList.data);
  const sectionA = classList.data.find((row: any) => row.section === "A");
  const sectionB = classList.data.find((row: any) => row.section === "B");
  assert(Boolean(sectionA?.classId), "rows carry parent classId", sectionA);
  assert(sectionA?.room === "101" && sectionA?.capacity === 40, "room + capacity persisted", sectionA);
  assert(sectionA?.name === "Grade 6 - A", "display name includes section", sectionA);

  /* --- Subjects ------------------------------------------------------ */

  const maths = await call(`/api/t/${schoolSlug}/subjects`, {
    method: "POST",
    cookie: adminCookie,
    body: { classId: sectionA.classId, name: "Mathematics", code: "MATH" },
  });
  assert(maths.status === 201, "create subject", maths.data);

  const subjectList = await call(`/api/t/${schoolSlug}/subjects`, { cookie: adminCookie });
  assert(
    subjectList.status === 200 &&
      subjectList.data.length === 1 &&
      subjectList.data[0].className === "Grade 6",
    "list subjects with class name",
    subjectList.data,
  );

  /* --- Teacher + assignment ----------------------------------------- */

  const teacher = await call(`/api/t/${schoolSlug}/teachers`, {
    method: "POST",
    cookie: adminCookie,
    body: {
      firstName: "Probe",
      lastName: "Teacher",
      email: emails.teacher,
      qualification: "M.Sc",
      designation: "Subject teacher",
    },
  });
  assert(
    teacher.status === 201 && Boolean(teacher.data?.teacher?.id),
    "create teacher",
    teacher.data,
  );
  const teacherId = teacher.data.teacher.id;

  const assignment = await call(`/api/t/${schoolSlug}/teaching-assignments`, {
    method: "POST",
    cookie: adminCookie,
    body: { teacherId, sectionId: sectionA.id, subjectId: maths.data.id },
  });
  assert(assignment.status === 201, "assign teacher to subject", assignment.data);

  const assignmentList = await call(
    `/api/t/${schoolSlug}/teaching-assignments?sectionId=${sectionA.id}`,
    { cookie: adminCookie },
  );
  assert(
    assignmentList.status === 200 &&
      assignmentList.data.length === 1 &&
      assignmentList.data[0].teacherName === "Probe Teacher",
    "list teaching assignments",
    assignmentList.data,
  );

  /* --- Timetable ----------------------------------------------------- */

  const saveSlots = await call(`/api/t/${schoolSlug}/classes/${sectionA.id}/timetable`, {
    method: "PUT",
    cookie: adminCookie,
    body: {
      slots: [
        { day: "MONDAY", period: 1, subjectId: maths.data.id, teacherId },
        { day: "WEDNESDAY", period: 2, subjectId: maths.data.id, teacherId },
      ],
    },
  });
  assert(saveSlots.status === 200 && saveSlots.data.length === 2, "save timetable", saveSlots.data);

  const readSlots = await call(`/api/t/${schoolSlug}/classes/${sectionA.id}/timetable`, {
    cookie: adminCookie,
  });
  assert(
    readSlots.status === 200 &&
      readSlots.data.length === 2 &&
      readSlots.data.every((slot: any) => slot.subjectId === maths.data.id),
    "read timetable",
    readSlots.data,
  );

  const unknownSubject = await call(`/api/t/${schoolSlug}/classes/${sectionB.id}/timetable`, {
    method: "PUT",
    cookie: adminCookie,
    body: {
      slots: [{ day: "MONDAY", period: 1, subjectId: crypto.randomUUID(), teacherId }],
    },
  });
  assert(unknownSubject.status === 400, "unknown subject rejected", unknownSubject.data);

  const duplicateSlot = await call(`/api/t/${schoolSlug}/classes/${sectionA.id}/timetable`, {
    method: "PUT",
    cookie: adminCookie,
    body: {
      slots: [
        { day: "MONDAY", period: 1, subjectId: maths.data.id, teacherId },
        { day: "MONDAY", period: 1, subjectId: maths.data.id, teacherId },
      ],
    },
  });
  assert(duplicateSlot.status === 400, "duplicate day+period rejected", duplicateSlot.data);

  /* --- Edit class + section ----------------------------------------- */

  const classEdit = await call(`/api/t/${schoolSlug}/classes/${sectionA.classId}`, {
    method: "PATCH",
    cookie: adminCookie,
    body: { room: "102", capacity: 36, homeroomTeacherId: teacherId },
  });
  assert(classEdit.status === 200, "edit class room/capacity/homeroom", classEdit.data);

  const afterEdit = await call(`/api/t/${schoolSlug}/classes`, { cookie: adminCookie });
  assert(
    afterEdit.data.every((row: any) => row.room === "102" && row.capacity === 36),
    "edited class reflected in list",
    afterEdit.data,
  );
  assert(
    afterEdit.data.every((row: any) => row.homeroomTeacherName === "Probe Teacher"),
    "homeroom teacher name resolved",
    afterEdit.data[0],
  );

  const renamed = await call(`/api/t/${schoolSlug}/sections/${sectionA.id}`, {
    method: "PATCH",
    cookie: adminCookie,
    body: { name: "Alpha" },
  });
  assert(renamed.status === 200 && renamed.data.name === "Alpha", "rename section", renamed.data);

  /* --- Enrolment ----------------------------------------------------- */

  const student = await call(`/api/t/${schoolSlug}/students`, {
    method: "POST",
    cookie: adminCookie,
    body: {
      firstName: "Probe",
      lastName: "Student",
      admissionNo: `ADM-${stamp}`,
      sectionId: sectionA.id,
      guardianName: "Probe Guardian",
      guardianPhone: "+91 90000 00000",
    },
  });
  assert(student.status === 201 && Boolean(student.data?.id), "enrol student in section", student.data);
  const studentId = student.data.id;

  const afterEnrol = await call(`/api/t/${schoolSlug}/classes`, { cookie: adminCookie });
  const alpha = afterEnrol.data.find((row: any) => row.section === "Alpha");
  assert(alpha?.studentCount === 1, "section student count updated", alpha);

  /* --- Calendar ------------------------------------------------------ */

  const calendar = await call(`/api/t/${schoolSlug}/calendar`, { cookie: adminCookie });
  assert(
    calendar.status === 200 &&
      calendar.data.academicYear?.name === "2026–27" &&
      calendar.data.terms.length === 1 &&
      calendar.data.periods.length === 2,
    "calendar returns year, terms, periods",
    calendar.data,
  );

  /* --- Guard rails --------------------------------------------------- */

  const blocked = await call(`/api/t/${schoolSlug}/classes/${sectionA.classId}`, {
    method: "DELETE",
    cookie: adminCookie,
  });
  assert(blocked.status === 409, "class with students cannot be deleted", blocked.data);

  const teacherCookie = await login(emails.teacher, teacher.data.temporaryPassword);
  const teacherWrite = await call(`/api/t/${schoolSlug}/academic-years`, {
    method: "POST",
    cookie: teacherCookie,
    body: { name: "Nope", startDate: "2026-01-01", endDate: "2026-12-31" },
  });
  assert(teacherWrite.status === 403, "teacher cannot create years", teacherWrite.data);

  const studentRemoved = await call(
    `/api/t/${schoolSlug}/students/${studentId}?permanent=true`,
    { method: "DELETE", cookie: adminCookie },
  );
  assert(studentRemoved.status === 200, "delete probe student", studentRemoved.data);

  const assignmentRemoved = await call(
    `/api/t/${schoolSlug}/teaching-assignments/${assignment.data.id}`,
    { method: "DELETE", cookie: adminCookie },
  );
  assert(assignmentRemoved.status === 200, "remove teaching assignment", assignmentRemoved.data);

  const subjectRemoved = await call(`/api/t/${schoolSlug}/subjects/${maths.data.id}`, {
    method: "DELETE",
    cookie: adminCookie,
  });
  assert(subjectRemoved.status === 200, "delete subject", subjectRemoved.data);

  const sectionBRemoved = await call(`/api/t/${schoolSlug}/sections/${sectionB.id}`, {
    method: "DELETE",
    cookie: adminCookie,
  });
  assert(sectionBRemoved.status === 200, "delete empty section", sectionBRemoved.data);

  const sectionARemoved = await call(`/api/t/${schoolSlug}/sections/${sectionA.id}`, {
    method: "DELETE",
    cookie: adminCookie,
  });
  assert(sectionARemoved.status === 200, "delete renamed section", sectionARemoved.data);

  const classRemoved = await call(`/api/t/${schoolSlug}/classes/${sectionA.classId}`, {
    method: "DELETE",
    cookie: adminCookie,
  });
  assert(classRemoved.status === 200, "delete class", classRemoved.data);

  const termRemoved = await call(`/api/t/${schoolSlug}/terms/${term.data.id}`, {
    method: "DELETE",
    cookie: adminCookie,
  });
  assert(termRemoved.status === 200, "delete term", termRemoved.data);

  const yearRemoved = await call(`/api/t/${schoolSlug}/academic-years/${year.data.id}`, {
    method: "DELETE",
    cookie: adminCookie,
  });
  assert(yearRemoved.status === 200, "delete year", yearRemoved.data);

  const p1Removed = await call(`/api/t/${schoolSlug}/timetable-periods/${period1.data.id}`, {
    method: "DELETE",
    cookie: adminCookie,
  });
  const p2Removed = await call(`/api/t/${schoolSlug}/timetable-periods/${period2.data.id}`, {
    method: "DELETE",
    cookie: adminCookie,
  });
  assert(p1Removed.status === 200 && p2Removed.status === 200, "delete timetable periods", {
    p1: p1Removed.data,
    p2: p2Removed.data,
  });

  const empty = await call(`/api/t/${schoolSlug}/classes`, { cookie: adminCookie });
  assert(empty.status === 200 && empty.data.length === 0, "classes empty after cleanup", empty.data);

  return schoolId;
}

main()
  .catch((error) => {
    fail += 1;
    console.error("PROBE CRASH", error);
  })
  .finally(async () => {
    // Tenant delete cascades the school's classes, students, teachers and
    // memberships; users are global, so they are removed separately.
    await prisma.tenant
      .deleteMany({ where: { slug: { startsWith: "probe-acad-" } } })
      .catch((error) => console.error("tenant cleanup failed", error.message));
    await prisma.user
      .deleteMany({ where: { email: { in: Object.values(emails) } } })
      .catch(() => undefined);
    await prisma.$disconnect();
    console.log(`\nResult: ${pass} passed, ${fail} failed`);
    process.exit(fail > 0 ? 1 : 0);
  });
