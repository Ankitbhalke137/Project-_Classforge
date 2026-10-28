/**
 * Verification test script for all ClassForge P1 tasks.
 *
 * Tests:
 * - P1.1: GET /api/auth/me response structure { user, schools }
 * - P1.2: Student invitation creates Student record with unique STU-YYYY-XXXXXX admissionNo
 * - P1.3: Standardized pagination { data, pagination: { page, limit, total, totalPages } }
 * - P1.4: Teachers API pagination, search, and sorting
 * - P1.5: Teacher student-roster restriction (listStudents & getStudentById)
 * - P1.6: Section-scoped announcements and teacher broadcast prevention
 * - P1.7: Cross-tenant student attendance returns 404 (NotFoundError)
 *
 * Run with: npx tsx scripts/test-p1-implementation.ts
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });
dotenv.config();

import { NextRequest } from "next/server";
import { prisma } from "../src/lib/prisma";
import { createAccessToken } from "../src/lib/auth";
import { GET as authMeHandler } from "../src/app/api/auth/me/route";
import { POST as inviteHandler } from "../src/app/api/t/[tenantSlug]/invite/route";
import { listExams } from "../src/lib/services/exam-service";
import { listTeachers } from "../src/lib/services/teacher-service";
import { listStudents, getStudentById, getTeacherAssignedSectionIds } from "../src/lib/services/student-service";
import { GET as announcementsGetHandler, POST as announcementsPostHandler } from "../src/app/api/t/[tenantSlug]/announcements/route";
import { GET as studentAttendanceHandler } from "../src/app/api/t/[tenantSlug]/students/[id]/attendance/route";
import { ForbiddenError } from "../src/lib/errors";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("   ClassForge Backend P1 Implementation Verification   ");
  console.log("=======================================================\n");

  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "asc" },
  });

  if (tenants.length < 2) {
    throw new Error("At least 2 tenants are required in database to verify cross-tenant boundaries.");
  }

  const tenant1 = tenants[0];
  const tenant2 = tenants[1];
  console.log(`Using Tenant 1: ${tenant1.name} (${tenant1.slug})`);
  console.log(`Using Tenant 2: ${tenant2.name} (${tenant2.slug})\n`);

  // -----------------------------------------------------------------
  // P1.1: GET /api/auth/me
  // -----------------------------------------------------------------
  console.log("--- P1.1: GET /api/auth/me ---");
  {
    // Find an active user with membership
    const userWithMembership = await prisma.user.findFirst({
      where: {
        memberships: { some: { tenantId: tenant1.id, status: "ACTIVE" } },
      },
      include: { memberships: { include: { tenant: true } } },
    });

    if (userWithMembership) {
      const token = await createAccessToken({
        userId: userWithMembership.id,
        email: userWithMembership.email,
      });

      const req = new NextRequest("http://localhost:3000/api/auth/me", {
        headers: { cookie: `access_token=${token}` },
      });

      const res = await authMeHandler(req);
      assert(res.status === 200, "GET /api/auth/me returns 200 for authenticated user");

      const body = await res.json();
      assert(Boolean(body.user && body.user.id === userWithMembership.id), "Response contains user object with matching id");
      assert(body.user.email === userWithMembership.email, "Response contains correct user email");
      assert(typeof body.user.isSuperAdmin === "boolean", "Response contains user.isSuperAdmin boolean");
      assert(Array.isArray(body.schools), "Response contains schools array");
      assert(body.schools.length > 0, "Schools array contains active memberships");
      assert(Boolean(body.schools[0].id && body.schools[0].slug && body.schools[0].role), "School item has id, slug, role");
    }

    // Test unauthenticated
    const unauthReq = new NextRequest("http://localhost:3000/api/auth/me");
    const unauthRes = await authMeHandler(unauthReq);
    assert(unauthRes.status === 401, "GET /api/auth/me returns 401 for unauthenticated request");
  }

  // -----------------------------------------------------------------
  // P1.2: Student Invitation
  // -----------------------------------------------------------------
  console.log("\n--- P1.2: Student Invitation ---");
  {
    // Find admin user for tenant1
    const adminMembership = await prisma.membership.findFirst({
      where: { tenantId: tenant1.id, role: "SCHOOL_ADMIN", status: "ACTIVE" },
      include: { user: true, tenant: true },
    });

    if (adminMembership) {
      const token = await createAccessToken({
        userId: adminMembership.user.id,
        email: adminMembership.user.email,
      });

      // Find an active section in tenant1 if exists
      const section = await prisma.section.findFirst({
        where: { tenantId: tenant1.id },
      });

      const testEmail = `teststudent_${Date.now()}@test.classforge.dev`;
      const req = new NextRequest(`http://localhost:3000/api/t/${tenant1.slug}/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `access_token=${token}`,
        },
        body: JSON.stringify({
          email: testEmail,
          role: "STUDENT",
          firstName: "Test",
          lastName: "Student",
          sectionId: section?.id,
        }),
      });

      const res = await inviteHandler(req, {
        params: Promise.resolve({ tenantSlug: tenant1.slug }),
      });

      assert(res.status === 201, `Invite student returns 201 Created (status ${res.status})`);
      const data = await res.json();
      assert(Boolean(data.student), "Response contains student object");
      assert(Boolean(data.student.admissionNo), `Student record has admissionNo: ${data.student?.admissionNo}`);
      assert(/^STU-\d{4}-[A-Z0-9]{6}$/.test(data.student.admissionNo), "Admission number matches STU-YYYY-XXXXXX format");
      assert(Boolean(data.temporaryPassword), "Response contains temporaryPassword");

      // Verify database record
      const studentInDb = await prisma.student.findFirst({
        where: { tenantId: tenant1.id, admissionNo: data.student.admissionNo },
        include: { user: true, enrolments: true },
      });
      assert(Boolean(studentInDb), "Student row created in database");
      assert(studentInDb?.user?.email === testEmail, "Student user account created with provided email");
      if (section) {
        assert(Boolean(studentInDb?.enrolments.some((e) => e.sectionId === section.id)), "Student enrolled into target section");
      }

      // Clean up test student
      if (studentInDb) {
        await prisma.enrolment.deleteMany({ where: { studentId: studentInDb.id } });
        await prisma.student.delete({ where: { id: studentInDb.id } });
        if (studentInDb.userId) {
          await prisma.membership.deleteMany({ where: { userId: studentInDb.userId } });
          await prisma.user.delete({ where: { id: studentInDb.userId } });
        }
      }
    }
  }

  // -----------------------------------------------------------------
  // P1.3: Standardize Pagination Responses
  // -----------------------------------------------------------------
  console.log("\n--- P1.3: Standardize Pagination Responses ---");
  {
    // 1. Exams Pagination
    const examsResult = await listExams(tenant1.id, { page: 1, limit: 5 });
    assert(Array.isArray(examsResult.data), "listExams returns data array");
    assert(Boolean(examsResult.pagination), "listExams returns pagination object");
    assert(examsResult.pagination.page === 1, "pagination.page is 1");
    assert(examsResult.pagination.limit === 5, "pagination.limit is 5");
    assert(typeof examsResult.pagination.total === "number", "pagination.total is number");
    assert(typeof examsResult.pagination.totalPages === "number", "pagination.totalPages is number");
    // Backward compatibility keys
    assert(examsResult.total === examsResult.pagination.total, "Backward-compatible top-level total matches");

    // 2. Announcements Pagination
    const adminMembership = await prisma.membership.findFirst({
      where: { tenantId: tenant1.id, role: "SCHOOL_ADMIN", status: "ACTIVE" },
      include: { user: true },
    });
    if (adminMembership) {
      const token = await createAccessToken({
        userId: adminMembership.user.id,
        email: adminMembership.user.email,
      });

      const req = new NextRequest(`http://localhost:3000/api/t/${tenant1.slug}/announcements?page=1&limit=3`, {
        headers: { cookie: `access_token=${token}` },
      });
      const res = await announcementsGetHandler(req, {
        params: Promise.resolve({ tenantSlug: tenant1.slug }),
      });
      assert(res.status === 200, "Announcements GET returns 200");
      const body = await res.json();
      assert(Array.isArray(body.data), "Announcements response has data array");
      assert(Boolean(body.pagination), "Announcements response has pagination object");
      assert(body.pagination.page === 1, "Announcements pagination.page is 1");
      assert(body.pagination.limit === 3, "Announcements pagination.limit is 3");
      assert(typeof body.pagination.total === "number", "Announcements pagination.total is number");
      assert(typeof body.pagination.totalPages === "number", "Announcements pagination.totalPages is number");
    }
  }

  // -----------------------------------------------------------------
  // P1.4: Teachers API Pagination, Search and Sorting
  // -----------------------------------------------------------------
  console.log("\n--- P1.4: Teachers API Pagination, Search and Sorting ---");
  {
    const paginatedTeachers = await listTeachers(tenant1.id, {
      page: 1,
      limit: 2,
      sort: "name:asc",
    });
    assert(Array.isArray(paginatedTeachers.data), "listTeachers returns data array");
    assert(Boolean(paginatedTeachers.pagination), "listTeachers returns pagination object");
    assert(paginatedTeachers.pagination.limit === 2, "pagination.limit matches requested limit");
    assert(typeof paginatedTeachers.pagination.total === "number", "pagination.total is returned");

    // Test Search
    if (paginatedTeachers.data.length > 0) {
      const firstTeacher = paginatedTeachers.data[0];
      const searchResult = await listTeachers(tenant1.id, {
        search: firstTeacher.name.slice(0, 3),
      });
      assert(searchResult.data.length > 0, "Search by partial name returns matching teachers");
      assert(
        searchResult.data.some((t) => t.id === firstTeacher.id),
        "Search result includes the target teacher",
      );
    }
  }

  // -----------------------------------------------------------------
  // P1.5: Restrict Teacher Student-Roster Access
  // -----------------------------------------------------------------
  console.log("\n--- P1.5: Restrict Teacher Student-Roster Access ---");
  {
    // Find a teacher in tenant1
    const teacherRow = await prisma.teacher.findFirst({
      where: { tenantId: tenant1.id, userId: { not: null } },
      include: { user: true },
    });

    if (teacherRow && teacherRow.userId) {
      // Find assigned sections
      const assignedSectionIds = await prisma.$transaction(async (tx) => {
        return getTeacherAssignedSectionIds(tx, tenant1.id, teacherRow.userId!);
      });

      console.log(`  Teacher ${teacherRow.firstName} ${teacherRow.lastName} assigned to ${assignedSectionIds.length} sections`);

      // 1. List students as Teacher
      const teacherStudentList = await listStudents(
        tenant1.id,
        { page: 1, limit: 50 },
        { userId: teacherRow.userId, role: "TEACHER" },
      );

      // Verify every returned student is enrolled in one of the teacher's assigned sections
      if (assignedSectionIds.length === 0) {
        assert(teacherStudentList.data.length === 0, "Teacher with no assigned sections sees 0 students");
      } else {
        const allEnrolledInAssigned = teacherStudentList.data.every((s) => {
          return s.sectionId ? assignedSectionIds.includes(s.sectionId) : false;
        });
        assert(allEnrolledInAssigned, "All students returned in teacher roster belong to teacher's assigned sections");
      }

      // 2. Test getStudentById access
      // Find a student not in the teacher's assigned sections
      const unassignedStudent = await prisma.student.findFirst({
        where: {
          tenantId: tenant1.id,
          enrolments: {
            none: {
              sectionId: { in: assignedSectionIds.length > 0 ? assignedSectionIds : ["00000000-0000-0000-0000-000000000000"] },
            },
          },
        },
      });

      if (unassignedStudent) {
        let threwForbidden = false;
        try {
          await getStudentById(tenant1.id, unassignedStudent.id, {
            userId: teacherRow.userId,
            role: "TEACHER",
          });
        } catch (err) {
          if (err instanceof ForbiddenError) {
            threwForbidden = true;
          }
        }
        assert(threwForbidden, "getStudentById throws ForbiddenError for student outside teacher's assigned sections");
      }
    } else {
      console.log("  ⚠️ Skipped: No teacher with linked user found in tenant 1 to test teacher restrictions");
    }
  }

  // -----------------------------------------------------------------
  // P1.6: Section-Scoped Announcements
  // -----------------------------------------------------------------
  console.log("\n--- P1.6: Section-Scoped Announcements ---");
  {
    // Find a teacher in tenant1
    const teacherRow = await prisma.teacher.findFirst({
      where: { tenantId: tenant1.id, userId: { not: null } },
      include: { user: true },
    });

    if (teacherRow && teacherRow.user) {
      const teacherToken = await createAccessToken({
        userId: teacherRow.user.id,
        email: teacherRow.user.email,
      });

      // 1. Teacher posting school-wide announcement (no sectionId) must be rejected with 403
      const schoolWideReq = new NextRequest(`http://localhost:3000/api/t/${tenant1.slug}/announcements`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `access_token=${teacherToken}`,
        },
        body: JSON.stringify({
          title: "Teacher Schoolwide Test",
          body: "This should be forbidden for teachers.",
          audience: ["STUDENTS"],
        }),
      });
      const schoolWideRes = await announcementsPostHandler(schoolWideReq, {
        params: Promise.resolve({ tenantSlug: tenant1.slug }),
      });
      assert(schoolWideRes.status === 403, "Teacher posting school-wide announcement returns 403 Forbidden");

      // 2. Teacher posting to section belonging to another tenant or not assigned must fail
      const foreignSection = await prisma.section.findFirst({
        where: { tenantId: tenant2.id },
      });
      if (foreignSection) {
        const foreignReq = new NextRequest(`http://localhost:3000/api/t/${tenant1.slug}/announcements`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie: `access_token=${teacherToken}`,
          },
          body: JSON.stringify({
            title: "Foreign Section Test",
            body: "This section belongs to another school.",
            audience: ["STUDENTS"],
            sectionId: foreignSection.id,
          }),
        });
        const foreignRes = await announcementsPostHandler(foreignReq, {
          params: Promise.resolve({ tenantSlug: tenant1.slug }),
        });
        assert(
          foreignRes.status === 400 || foreignRes.status === 403 || foreignRes.status === 404,
          `Posting announcement with foreign sectionId rejected with status ${foreignRes.status}`,
        );
      }
    }
  }

  // -----------------------------------------------------------------
  // P1.7: Cross-Tenant Student Attendance Returns 404
  // -----------------------------------------------------------------
  console.log("\n--- P1.7: Cross-Tenant Student Attendance Returns 404 ---");
  {
    // Find admin in tenant1
    const admin1 = await prisma.membership.findFirst({
      where: { tenantId: tenant1.id, role: "SCHOOL_ADMIN", status: "ACTIVE" },
      include: { user: true },
    });

    // Find student in tenant2 (cross-tenant)
    const studentInTenant2 = await prisma.student.findFirst({
      where: { tenantId: tenant2.id },
    });

    if (admin1 && studentInTenant2) {
      const token1 = await createAccessToken({
        userId: admin1.user.id,
        email: admin1.user.email,
      });

      // Request attendance of student from tenant2 within tenant1
      const req = new NextRequest(
        `http://localhost:3000/api/t/${tenant1.slug}/students/${studentInTenant2.id}/attendance`,
        { headers: { cookie: `access_token=${token1}` } },
      );

      const res = await studentAttendanceHandler(req, {
        params: Promise.resolve({ tenantSlug: tenant1.slug, id: studentInTenant2.id }),
      });

      assert(res.status === 404, `Cross-tenant student attendance returns 404 Not Found (got ${res.status})`);
      const body = await res.json();
      assert(
        body.message === "Student not found." || body.error === "Student not found.",
        "Error message is 'Student not found.' without leaking cross-tenant existence",
      );
    }

    // Non-existent student UUID returns 404
    if (admin1) {
      const fakeToken = await createAccessToken({
        userId: admin1.user.id,
        email: admin1.user.email,
      });

      const fakeId = "00000000-0000-0000-0000-000000000000";
      const req = new NextRequest(
        `http://localhost:3000/api/t/${tenant1.slug}/students/${fakeId}/attendance`,
        { headers: { cookie: `access_token=${fakeToken}` } },
      );

      const res = await studentAttendanceHandler(req, {
        params: Promise.resolve({ tenantSlug: tenant1.slug, id: fakeId }),
      });

      assert(res.status === 404, "Non-existent student UUID returns 404 Not Found");
    }
  }

  console.log("\n=======================================================");
  console.log(`   Verification Finished: ${passed} PASSED, ${failed} FAILED   `);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exitCode = 1;
  }
}

runTests()
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
