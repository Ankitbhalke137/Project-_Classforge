/**
 * seed-500-students.ts
 *
 * Requirements (P1.8):
 * - Bulk generate and enroll 500 realistic students in one school.
 * - Format admission numbers with unique pattern (e.g. STU-2026-XXXXXX).
 * - Distribute students across classes and sections.
 * - Fast batch inserts using createMany.
 * - Fully idempotent: running multiple times does not create duplicates.
 *
 * Run with: npx tsx scripts/seed-500-students.ts [schoolSlug]
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });
dotenv.config();

import { randomUUID } from "node:crypto";
import { PrismaClient, EnrolmentStatus } from "@prisma/client";

const prisma = new PrismaClient();

const FIRST_NAMES = [
  "Aarav", "Aditi", "Advait", "Ananya", "Arjun", "Avani", "Ayush", "Bhavya",
  "Chaitanya", "Devika", "Dhruv", "Gauri", "Harsh", "Isha", "Ishaan", "Janhavi",
  "Kabir", "Kavya", "Kunal", "Madhura", "Manish", "Meera", "Nakul", "Neha",
  "Nikhil", "Omkar", "Pooja", "Pranav", "Priyanka", "Rahul", "Rhea", "Rohan",
  "Sakshi", "Samarth", "Sanika", "Sarthak", "Sayali", "Siddharth", "Sneha", "Soham",
  "Tanvi", "Tejas", "Utkarsh", "Varun", "Vedant", "Vidhi", "Yash", "Zoya",
  "Aaliyah", "Aaradhya", "Abdul", "Abhishek", "Aditya", "Afzal", "Akansha", "Alok",
  "Aman", "Amir", "Anamika", "Aniket", "Anushka", "Aryan", "Ayushi", "Bushra",
  "Danish", "Deepak", "Divya", "Faizan", "Farhan", "Gaurav", "Hamza", "Himanshu",
  "Iqra", "Junaid", "Kartik", "Komal", "Manas", "Maryam", "Mohsin", "Muskan",
  "Naman", "Nida", "Prashant", "Priya", "Rachit", "Razi", "Ritika", "Rupali",
  "Saad", "Samreen", "Saurabh", "Shadab", "Shreya", "Tanya", "Vihaan", "Reyansh"
];

const LAST_NAMES = [
  "Sharma", "Verma", "Patil", "Deshmukh", "Kulkarni", "Joshi", "Pawar", "Shinde",
  "Gaikwad", "Bhosale", "More", "Kadam", "Chavan", "Sawant", "Jadhav", "Mane",
  "Mishra", "Pandey", "Tiwari", "Dubey", "Shukla", "Tripathi", "Upadhyay", "Awasthi",
  "Srivastava", "Singh", "Gupta", "Agarwal", "Rathore", "Chauhan", "Bhatia", "Malik",
  "Khan", "Ansari", "Siddiqui", "Qureshi", "Fatima", "Shaikh", "Ahmed", "Rizvi"
];

async function main() {
  console.log("=======================================================");
  console.log("   ClassForge: Seed 500 Students (P1.8)                ");
  console.log("=======================================================\n");

  const targetSlug = process.argv[2]?.trim().toLowerCase() || "greenwood";

  // 1. Locate or create target school
  let tenant = await prisma.tenant.findUnique({
    where: { slug: targetSlug },
    include: {
      academicYears: true,
      classes: { include: { sections: true } },
    },
  });

  if (!tenant) {
    // Check if any tenant exists, or create target tenant
    const anyTenant = await prisma.tenant.findFirst({
      include: {
        academicYears: true,
        classes: { include: { sections: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    if (anyTenant) {
      tenant = anyTenant;
      console.log(`Using existing school: ${tenant.name} (${tenant.slug})`);
    } else {
      console.log(`Creating default school: Greenwood High (${targetSlug})...`);
      const newTenant = await prisma.tenant.create({
        data: {
          name: "Greenwood High School",
          slug: targetSlug,
          status: "ACTIVE",
        },
      });
      tenant = { ...newTenant, academicYears: [], classes: [] };
    }
  } else {
    console.log(`Target School: ${tenant.name} (${tenant.slug})`);
  }

  const tenantId = tenant.id;

  // 2. Ensure Academic Year exists
  let academicYear = tenant.academicYears.find((ay) => ay.status === "ACTIVE") ?? tenant.academicYears[0];
  if (!academicYear) {
    console.log("Creating Active Academic Year (2026-2027)...");
    academicYear = await prisma.academicYear.create({
      data: {
        tenantId,
        name: "2026-2027",
        startDate: new Date("2026-04-01"),
        endDate: new Date("2027-03-31"),
        status: "ACTIVE",
      },
    });
  }

  // 3. Ensure Classes and Sections exist (e.g. Grade 9 & Grade 10, sections A, B, C, D)
  const classNames = ["Grade 9", "Grade 10"];
  const sectionLetters = ["A", "B", "C", "D"];
  const activeSections: { id: string; name: string }[] = [];

  for (const cName of classNames) {
    let cls = tenant.classes.find((c) => c.name === cName);
    if (!cls) {
      cls = await prisma.schoolClass.create({
        data: {
          tenantId,
          academicYearId: academicYear.id,
          name: cName,
        },
      });
    }

    for (const sLetter of sectionLetters) {
      let sec = cls.sections?.find((s) => s.name === sLetter);
      if (!sec) {
        sec = await prisma.section.create({
          data: {
            tenantId,
            classId: cls.id,
            name: sLetter,
          },
        });
      }
      activeSections.push({ id: sec.id, name: `${cName} - ${sLetter}` });
    }
  }

  console.log(`Available Sections for enrollment: ${activeSections.length}`);

  // 4. Check existing students with prefix STU-2026-500-
  const PREFIX = "STU-2026-500-";
  const TARGET_TOTAL = 500;

  const existingStudents = await prisma.student.findMany({
    where: {
      tenantId,
      admissionNo: { startsWith: PREFIX },
    },
    select: { id: true, admissionNo: true },
  });

  const existingAdmissionSet = new Set(existingStudents.map((s) => s.admissionNo));
  const currentCount = existingStudents.length;

  console.log(`Existing 500-batch students found: ${currentCount}/${TARGET_TOTAL}`);

  if (currentCount >= TARGET_TOTAL) {
    console.log(`✅ School ${tenant.name} already has ${currentCount} seeded students. No new students needed.`);
    return;
  }

  const needed = TARGET_TOTAL - currentCount;
  console.log(`Generating ${needed} new students...`);

  // 5. Generate student records
  const studentsToInsert: any[] = [];
  const generatedAdmissionNos: string[] = [];

  let seq = 1;
  while (studentsToInsert.length < needed && seq <= 1000) {
    const admissionNo = `${PREFIX}${String(seq).padStart(4, "0")}`;
    seq++;

    if (!existingAdmissionSet.has(admissionNo)) {
      const firstName = FIRST_NAMES[(seq * 7) % FIRST_NAMES.length];
      const lastName = LAST_NAMES[(seq * 11) % LAST_NAMES.length];
      const guardianLast = LAST_NAMES[(seq * 13) % LAST_NAMES.length];

      studentsToInsert.push({
        id: randomUUID(),
        tenantId,
        admissionNo,
        firstName,
        lastName,
        guardianName: `${FIRST_NAMES[(seq * 5) % FIRST_NAMES.length]} ${guardianLast}`,
        guardianPhone: `+91-98765${String(10000 + seq).slice(-5)}`,
        status: "ACTIVE",
      });
      generatedAdmissionNos.push(admissionNo);
    }
  }

  // 6. Batch create students
  console.log(`Inserting ${studentsToInsert.length} students via createMany...`);
  const insertStart = Date.now();
  await prisma.student.createMany({
    data: studentsToInsert,
    skipDuplicates: true,
  });
  console.log(`Batch insert completed in ${Date.now() - insertStart}ms.`);

  // 7. Retrieve created students to create enrollments
  const allBatchStudents = await prisma.student.findMany({
    where: {
      tenantId,
      admissionNo: { startsWith: PREFIX },
    },
    select: { id: true, admissionNo: true },
  });

  // Check existing enrolments
  const existingEnrolments = await prisma.enrolment.findMany({
    where: {
      tenantId,
      academicYearId: academicYear.id,
      studentId: { in: allBatchStudents.map((s) => s.id) },
    },
    select: { studentId: true },
  });
  const enrolledStudentIds = new Set(existingEnrolments.map((e) => e.studentId));

  const unenrolledStudents = allBatchStudents.filter((s) => !enrolledStudentIds.has(s.id));

  if (unenrolledStudents.length > 0) {
    console.log(`Enrolling ${unenrolledStudents.length} students across ${activeSections.length} sections...`);
    const enrolmentsToInsert = unenrolledStudents.map((student, idx) => {
      const section = activeSections[idx % activeSections.length];
      return {
        id: randomUUID(),
        tenantId,
        studentId: student.id,
        sectionId: section.id,
        academicYearId: academicYear.id,
        status: EnrolmentStatus.ACTIVE,
      };
    });

    await prisma.enrolment.createMany({
      data: enrolmentsToInsert,
      skipDuplicates: true,
    });
    console.log(`Successfully created ${enrolmentsToInsert.length} enrolment records.`);
  }

  // 8. Final Count Verification
  const finalTotal = await prisma.student.count({
    where: { tenantId, admissionNo: { startsWith: PREFIX } },
  });
  const finalEnrolled = await prisma.enrolment.count({
    where: {
      tenantId,
      academicYearId: academicYear.id,
      student: { admissionNo: { startsWith: PREFIX } },
    },
  });

  console.log("\n=======================================================");
  console.log(`✅ SEED COMPLETED FOR ${tenant.name}:`);
  console.log(`   Total Seeded Students : ${finalTotal}`);
  console.log(`   Total Active Enrolments: ${finalEnrolled}`);
  console.log("=======================================================\n");
}

main()
  .catch((e) => {
    console.error("Fatal error during 500-student seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
