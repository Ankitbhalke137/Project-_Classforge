/**
 * seed-demo-students.ts
 *
 * Fast, safe, idempotent script to:
 * 1. Create realistic demo students for IOI Pune (47) and IOI Lucknow (49)
 *    so each teacher reaches exactly 50 assigned students.
 * 2. Enroll demo students in their respective school's class, section, and academic year.
 * 3. Preserve existing student records and assignments.
 * 4. Respect multi-tenant isolation and report environment details.
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { randomUUID } from "node:crypto";
import { PrismaClient, EnrolmentStatus } from "@prisma/client";

const prisma = new PrismaClient();

const PUNE_STUDENT_NAMES = [
  ["Aarav", "Deshmukh"], ["Aditi", "Kulkarni"], ["Advait", "Joshi"], ["Ananya", "Patil"],
  ["Arjun", "Pawar"], ["Avani", "Shinde"], ["Ayush", "Gaikwad"], ["Bhavya", "Bhosale"],
  ["Chaitanya", "More"], ["Devika", "Kadam"], ["Dhruv", "Chavan"], ["Gauri", "Sawant"],
  ["Harsh", "Jadhav"], ["Isha", "Mane"], ["Ishaan", "Salunkhe"], ["Janhavi", "Tambe"],
  ["Kabir", "Bichkar"], ["Kavya", "Kale"], ["Kunal", "Thorat"], ["Madhura", "Ghongade"],
  ["Manish", "Gawande"], ["Meera", "Dhumal"], ["Nakul", "Bhandari"], ["Neha", "Shirke"],
  ["Nikhil", "Ghatge"], ["Omkar", "Dange"], ["Pooja", "Sutar"], ["Pranav", "Vichare"],
  ["Priyanka", "Karve"], ["Rahul", "Dharne"], ["Rhea", "Gholap"], ["Rohan", "Doke"],
  ["Sakshi", "Gawali"], ["Samarth", "Borse"], ["Sanika", "Phadtare"], ["Sarthak", "Khairnar"],
  ["Sayali", "Mahajan"], ["Siddharth", "Gore"], ["Sneha", "Kendre"], ["Soham", "Dabholkar"],
  ["Tanvi", "Lohokare"], ["Tejas", "Hingane"], ["Utkarsh", "Lende"], ["Varun", "Wani"],
  ["Vedant", "Sonawane"], ["Vidhi", "Navale"], ["Yash", "Nimhan"],
]; // exactly 47 names

const LUCKNOW_STUDENT_NAMES = [
  ["Aaliyah", "Khan"], ["Aaradhya", "Tiwari"], ["Abdul", "Rehman"], ["Abhishek", "Shukla"],
  ["Aditya", "Mishra"], ["Afzal", "Ansari"], ["Akansha", "Pandey"], ["Alok", "Dubey"],
  ["Aman", "Gupta"], ["Amir", "Siddiqui"], ["Anamika", "Srivastava"], ["Aniket", "Tripathi"],
  ["Anushka", "Bajpai"], ["Aryan", "Chaubey"], ["Ayushi", "Dixit"], ["Bushra", "Fatima"],
  ["Danish", "Rizvi"], ["Deepak", "Awasthi"], ["Divya", "Upadhyay"], ["Faizan", "Ahmad"],
  ["Farhan", "Qureshi"], ["Gaurav", "Chaturvedi"], ["Hamza", "Sheikh"], ["Himanshu", "Trivedi"],
  ["Iqra", "Malik"], ["Junaid", "Hashmi"], ["Kartik", "Dwivedi"], ["Komal", "Agrahari"],
  ["Manas", "Pathak"], ["Maryam", "Naseem"], ["Mohsin", "Ali"], ["Muskan", "Yadav"],
  ["Naman", "Shukla"], ["Neha", "Verma"], ["Nida", "Parveen"], ["Pooja", "Tiwari"],
  ["Prashant", "Katiyar"], ["Priya", "Singh"], ["Rachit", "Dubey"], ["Razi", "Haider"],
  ["Ritika", "Chaurasia"], ["Rupali", "Tiwari"], ["Saad", "Usmani"], ["Samreen", "Bano"],
  ["Saurabh", "Pandey"], ["Shadab", "Alam"], ["Shreya", "Mishra"], ["Tanya", "Rastogi"],
  ["Zoya", "Mirza"],
]; // exactly 49 names

async function main() {
  console.log("=== SEEDING DEMO STUDENTS FOR TARGET OF 50 PER TEACHER ===");

  // 1. Report Target Database & Environment
  const dbUrl = process.env.DATABASE_URL || "";
  const hostMatch = dbUrl.match(/@([^:\/]+)(?::\d+)?\/([^?]+)/);
  console.log("Target Environment :", process.env.NODE_ENV || "development");
  console.log("Database Host      :", hostMatch ? hostMatch[1] : "unknown");
  console.log("Database Name      :", hostMatch ? hostMatch[2] : "unknown");

  const tenants = await prisma.tenant.findMany({
    orderBy: { name: "asc" },
    include: {
      teachers: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          teachingAssignments: true,
        },
      },
      classes: {
        include: {
          sections: true,
          subjects: true,
        },
      },
      academicYears: true,
    },
  });

  for (const tenant of tenants) {
    console.log(`\n-------------------------------------------------------`);
    console.log(`School: ${tenant.name} (${tenant.slug}) - ID: ${tenant.id}`);

    if (tenant.teachers.length === 0) {
      console.log("  No teachers in this school. Noida remains unchanged as instructed.");
      continue;
    }

    const teacher = tenant.teachers[0];
    const academicYear =
      tenant.academicYears.find((ay) => ay.status === "ACTIVE") ?? tenant.academicYears[0];
    const schoolClass = tenant.classes[0];
    const section = schoolClass?.sections[0];

    if (!academicYear || !schoolClass || !section) {
      console.error(`  Missing academic structure in ${tenant.name}!`);
      continue;
    }

    // Determine current active enrolments in the teacher's section
    const currentEnrolments = await prisma.enrolment.findMany({
      where: {
        tenantId: tenant.id,
        sectionId: section.id,
        status: EnrolmentStatus.ACTIVE,
      },
      select: { studentId: true },
    });

    const currentCount = currentEnrolments.length;
    const target = 50;
    const needed = Math.max(0, target - currentCount);

    console.log(`  Teacher: ${teacher.firstName} ${teacher.lastName} (Teacher ID: ${teacher.id})`);
    console.log(`  Current assigned students: ${currentCount}`);
    console.log(`  Target: ${target} students`);
    console.log(`  Additional demo students needed: ${needed}`);

    if (needed === 0) {
      console.log(`  Target of 50 already reached.`);
      continue;
    }

    const isPune = tenant.slug.includes("pune");
    const nameList = isPune ? PUNE_STUDENT_NAMES : LUCKNOW_STUDENT_NAMES;
    const prefix = isPune ? "DEMO-PUNE" : "DEMO-LKO";

    // 1. Fetch any existing demo students in this tenant
    const existingDemoStudents = await prisma.student.findMany({
      where: {
        tenantId: tenant.id,
        admissionNo: { startsWith: prefix },
      },
    });

    const existingAdmissionNos = new Set(existingDemoStudents.map((s) => s.admissionNo));

    // 2. Prepare new student records to insert
    const studentsToInsert = [];
    for (let i = 1; i <= needed; i++) {
      const admissionNo = `${prefix}-${String(i).padStart(3, "0")}`;
      if (!existingAdmissionNos.has(admissionNo)) {
        const [first, last] = nameList[i - 1] ?? [`Student${i}`, "Demo"];
        studentsToInsert.push({
          id: randomUUID(),
          tenantId: tenant.id,
          admissionNo,
          firstName: first,
          lastName: last,
          guardianName: "[DEMO] Guardian",
          status: "ACTIVE",
        });
      }
    }

    if (studentsToInsert.length > 0) {
      console.log(`  Batch inserting ${studentsToInsert.length} new demo students...`);
      await prisma.student.createMany({
        data: studentsToInsert,
        skipDuplicates: true,
      });
    }

    // 3. Retrieve all demo students for this school to enroll them
    const allDemoStudents = await prisma.student.findMany({
      where: {
        tenantId: tenant.id,
        admissionNo: { startsWith: prefix },
      },
      select: { id: true, admissionNo: true },
    });

    const enrolledStudentIds = new Set(currentEnrolments.map((e) => e.studentId));

    // 4. Enroll any demo students that do not yet have active enrolment
    const enrolmentsToInsert = allDemoStudents
      .filter((s) => !enrolledStudentIds.has(s.id))
      .slice(0, needed)
      .map((s) => ({
        id: randomUUID(),
        tenantId: tenant.id,
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

    // 5. Verify final count for this school
    const finalCount = await prisma.enrolment.count({
      where: {
        tenantId: tenant.id,
        sectionId: section.id,
        status: EnrolmentStatus.ACTIVE,
      },
    });

    console.log(`  Final assigned students for ${teacher.firstName} ${teacher.lastName}: ${finalCount} / ${target}`);
  }

  console.log("\n=== COMPLETED DEMO STUDENT SEEDING ===");
}

main()
  .catch((err) => {
    console.error("Demo student seeding failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
