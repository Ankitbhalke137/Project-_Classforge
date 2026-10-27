import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { randomUUID } from "node:crypto";
import { PrismaClient, MembershipRole, EnrolmentStatus } from "@prisma/client";
import { listStudents } from "../src/lib/services/student-service";

const prisma = new PrismaClient();

const NOIDA_DEMO_STUDENTS = [
  ["Aarush", "Kapoor"], ["Anvi", "Aggarwal"], ["Bhavin", "Chopra"], ["Chhavi", "Singhal"],
  ["Daksh", "Malhotra"], ["Esha", "Saxena"], ["Farhan", "Malik"], ["Gunjan", "Batra"],
  ["Hitesh", "Grover"], ["Ishita", "Goel"], ["Jatin", "Sethi"], ["Kriti", "Bansal"],
  ["Lakshya", "Narang"], ["Mehak", "Juneja"], ["Naman", "Tandon"], ["Pari", "Mittal"],
  ["Raghav", "Bhasin"], ["Rashi", "Ahluwalia"], ["Shaurya", "Gulati"], ["Tanvi", "Puri"],
  ["Ujjwal", "Bhalla"], ["Vanya", "Chawla"], ["Vivaan", "Khanna"], ["Yashika", "Suri"],
  ["Zaid", "Siddiqui"],
]; // exactly 25 names

async function main() {
  console.log("=== IOI NOIDA: BHUMIKA SHARMA TEACHER ASSIGNMENT WORKFLOW ===");

  // 1. Target Database & Environment Check
  const dbUrl = process.env.DATABASE_URL || "";
  const hostMatch = dbUrl.match(/@([^:\/]+)(?::\d+)?\/([^?]+)/);
  console.log("Environment   :", process.env.NODE_ENV || "development");
  console.log("Database Host :", hostMatch ? hostMatch[1] : "unknown");
  console.log("Database Name :", hostMatch ? hostMatch[2] : "unknown");

  // 2. Fetch IOI Noida Tenant
  const noida = await prisma.tenant.findUnique({
    where: { slug: "ioi-noida" },
    include: {
      classes: {
        include: { sections: true, subjects: true },
      },
      academicYears: true,
      students: true,
      enrolments: { where: { status: "ACTIVE" } },
      teachers: true,
      teachingAssignments: true,
    },
  });

  if (!noida) {
    throw new Error("IOI Noida tenant not found in database.");
  }

  console.log(`\nIOI Noida Initial State (ID: ${noida.id}):`);
  console.log(`  Initial Students in DB: ${noida.students.length}`);
  console.log(`  Initial Active Enrolments: ${noida.enrolments.length}`);
  console.log(`  Initial Teachers: ${noida.teachers.length}`);
  console.log(`  Initial Teaching Assignments: ${noida.teachingAssignments.length}`);

  // 3. Verify Bhumika Sharma
  const user = await prisma.user.findUnique({
    where: { email: "sharmabhumi.98130@gmail.com" },
    include: {
      memberships: {
        where: { tenantId: noida.id },
      },
      teachers: {
        where: { tenantId: noida.id },
      },
    },
  });

  if (!user) {
    throw new Error("User Bhumika Sharma (sharmabhumi.98130@gmail.com) not found.");
  }

  const membership = user.memberships[0];
  if (!membership) {
    throw new Error("Bhumika Sharma has no membership in IOI Noida.");
  }

  console.log(`\nUser Record: ${user.name} (${user.email}, ID: ${user.id})`);
  console.log(`  Membership in IOI Noida: Role = ${membership.role}, Status = ${membership.status}`);

  if (membership.role !== MembershipRole.TEACHER) {
    throw new Error(`Expected role TEACHER, but found ${membership.role}`);
  }

  // 4. Ensure Teacher profile exists in `teachers`
  let teacherProfile = user.teachers[0];
  if (!teacherProfile) {
    console.log("  Teacher profile missing in `teachers` table. Creating teacher profile...");
    const [firstName, ...rest] = user.name.trim().split(/\s+/);
    teacherProfile = await prisma.teacher.create({
      data: {
        tenantId: noida.id,
        userId: user.id,
        firstName: firstName || "Bhumika",
        lastName: rest.join(" ") || "Sharma",
        designation: "Teacher",
      },
    });
    console.log(`  Created Teacher profile ID: ${teacherProfile.id}`);
  } else {
    console.log(`  Existing Teacher profile verified: ${teacherProfile.id}`);
  }

  // 5. Verify Academic Structure
  const academicYear =
    noida.academicYears.find((ay) => ay.status === "ACTIVE") ?? noida.academicYears[0];
  const schoolClass = noida.classes[0];
  const section = schoolClass?.sections[0];

  if (!academicYear || !schoolClass || !section) {
    throw new Error("Missing academic structure (academicYear, class, or section) in IOI Noida.");
  }

  console.log(`\nAcademic Structure:`);
  console.log(`  Academic Year : ${academicYear.name} (${academicYear.id})`);
  console.log(`  Class         : ${schoolClass.name} (${schoolClass.id})`);
  console.log(`  Section       : ${section.name} (${section.id})`);

  // Ensure subject exists for Class 10
  let subject = schoolClass.subjects[0];
  if (!subject) {
    subject = await prisma.subject.create({
      data: {
        tenantId: noida.id,
        classId: schoolClass.id,
        name: "General Studies",
        code: "GEN",
      },
    });
    console.log(`  Created Subject "${subject.name}" (${subject.id})`);
  } else {
    console.log(`  Reused Subject "${subject.name}" (${subject.id})`);
  }

  // Ensure homeroomTeacherId is set on class
  if (!schoolClass.homeroomTeacherId || schoolClass.homeroomTeacherId !== teacherProfile.id) {
    await prisma.schoolClass.update({
      where: { tenantId_id: { tenantId: noida.id, id: schoolClass.id } },
      data: { homeroomTeacherId: teacherProfile.id },
    });
    console.log(`  Set homeroomTeacherId on Class ${schoolClass.name} to ${teacherProfile.id}`);
  }

  // Ensure TeachingAssignment exists
  let teachingAssignment = await prisma.teachingAssignment.findUnique({
    where: {
      tenantId_teacherId_sectionId_subjectId: {
        tenantId: noida.id,
        teacherId: teacherProfile.id,
        sectionId: section.id,
        subjectId: subject.id,
      },
    },
  });

  if (!teachingAssignment) {
    teachingAssignment = await prisma.teachingAssignment.create({
      data: {
        tenantId: noida.id,
        teacherId: teacherProfile.id,
        sectionId: section.id,
        subjectId: subject.id,
      },
    });
    console.log(`  Created TeachingAssignment ID: ${teachingAssignment.id}`);
  } else {
    console.log(`  Reused TeachingAssignment ID: ${teachingAssignment.id}`);
  }

  // 6. Target: Exactly 25 students
  const target = 25;
  const existingEnrolments = await prisma.enrolment.findMany({
    where: {
      tenantId: noida.id,
      sectionId: section.id,
      status: EnrolmentStatus.ACTIVE,
    },
    include: { student: true },
  });

  const currentCount = existingEnrolments.length;
  const needed = Math.max(0, target - currentCount);

  console.log(`\nStudent Target Count:`);
  console.log(`  Current active students in section: ${currentCount}`);
  console.log(`  Target                            : ${target}`);
  console.log(`  Additional demo students needed   : ${needed}`);

  if (needed > 0) {
    const existingDemoStudents = await prisma.student.findMany({
      where: {
        tenantId: noida.id,
        admissionNo: { startsWith: "DEMO-NOIDA-" },
      },
    });
    const existingAdmissionNos = new Set(existingDemoStudents.map((s) => s.admissionNo));

    const studentsToInsert = [];
    for (let i = 1; i <= needed; i++) {
      const admissionNo = `DEMO-NOIDA-${String(i).padStart(3, "0")}`;
      if (!existingAdmissionNos.has(admissionNo)) {
        const [first, last] = NOIDA_DEMO_STUDENTS[i - 1] ?? [`Student${i}`, "Demo"];
        studentsToInsert.push({
          id: randomUUID(),
          tenantId: noida.id,
          admissionNo,
          firstName: first,
          lastName: last,
          guardianName: "[DEMO] Guardian",
          status: "ACTIVE",
        });
      }
    }

    if (studentsToInsert.length > 0) {
      console.log(`  Batch inserting ${studentsToInsert.length} demo students for IOI Noida...`);
      await prisma.student.createMany({
        data: studentsToInsert,
        skipDuplicates: true,
      });
    }

    // Retrieve all demo students to enroll them
    const allDemoStudents = await prisma.student.findMany({
      where: {
        tenantId: noida.id,
        admissionNo: { startsWith: "DEMO-NOIDA-" },
      },
      select: { id: true, admissionNo: true },
    });

    const enrolledIds = new Set(existingEnrolments.map((e) => e.studentId));
    const enrolmentsToInsert = allDemoStudents
      .filter((s) => !enrolledIds.has(s.id))
      .slice(0, needed)
      .map((s) => ({
        id: randomUUID(),
        tenantId: noida.id,
        studentId: s.id,
        sectionId: section.id,
        academicYearId: academicYear.id,
        status: EnrolmentStatus.ACTIVE,
      }));

    if (enrolmentsToInsert.length > 0) {
      console.log(`  Batch enrolling ${enrolmentsToInsert.length} students into Section ${section.name}...`);
      await prisma.enrolment.createMany({
        data: enrolmentsToInsert,
        skipDuplicates: true,
      });
    }
  }

  // 7. Verify Results
  console.log("\n=== POST-EXECUTION VERIFICATION ===");
  const finalStudentsCount = await prisma.student.count({ where: { tenantId: noida.id } });
  const finalEnrolmentsCount = await prisma.enrolment.count({
    where: { tenantId: noida.id, sectionId: section.id, status: EnrolmentStatus.ACTIVE },
  });

  console.log(`  IOI Noida Total Students in DB: ${finalStudentsCount}`);
  console.log(`  IOI Noida Section A Active Enrolments: ${finalEnrolmentsCount}`);

  // Query using application service under Bhumika's TEACHER context
  const rosterResult = await listStudents(
    noida.id,
    { pageSize: 50 },
    { userId: user.id, role: "TEACHER" },
  );

  console.log(`  Teacher Authorization Query Result (listStudents under Bhumika Sharma):`);
  console.log(`    Total Students Accessible: ${rosterResult.total}`);
  console.log(`    Target of 25 Reached: ${rosterResult.total === 25 ? "YES (EXACTLY 25)" : "NO (" + rosterResult.total + ")"}`);

  // 8. Verify Pune and Lucknow Remain Untouched
  const puneStudents = await prisma.enrolment.count({
    where: { tenant: { slug: "ioi-pune" }, status: EnrolmentStatus.ACTIVE },
  });
  const lucknowStudents = await prisma.enrolment.count({
    where: { tenant: { slug: "ioi-lucknow" }, status: EnrolmentStatus.ACTIVE },
  });

  console.log(`\nCross-Tenant Integrity Check:`);
  console.log(`  IOI Pune Active Assigned Students   : ${puneStudents} (Unchanged = ${puneStudents === 50})`);
  console.log(`  IOI Lucknow Active Assigned Students: ${lucknowStudents} (Unchanged = ${lucknowStudents === 50})`);

  console.log("\n=== WORKFLOW COMPLETED SUCCESSFULLY ===");
}

main()
  .catch((err) => {
    console.error("Assignment workflow failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
