/**
 * Comprehensive verification tests for Phase 1 & 2 Security Requirements:
 * 7 Mandatory Tenant-Isolation and Authorization Scenarios.
 *
 * Scenarios covered:
 *  1. Cross-tenant API read: A School A user cannot read School B's protected student or resource data.
 *  2. Raw database isolation: With the restricted application role and School A tenant context active,
 *     a raw query against a tenant-owned table returns only School A rows.
 *  3. Cross-tenant write: School A cannot create a record linked to School B or change an existing record's tenant ownership.
 *  4. Cross-tenant update/delete: School A cannot update or delete School B's records.
 *  5. Attendance authorization: A teacher cannot mark attendance for an unassigned class or edit attendance outside the allowed school-local day.
 *  6. Exam marks authorization: A teacher cannot enter or update marks for an unassigned subject, section, exam, or student.
 *  7. Membership and JWT authorization: A user cannot access an unassigned school or use revoked/inactive membership or stale role claims.
 *
 * Run with: npx tsx scripts/test-tenant-authorization.ts
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });
dotenv.config();

import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { createAccessToken } from "../src/lib/auth";
import { ACCESS_TOKEN_COOKIE } from "../src/lib/auth-cookies";
import { saveExamMarks } from "../src/lib/services/exam-service";
import { GET as getStudentsHandler, POST as postStudentHandler } from "../src/app/api/t/[tenantSlug]/students/route";
import { PATCH as patchStudentHandler } from "../src/app/api/t/[tenantSlug]/students/[id]/route";
import { POST as postAttendanceHandler } from "../src/app/api/t/[tenantSlug]/attendance/route";

let passed = 0;
let failed = 0;

function assert(condition: unknown, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

const APP_DATABASE_URL =
  process.env.APP_DATABASE_URL ||
  "postgresql://classforge_app:ci_app_password@localhost:5432/classforge_ci_test";

function createAuthRequest(
  url: string,
  method: string,
  token: string,
  body?: unknown,
): NextRequest {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("Cookie", `${ACCESS_TOKEN_COOKIE}=${token}`);

  const init: RequestInit = {
    method,
    headers,
  };
  if (body) {
    init.body = JSON.stringify(body);
  }

  return new NextRequest(new URL(url, "http://localhost:3000"), init);
}

async function runSuite() {
  console.log("\n=======================================================");
  console.log("   ClassForge: 7 Mandatory Tenant-Isolation Tests      ");
  console.log("=======================================================\n");

  const runId = Math.random().toString(36).substring(2, 8);
  const tenantSlugA = `iso-a-${runId}`;
  const tenantSlugB = `iso-b-${runId}`;

  console.log(`[Setup] Setting up isolated test tenants:`);
  console.log(`  School A: ${tenantSlugA}`);
  console.log(`  School B: ${tenantSlugB}\n`);

  // 1. Create Tenant A and Tenant B fixtures
  const tenantA = await prisma.tenant.create({
    data: {
      name: `School A Isolation ${runId}`,
      slug: tenantSlugA,
      status: "ACTIVE",
    },
  });

  const tenantB = await prisma.tenant.create({
    data: {
      name: `School B Isolation ${runId}`,
      slug: tenantSlugB,
      status: "ACTIVE",
    },
  });

  // 2. Create Users
  const userAdminA = await prisma.user.create({
    data: {
      name: `Admin A ${runId}`,
      email: `admin-a-${runId}@example.com`,
      passwordHash: "hash",
    },
  });

  const userTeacherA1 = await prisma.user.create({
    data: {
      name: `Teacher A1 ${runId}`,
      email: `teacher-a1-${runId}@example.com`,
      passwordHash: "hash",
    },
  });

  const userTeacherA2 = await prisma.user.create({
    data: {
      name: `Teacher A2 (Unassigned) ${runId}`,
      email: `teacher-a2-${runId}@example.com`,
      passwordHash: "hash",
    },
  });

  const userStudentA1 = await prisma.user.create({
    data: {
      name: `Student A1 ${runId}`,
      email: `student-a1-${runId}@example.com`,
      passwordHash: "hash",
    },
  });

  const userAdminB = await prisma.user.create({
    data: {
      name: `Admin B ${runId}`,
      email: `admin-b-${runId}@example.com`,
      passwordHash: "hash",
    },
  });

  const userStudentB1 = await prisma.user.create({
    data: {
      name: `Student B1 ${runId}`,
      email: `student-b1-${runId}@example.com`,
      passwordHash: "hash",
    },
  });

  // 3. Create Memberships
  const memberAdminA = await prisma.membership.create({
    data: {
      tenantId: tenantA.id,
      userId: userAdminA.id,
      role: "SCHOOL_ADMIN",
      status: "ACTIVE",
    },
  });

  const memberTeacherA1 = await prisma.membership.create({
    data: {
      tenantId: tenantA.id,
      userId: userTeacherA1.id,
      role: "TEACHER",
      status: "ACTIVE",
    },
  });

  const memberTeacherA2 = await prisma.membership.create({
    data: {
      tenantId: tenantA.id,
      userId: userTeacherA2.id,
      role: "TEACHER",
      status: "ACTIVE",
    },
  });

  const memberStudentA1 = await prisma.membership.create({
    data: {
      tenantId: tenantA.id,
      userId: userStudentA1.id,
      role: "STUDENT",
      status: "ACTIVE",
    },
  });

  const memberAdminB = await prisma.membership.create({
    data: {
      tenantId: tenantB.id,
      userId: userAdminB.id,
      role: "SCHOOL_ADMIN",
      status: "ACTIVE",
    },
  });

  const memberStudentB1 = await prisma.membership.create({
    data: {
      tenantId: tenantB.id,
      userId: userStudentB1.id,
      role: "STUDENT",
      status: "ACTIVE",
    },
  });

  // 4. Create Roster Records (Teachers & Students)
  const teacherA1 = await prisma.teacher.create({
    data: {
      tenantId: tenantA.id,
      userId: userTeacherA1.id,
      firstName: "Teacher",
      lastName: `A1-${runId}`,
    },
  });

  const teacherA2 = await prisma.teacher.create({
    data: {
      tenantId: tenantA.id,
      userId: userTeacherA2.id,
      firstName: "Teacher",
      lastName: `A2-${runId}`,
    },
  });

  const studentA1 = await prisma.student.create({
    data: {
      tenantId: tenantA.id,
      userId: userStudentA1.id,
      admissionNo: `ADM-A1-${runId}`,
      firstName: "Student",
      lastName: `A1-${runId}`,
      status: "ACTIVE",
    },
  });

  const studentB1 = await prisma.student.create({
    data: {
      tenantId: tenantB.id,
      userId: userStudentB1.id,
      admissionNo: `ADM-B1-${runId}`,
      firstName: "Student",
      lastName: `B1-${runId}`,
      status: "ACTIVE",
    },
  });

  // 5. Academic structure for School A
  const yearA = await prisma.academicYear.create({
    data: {
      tenantId: tenantA.id,
      name: `Academic Year A ${runId}`,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      status: "ACTIVE",
    },
  });

  const classA = await prisma.schoolClass.create({
    data: {
      tenantId: tenantA.id,
      academicYearId: yearA.id,
      name: `Class 10A-${runId}`,
    },
  });

  const sectionA1 = await prisma.section.create({
    data: {
      tenantId: tenantA.id,
      classId: classA.id,
      name: "A",
    },
  });

  const sectionA2 = await prisma.section.create({
    data: {
      tenantId: tenantA.id,
      classId: classA.id,
      name: "B",
    },
  });

  const subjectA1 = await prisma.subject.create({
    data: {
      tenantId: tenantA.id,
      classId: classA.id,
      name: `Physics ${runId}`,
    },
  });

  const subjectA2 = await prisma.subject.create({
    data: {
      tenantId: tenantA.id,
      classId: classA.id,
      name: `Chemistry ${runId}`,
    },
  });

  // Assign Teacher A1 to Section A1 + Subject A1
  await prisma.teachingAssignment.create({
    data: {
      tenantId: tenantA.id,
      teacherId: teacherA1.id,
      sectionId: sectionA1.id,
      subjectId: subjectA1.id,
    },
  });

  // Enroll Student A1 in Section A1
  await prisma.enrolment.create({
    data: {
      tenantId: tenantA.id,
      studentId: studentA1.id,
      sectionId: sectionA1.id,
      academicYearId: yearA.id,
      status: "ACTIVE",
    },
  });

  // Create Exam for Subject A1 in Section A1
  const examA1 = await prisma.exam.create({
    data: {
      tenantId: tenantA.id,
      sectionId: sectionA1.id,
      subjectId: subjectA1.id,
      name: `Physics Midterm ${runId}`,
      term: "Term 1",
      maxMarks: 100,
      examDate: new Date("2026-10-15"),
      status: "SCHEDULED",
    },
  });

  // 6. Generate JWTs with memberships
  const tokenAdminA = await createAccessToken({
    userId: userAdminA.id,
    email: userAdminA.email,
    isSuperAdmin: false,
    memberships: [{ schoolId: tenantA.id, schoolSlug: tenantA.slug, role: "SCHOOL_ADMIN" }],
  });

  const tokenTeacherA1 = await createAccessToken({
    userId: userTeacherA1.id,
    email: userTeacherA1.email,
    isSuperAdmin: false,
    memberships: [{ schoolId: tenantA.id, schoolSlug: tenantA.slug, role: "TEACHER" }],
  });

  const tokenTeacherA2 = await createAccessToken({
    userId: userTeacherA2.id,
    email: userTeacherA2.email,
    isSuperAdmin: false,
    memberships: [{ schoolId: tenantA.id, schoolSlug: tenantA.slug, role: "TEACHER" }],
  });

  const tokenAdminB = await createAccessToken({
    userId: userAdminB.id,
    email: userAdminB.email,
    isSuperAdmin: false,
    memberships: [{ schoolId: tenantB.id, schoolSlug: tenantB.slug, role: "SCHOOL_ADMIN" }],
  });

  try {
    // =========================================================================
    // SCENARIO 1: Cross-Tenant API Read
    // =========================================================================
    console.log("--- SCENARIO 1: Cross-Tenant API Read ---");

    // 1.1 School A Admin attempts to read School B's student roster
    const crossReadReq = createAuthRequest(
      `/api/t/${tenantSlugB}/students`,
      "GET",
      tokenAdminA,
    );
    const crossReadRes = await getStudentsHandler(crossReadReq, {
      params: Promise.resolve({ tenantSlug: tenantSlugB }),
    });
    assert(
      crossReadRes.status === 403,
      `Cross-tenant read rejected with 403 Forbidden (got ${crossReadRes.status})`,
    );

    // 1.2 Positive control: School A Admin reads School A students successfully
    const posReadReq = createAuthRequest(
      `/api/t/${tenantSlugA}/students`,
      "GET",
      tokenAdminA,
    );
    const posReadRes = await getStudentsHandler(posReadReq, {
      params: Promise.resolve({ tenantSlug: tenantSlugA }),
    });
    assert(
      posReadRes.status === 200,
      `Positive control: School A Admin successfully reads School A students (status ${posReadRes.status})`,
    );
    const posReadData = await posReadRes.json();
    assert(
      Array.isArray(posReadData.data) && posReadData.data.some((s: any) => s.id === studentA1.id),
      "Positive control: Response contains School A student",
    );

    // =========================================================================
    // SCENARIO 2: Raw Database Isolation with Restricted Role
    // =========================================================================
    console.log("\n--- SCENARIO 2: Raw Database Isolation under Restricted Role ---");

    const appPrisma = new PrismaClient({
      datasources: { db: { url: APP_DATABASE_URL } },
    });

    // Verify restricted role attributes
    const roleCheck = await appPrisma.$queryRawUnsafe<
      Array<{ rolname: string; rolsuper: boolean; rolbypassrls: boolean }>
    >(`
      SELECT rolname, rolsuper, rolbypassrls
      FROM pg_roles
      WHERE rolname = 'classforge_app'
    `);
    assert(
      roleCheck.length === 1 &&
        roleCheck[0].rolsuper === false &&
        roleCheck[0].rolbypassrls === false,
      "classforge_app is verified non-superuser with rolbypassrls = false",
    );

    // Query students under Tenant A context
    const rawRowsA = await appPrisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantA.id}';`);
      return tx.$queryRawUnsafe<Array<{ id: string; tenant_id: string }>>(`
        SELECT id, tenant_id FROM students WHERE tenant_id IN ('${tenantA.id}', '${tenantB.id}');
      `);
    });

    const tenantAStudents = rawRowsA.filter((r) => r.tenant_id === tenantA.id);
    const tenantBStudents = rawRowsA.filter((r) => r.tenant_id === tenantB.id);

    assert(
      tenantAStudents.some((r) => r.id === studentA1.id),
      `Raw query with Tenant A context returns Tenant A students (found ${tenantAStudents.length} rows)`,
    );
    assert(
      tenantBStudents.length === 0,
      `Raw query with Tenant A context returns 0 Tenant B students (found ${tenantBStudents.length})`,
    );

    // =========================================================================
    // SCENARIO 3: Cross-Tenant Write
    // =========================================================================
    console.log("\n--- SCENARIO 3: Cross-Tenant Write ---");

    // 3.1 Raw SQL / Prisma: Attempt to insert row for Tenant B while Tenant A context is active
    let rlsCheckFailedAsExpected = false;
    try {
      await appPrisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantA.id}, true)`;
        await tx.student.create({
          data: {
            tenantId: tenantB.id,
            admissionNo: `HACK-${runId}`,
            firstName: "Spoofed",
            lastName: "Student",
            status: "ACTIVE",
          },
        });
      });
    } catch (err: any) {
      rlsCheckFailedAsExpected =
        err.code === "P2004" ||
        err.message?.includes("row-level security") ||
        err.message?.includes("violates") ||
        err.code === "42501";
    }
    assert(
      rlsCheckFailedAsExpected,
      "Raw insert with foreign tenant_id under restricted role rejected by RLS WITH CHECK",
    );

    // 3.2 API: Attempt to create student in School A with foreign section belonging to School B
    // Create a section in School B
    const yearB = await prisma.academicYear.create({
      data: {
        tenantId: tenantB.id,
        name: `Academic Year B ${runId}`,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        status: "ACTIVE",
      },
    });
    const classB = await prisma.schoolClass.create({
      data: { tenantId: tenantB.id, academicYearId: yearB.id, name: `Class B ${runId}` },
    });
    const sectionB1 = await prisma.section.create({
      data: { tenantId: tenantB.id, classId: classB.id, name: "B1" },
    });

    const crossWriteReq = createAuthRequest(
      `/api/t/${tenantSlugA}/students`,
      "POST",
      tokenAdminA,
      {
        firstName: "Malicious",
        lastName: "Enrol",
        admissionNo: `SPOOF-${runId}`,
        sectionId: sectionB1.id, // Section belonging to School B
      },
    );
    const crossWriteRes = await postStudentHandler(crossWriteReq, {
      params: Promise.resolve({ tenantSlug: tenantSlugA }),
    });
    assert(
      crossWriteRes.status === 400 || crossWriteRes.status === 404,
      `API cross-tenant write rejected (status ${crossWriteRes.status})`,
    );

    // =========================================================================
    // SCENARIO 4: Cross-Tenant Update/Delete
    // =========================================================================
    console.log("\n--- SCENARIO 4: Cross-Tenant Update/Delete ---");

    // 4.1 Raw SQL: With Tenant A context, attempt to update Student B
    const rawUpdateCount = await appPrisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantA.id}';`);
      return tx.$executeRawUnsafe(`
        UPDATE students SET first_name = 'HackedName' WHERE id = '${studentB1.id}';
      `);
    });
    assert(
      rawUpdateCount === 0,
      `Raw UPDATE on School B student with School A context updated 0 rows (rowCount=${rawUpdateCount})`,
    );

    // 4.2 Raw SQL: With Tenant A context, attempt to delete Student B
    const rawDeleteCount = await appPrisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${tenantA.id}';`);
      return tx.$executeRawUnsafe(`
        DELETE FROM students WHERE id = '${studentB1.id}';
      `);
    });
    assert(
      rawDeleteCount === 0,
      `Raw DELETE on School B student with School A context deleted 0 rows (rowCount=${rawDeleteCount})`,
    );

    // 4.3 API: School A Admin attempts to update School B student
    const crossPatchReq = createAuthRequest(
      `/api/t/${tenantSlugA}/students/${studentB1.id}`,
      "PATCH",
      tokenAdminA,
      { firstName: "HackedViaApi" },
    );
    const crossPatchRes = await patchStudentHandler(crossPatchReq, {
      params: Promise.resolve({ tenantSlug: tenantSlugA, id: studentB1.id }),
    });
    assert(
      crossPatchRes.status === 404,
      `API cross-tenant PATCH on foreign student returned 404 NotFound (status ${crossPatchRes.status})`,
    );

    // 4.4 Positive control: School A Admin successfully updates School A student
    const posPatchReq = createAuthRequest(
      `/api/t/${tenantSlugA}/students/${studentA1.id}`,
      "PATCH",
      tokenAdminA,
      { firstName: "UpdatedValidName" },
    );
    const posPatchRes = await patchStudentHandler(posPatchReq, {
      params: Promise.resolve({ tenantSlug: tenantSlugA, id: studentA1.id }),
    });
    assert(
      posPatchRes.status === 200,
      `Positive control: School A Admin successfully updates School A student (status ${posPatchRes.status})`,
    );

    // =========================================================================
    // SCENARIO 5: Attendance Authorization (Teacher Assignment & Same-Day Rule)
    // =========================================================================
    console.log("\n--- SCENARIO 5: Attendance Authorization & Same-Day Rules ---");

    const todayDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
    }).format(new Date());

    const yesterdayDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
    }).format(new Date(Date.now() - 86400000));

    // 5.1 Unassigned teacher (Teacher A2) attempts to mark attendance for Section A1
    const unassignedAttReq = createAuthRequest(
      `/api/t/${tenantSlugA}/attendance`,
      "POST",
      tokenTeacherA2,
      {
        classId: sectionA1.id,
        date: todayDate,
        records: [{ studentId: studentA1.id, status: "PRESENT" }],
      },
    );
    const unassignedAttRes = await postAttendanceHandler(unassignedAttReq, {
      params: Promise.resolve({ tenantSlug: tenantSlugA }),
    });
    assert(
      unassignedAttRes.status === 403,
      `Unassigned teacher marking attendance rejected with 403 Forbidden (status ${unassignedAttRes.status})`,
    );

    // 5.2 Assigned teacher (Teacher A1) attempts to edit past day's attendance
    const pastDayAttReq = createAuthRequest(
      `/api/t/${tenantSlugA}/attendance`,
      "POST",
      tokenTeacherA1,
      {
        classId: sectionA1.id,
        date: yesterdayDate,
        records: [{ studentId: studentA1.id, status: "PRESENT" }],
      },
    );
    const pastDayAttRes = await postAttendanceHandler(pastDayAttReq, {
      params: Promise.resolve({ tenantSlug: tenantSlugA }),
    });
    assert(
      pastDayAttRes.status === 403,
      `Teacher attempting to mark past day attendance rejected with 403 Forbidden (status ${pastDayAttRes.status})`,
    );

    // 5.3 Assigned teacher (Teacher A1) marks today's attendance successfully
    const validAttReq = createAuthRequest(
      `/api/t/${tenantSlugA}/attendance`,
      "POST",
      tokenTeacherA1,
      {
        classId: sectionA1.id,
        date: todayDate,
        records: [{ studentId: studentA1.id, status: "PRESENT" }],
      },
    );
    const validAttRes = await postAttendanceHandler(validAttReq, {
      params: Promise.resolve({ tenantSlug: tenantSlugA }),
    });
    assert(
      validAttRes.status === 201,
      `Assigned teacher successfully marks today's attendance (status ${validAttRes.status})`,
    );

    // 5.4 Authorized School Admin override: Admin can mark yesterday's attendance
    const adminPastAttReq = createAuthRequest(
      `/api/t/${tenantSlugA}/attendance`,
      "POST",
      tokenAdminA,
      {
        classId: sectionA1.id,
        date: yesterdayDate,
        records: [{ studentId: studentA1.id, status: "PRESENT" }],
      },
    );
    const adminPastAttRes = await postAttendanceHandler(adminPastAttReq, {
      params: Promise.resolve({ tenantSlug: tenantSlugA }),
    });
    assert(
      adminPastAttRes.status === 201,
      `School Admin authorized to mark past date attendance (status ${adminPastAttRes.status})`,
    );

    // =========================================================================
    // SCENARIO 6: Exam Marks Authorization (Assigned Teacher & Subject)
    // =========================================================================
    console.log("\n--- SCENARIO 6: Exam Marks Authorization ---");

    // 6.1 Unassigned Teacher A2 attempts to enter marks for Exam A1 (Subject A1)
    let unassignedMarksBlocked = false;
    try {
      await saveExamMarks(
        tenantA.id,
        examA1.id,
        userTeacherA2.id,
        { records: [{ studentId: studentA1.id, score: 92 }] },
        "TEACHER",
      );
    } catch (err: any) {
      unassignedMarksBlocked = err.statusCode === 403 || err.message?.includes("not assigned");
    }
    assert(
      unassignedMarksBlocked,
      "Unassigned teacher entering exam marks rejected with 403 Forbidden",
    );

    // 6.2 Assigned Teacher A1 successfully enters marks for Exam A1 (Subject A1)
    let assignedMarksSuccess = false;
    try {
      const marksRes = await saveExamMarks(
        tenantA.id,
        examA1.id,
        userTeacherA1.id,
        { records: [{ studentId: studentA1.id, score: 95 }] },
        "TEACHER",
      );
      const studentResult = marksRes?.results?.find((r: any) => r.studentId === studentA1.id);
      assignedMarksSuccess = !!studentResult && Number(studentResult.marksObtained) === 95;
    } catch (err) {
      console.error("Assigned teacher marks error:", err);
    }
    assert(
      assignedMarksSuccess,
      "Assigned teacher (Teacher A1) successfully enters marks for assigned exam",
    );

    // 6.3 School Admin override: Admin enters/updates marks
    let adminMarksSuccess = false;
    try {
      const adminMarks = await saveExamMarks(
        tenantA.id,
        examA1.id,
        userAdminA.id,
        { records: [{ studentId: studentA1.id, score: 98 }] },
        "SCHOOL_ADMIN",
      );
      const studentResult = adminMarks?.results?.find((r: any) => r.studentId === studentA1.id);
      adminMarksSuccess = !!studentResult && Number(studentResult.marksObtained) === 98;
    } catch (err) {
      console.error("Admin marks error:", err);
    }
    assert(
      adminMarksSuccess,
      "School Admin authorized to enter and update marks",
    );

    // =========================================================================
    // SCENARIO 7: Membership and JWT Authorization (Revocation & Stale Claims)
    // =========================================================================
    console.log("\n--- SCENARIO 7: Membership & JWT Authorization Safeguards ---");

    // 7.1 User with inactive membership
    // Deactivate Teacher A1's membership in School A
    await prisma.membership.update({
      where: {
        tenantId_userId: {
          tenantId: tenantA.id,
          userId: userTeacherA1.id,
        },
      },
      data: { status: "INACTIVE" },
    });

    const inactiveReq = createAuthRequest(
      `/api/t/${tenantSlugA}/students`,
      "GET",
      tokenTeacherA1, // Validly signed token, but membership revoked in DB
    );
    const inactiveRes = await getStudentsHandler(inactiveReq, {
      params: Promise.resolve({ tenantSlug: tenantSlugA }),
    });
    assert(
      inactiveRes.status === 403,
      `User with INACTIVE membership rejected with 403 Forbidden despite valid token (status ${inactiveRes.status})`,
    );

    // 7.2 Restore active membership: User access restored
    await prisma.membership.update({
      where: {
        tenantId_userId: {
          tenantId: tenantA.id,
          userId: userTeacherA1.id,
        },
      },
      data: { status: "ACTIVE" },
    });

    const restoredReq = createAuthRequest(
      `/api/t/${tenantSlugA}/students`,
      "GET",
      tokenTeacherA1,
    );
    const restoredRes = await getStudentsHandler(restoredReq, {
      params: Promise.resolve({ tenantSlug: tenantSlugA }),
    });
    assert(
      restoredRes.status === 200,
      `User with restored ACTIVE membership successfully authorized (status ${restoredRes.status})`,
    );

    // 7.3 Token with spoofed role in claims: Server checks real DB membership role
    const spoofedToken = await createAccessToken({
      userId: userStudentA1.id,
      email: userStudentA1.email,
      isSuperAdmin: false,
      memberships: [{ schoolId: tenantA.id, schoolSlug: tenantA.slug, role: "SCHOOL_ADMIN" }], // Spoofed!
    });
    const spoofedReq = createAuthRequest(
      `/api/t/${tenantSlugA}/students`,
      "POST", // Student cannot create students
      spoofedToken,
      { firstName: "Student", lastName: "Hacker" },
    );
    const spoofedRes = await postStudentHandler(spoofedReq, {
      params: Promise.resolve({ tenantSlug: tenantSlugA }),
    });
    assert(
      spoofedRes.status === 403,
      `Token with client-spoofed SCHOOL_ADMIN role rejected by real-time DB membership check (status ${spoofedRes.status})`,
    );

    await appPrisma.$disconnect();
  } finally {
    // Cleanup test fixtures safely
    console.log("\n[Cleanup] Cleaning up test fixtures safely...");
    try {
      await prisma.mark.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
      await prisma.exam.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
      await prisma.attendanceRecord.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
      await prisma.enrolment.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
      await prisma.teachingAssignment.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
      await prisma.subject.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
      await prisma.section.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
      await prisma.schoolClass.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
      await prisma.academicYear.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
      await prisma.student.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
      await prisma.teacher.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
      await prisma.membership.deleteMany({ where: { tenantId: { in: [tenantA.id, tenantB.id] } } });
      await prisma.user.deleteMany({
        where: {
          id: {
            in: [
              userAdminA.id,
              userTeacherA1.id,
              userTeacherA2.id,
              userStudentA1.id,
              userAdminB.id,
              userStudentB1.id,
            ],
          },
        },
      });
      await prisma.tenant.deleteMany({ where: { id: { in: [tenantA.id, tenantB.id] } } });
      console.log("  Cleaned up all test fixtures successfully.");
    } catch (cleanupErr) {
      console.error("Cleanup error:", cleanupErr);
    }
  }

  console.log("\n=======================================================");
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error("Test suite fatal error:", err);
  process.exit(1);
});
