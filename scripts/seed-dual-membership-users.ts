/**
 * seed-dual-membership-users.ts
 *
 * Requirements (P1.9):
 * - Provisions persistent dual-membership and single-membership test personas for QA.
 * - Test cases supported:
 *   1. Dual-membership user with different roles: TEACHER in School A, SCHOOL_ADMIN in School B.
 *   2. Dual-membership teacher: TEACHER in School A, TEACHER in School B.
 *   3. Single-school teacher: TEACHER only in School A.
 * - Fully idempotent: safe to run multiple times.
 * - Outputs clear credential table for manual QA and automated API tests.
 *
 * Run with: npx tsx scripts/seed-dual-membership-users.ts
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });
dotenv.config();

import bcrypt from "bcryptjs";
import { PrismaClient, MembershipRole, MembershipStatus } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_TEST_PASSWORD = "Password@123";

async function main() {
  console.log("=======================================================");
  console.log("   ClassForge: Seed Dual-Membership Test Users (P1.9)  ");
  console.log("=======================================================\n");

  const passwordHash = await bcrypt.hash(DEFAULT_TEST_PASSWORD, 10);

  // 1. Ensure at least two schools exist
  let schoolA = await prisma.tenant.findUnique({ where: { slug: "greenwood" } });
  if (!schoolA) {
    schoolA = await prisma.tenant.create({
      data: {
        name: "Greenwood High School",
        slug: "greenwood",
        status: "ACTIVE",
      },
    });
  }

  let schoolB = await prisma.tenant.findUnique({ where: { slug: "hillcrest" } });
  if (!schoolB) {
    schoolB = await prisma.tenant.create({
      data: {
        name: "Hillcrest International School",
        slug: "hillcrest",
        status: "ACTIVE",
      },
    });
  }

  console.log(`School A: ${schoolA.name} (${schoolA.slug}) - ID: ${schoolA.id}`);
  console.log(`School B: ${schoolB.name} (${schoolB.slug}) - ID: ${schoolB.id}\n`);

  // 2. Provision Persona 1: Dual Staff (Teacher in A, Admin in B)
  const dualStaffEmail = "dual.staff@classforge.dev";
  const userDualStaff = await prisma.user.upsert({
    where: { email: dualStaffEmail },
    create: {
      name: "Aditi Rao (Dual Staff)",
      email: dualStaffEmail,
      passwordHash,
    },
    update: {
      name: "Aditi Rao (Dual Staff)",
      passwordHash,
    },
  });

  await prisma.membership.upsert({
    where: { tenantId_userId: { tenantId: schoolA.id, userId: userDualStaff.id } },
    create: {
      tenantId: schoolA.id,
      userId: userDualStaff.id,
      role: MembershipRole.TEACHER,
      status: MembershipStatus.ACTIVE,
    },
    update: {
      role: MembershipRole.TEACHER,
      status: MembershipStatus.ACTIVE,
    },
  });

  await prisma.membership.upsert({
    where: { tenantId_userId: { tenantId: schoolB.id, userId: userDualStaff.id } },
    create: {
      tenantId: schoolB.id,
      userId: userDualStaff.id,
      role: MembershipRole.SCHOOL_ADMIN,
      status: MembershipStatus.ACTIVE,
    },
    update: {
      role: MembershipRole.SCHOOL_ADMIN,
      status: MembershipStatus.ACTIVE,
    },
  });

  // Ensure Teacher record in School A
  await prisma.teacher.upsert({
    where: { tenantId_userId: { tenantId: schoolA.id, userId: userDualStaff.id } },
    create: {
      tenantId: schoolA.id,
      userId: userDualStaff.id,
      firstName: "Aditi",
      lastName: "Rao",
      employeeNo: "T-GW-001",
      designation: "Senior Teacher",
    },
    update: {
      firstName: "Aditi",
      lastName: "Rao",
      employeeNo: "T-GW-001",
    },
  });

  // 3. Provision Persona 2: Dual Teacher (Teacher in both A and B)
  const dualTeacherEmail = "dual.teacher@classforge.dev";
  const userDualTeacher = await prisma.user.upsert({
    where: { email: dualTeacherEmail },
    create: {
      name: "Rohan Varma (Dual Teacher)",
      email: dualTeacherEmail,
      passwordHash,
    },
    update: {
      name: "Rohan Varma (Dual Teacher)",
      passwordHash,
    },
  });

  await prisma.membership.upsert({
    where: { tenantId_userId: { tenantId: schoolA.id, userId: userDualTeacher.id } },
    create: {
      tenantId: schoolA.id,
      userId: userDualTeacher.id,
      role: MembershipRole.TEACHER,
      status: MembershipStatus.ACTIVE,
    },
    update: {
      role: MembershipRole.TEACHER,
      status: MembershipStatus.ACTIVE,
    },
  });

  await prisma.membership.upsert({
    where: { tenantId_userId: { tenantId: schoolB.id, userId: userDualTeacher.id } },
    create: {
      tenantId: schoolB.id,
      userId: userDualTeacher.id,
      role: MembershipRole.TEACHER,
      status: MembershipStatus.ACTIVE,
    },
    update: {
      role: MembershipRole.TEACHER,
      status: MembershipStatus.ACTIVE,
    },
  });

  // Ensure Teacher records in both schools
  await prisma.teacher.upsert({
    where: { tenantId_userId: { tenantId: schoolA.id, userId: userDualTeacher.id } },
    create: {
      tenantId: schoolA.id,
      userId: userDualTeacher.id,
      firstName: "Rohan",
      lastName: "Varma",
      employeeNo: "T-GW-002",
      designation: "Physics Teacher",
    },
    update: {
      firstName: "Rohan",
      lastName: "Varma",
      employeeNo: "T-GW-002",
    },
  });

  await prisma.teacher.upsert({
    where: { tenantId_userId: { tenantId: schoolB.id, userId: userDualTeacher.id } },
    create: {
      tenantId: schoolB.id,
      userId: userDualTeacher.id,
      firstName: "Rohan",
      lastName: "Varma",
      employeeNo: "T-HC-001",
      designation: "Physics Lecturer",
    },
    update: {
      firstName: "Rohan",
      lastName: "Varma",
      employeeNo: "T-HC-001",
    },
  });

  // 4. Provision Persona 3: Single Teacher (Teacher only in School A)
  const singleTeacherEmail = "single.teacher@classforge.dev";
  const userSingleTeacher = await prisma.user.upsert({
    where: { email: singleTeacherEmail },
    create: {
      name: "Priya Sharma (Single Teacher)",
      email: singleTeacherEmail,
      passwordHash,
    },
    update: {
      name: "Priya Sharma (Single Teacher)",
      passwordHash,
    },
  });

  await prisma.membership.upsert({
    where: { tenantId_userId: { tenantId: schoolA.id, userId: userSingleTeacher.id } },
    create: {
      tenantId: schoolA.id,
      userId: userSingleTeacher.id,
      role: MembershipRole.TEACHER,
      status: MembershipStatus.ACTIVE,
    },
    update: {
      role: MembershipRole.TEACHER,
      status: MembershipStatus.ACTIVE,
    },
  });

  await prisma.teacher.upsert({
    where: { tenantId_userId: { tenantId: schoolA.id, userId: userSingleTeacher.id } },
    create: {
      tenantId: schoolA.id,
      userId: userSingleTeacher.id,
      firstName: "Priya",
      lastName: "Sharma",
      employeeNo: "T-GW-003",
      designation: "Mathematics Teacher",
    },
    update: {
      firstName: "Priya",
      lastName: "Sharma",
      employeeNo: "T-GW-003",
    },
  });

  // Ensure single teacher is NOT in School B
  await prisma.membership.deleteMany({
    where: { tenantId: schoolB.id, userId: userSingleTeacher.id },
  });

  console.log("=======================================================================");
  console.log("             PROVISIONED DUAL & SINGLE MEMBERSHIP USERS                ");
  console.log("=======================================================================");
  console.log(`1. Dual Staff User:`);
  console.log(`   Email   : ${dualStaffEmail}`);
  console.log(`   Password: ${DEFAULT_TEST_PASSWORD}`);
  console.log(`   School A (${schoolA.slug}): Role = TEACHER`);
  console.log(`   School B (${schoolB.slug}): Role = SCHOOL_ADMIN\n`);

  console.log(`2. Dual Teacher User:`);
  console.log(`   Email   : ${dualTeacherEmail}`);
  console.log(`   Password: ${DEFAULT_TEST_PASSWORD}`);
  console.log(`   School A (${schoolA.slug}): Role = TEACHER`);
  console.log(`   School B (${schoolB.slug}): Role = TEACHER\n`);

  console.log(`3. Single Teacher User:`);
  console.log(`   Email   : ${singleTeacherEmail}`);
  console.log(`   Password: ${DEFAULT_TEST_PASSWORD}`);
  console.log(`   School A (${schoolA.slug}): Role = TEACHER`);
  console.log(`   School B (${schoolB.slug}): NO MEMBERSHIP (Access Forbidden)`);
  console.log("=======================================================================\n");
}

main()
  .catch((e) => {
    console.error("Fatal error during dual-membership seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
