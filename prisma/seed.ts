
import {
  PrismaClient,
  MembershipRole,
  PlatformRole,
  AcademicYearStatus,
  EnrolmentStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Demo@12345", 10);

  // 1. Create three schools
  const schoolA = await prisma.tenant.upsert({
    where: { slug: "green-valley-school" },
    update: {},
    create: {
      name: "Green Valley School",
      slug: "green-valley-school",
    },
  });

  const schoolB = await prisma.tenant.upsert({
    where: { slug: "sunrise-public-school" },
    update: {},
    create: {
      name: "Sunrise Public School",
      slug: "sunrise-public-school",
    },
  });

  const schoolC = await prisma.tenant.upsert({
    where: { slug: "bright-future-academy" },
    update: {},
    create: {
      name: "Bright Future Academy",
      slug: "bright-future-academy",
    },
  });

  // 2. Create demo users
  const adminA = await prisma.user.upsert({
    where: { email: "admin@greenvalley.demo" },
    update: {},
    create: {
      name: "School Admin A",
      email: "admin@greenvalley.demo",
      passwordHash,
    },
  });

  const teacherB = await prisma.user.upsert({
    where: { email: "teacher@sunrise.demo" },
    update: {},
    create: {
      name: "Teacher B",
      email: "teacher@sunrise.demo",
      passwordHash,
    },
  });

  const isolatedUser = await prisma.user.upsert({
    where: { email: "user@greenvalley.demo" },
    update: {},
    create: {
      name: "Green Valley Only User",
      email: "user@greenvalley.demo",
      passwordHash,
    },
  });

  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@classforge.demo" },
    update: {},
    create: {
      name: "Platform Super Admin",
      email: "superadmin@classforge.demo",
      passwordHash,
      platformRole: PlatformRole.SUPER_ADMIN,
    },
  });

  // 3. Create school memberships
  const memberships = [
    {
      tenantId: schoolA.id,
      userId: adminA.id,
      role: MembershipRole.SCHOOL_ADMIN,
    },
    {
      tenantId: schoolB.id,
      userId: teacherB.id,
      role: MembershipRole.TEACHER,
    },
    {
      tenantId: schoolA.id,
      userId: isolatedUser.id,
      role: MembershipRole.STUDENT,
    },
  ];

  for (const membership of memberships) {
    await prisma.membership.upsert({
      where: {
        tenantId_userId: {
          tenantId: membership.tenantId,
          userId: membership.userId,
        },
      },
      update: { role: membership.role },
      create: membership,
    });
  }

  // 4. Create Green Valley academic year
  const academicYear = await prisma.academicYear.upsert({
    where: {
      tenantId_name: {
        tenantId: schoolA.id,
        name: "2026-2027",
      },
    },
    update: {},
    create: {
      tenantId: schoolA.id,
      name: "2026-2027",
      startDate: new Date("2026-04-01"),
      endDate: new Date("2027-03-31"),
      status: AcademicYearStatus.ACTIVE,
    },
  });

  // 5. Create 10 classes, 20 sections and 30 subjects
  for (let classNumber = 1; classNumber <= 10; classNumber++) {
    const schoolClass = await prisma.schoolClass.upsert({
      where: {
        tenantId_academicYearId_name: {
          tenantId: schoolA.id,
          academicYearId: academicYear.id,
          name: `Class ${classNumber}`,
        },
      },
      update: {},
      create: {
        tenantId: schoolA.id,
        academicYearId: academicYear.id,
        name: `Class ${classNumber}`,
      },
    });

    for (const sectionName of ["A", "B"]) {
      await prisma.section.upsert({
        where: {
          tenantId_classId_name: {
            tenantId: schoolA.id,
            classId: schoolClass.id,
            name: sectionName,
          },
        },
        update: {},
        create: {
          tenantId: schoolA.id,
          classId: schoolClass.id,
          name: sectionName,
        },
      });
    }

    for (const subjectName of ["Mathematics", "English", "Science"]) {
      await prisma.subject.upsert({
        where: {
          tenantId_classId_name: {
            tenantId: schoolA.id,
            classId: schoolClass.id,
            name: subjectName,
          },
        },
        update: {},
        create: {
          tenantId: schoolA.id,
          classId: schoolClass.id,
          name: subjectName,
        },
      });
    }
  }

  // 6. Fetch all Green Valley sections
  const sections = await prisma.section.findMany({
    where: { tenantId: schoolA.id },
    orderBy: [{ name: "asc" }, { createdAt: "asc" }],
  });

  if (sections.length === 0) {
    throw new Error("No sections found for Green Valley School.");
  }

  // 7. Create 500 students and their enrolments
  for (let i = 1; i <= 500; i++) {
    const admissionNo = `GV2026${String(i).padStart(4, "0")}`;
    const section = sections[(i - 1) % sections.length];

    if (!section) {
      throw new Error(`Section not found for student ${i}`);
    }

    const student = await prisma.student.upsert({
      where: {
        tenantId_admissionNo: {
          tenantId: schoolA.id,
          admissionNo,
        },
      },
      update: {},
      create: {
        tenantId: schoolA.id,
        admissionNo,
        firstName: `Student${i}`,
        lastName: "GreenValley",
      },
    });

    const existingEnrolment = await prisma.enrolment.findFirst({
      where: {
        tenantId: schoolA.id,
        studentId: student.id,
        sectionId: section.id,
        academicYearId: academicYear.id,
      },
    });

    if (!existingEnrolment) {
      await prisma.enrolment.create({
        data: {
          tenantId: schoolA.id,
          studentId: student.id,
          sectionId: section.id,
          academicYearId: academicYear.id,
          status: EnrolmentStatus.ACTIVE,
        },
      });
    }
  }

  // 8. Summary
  console.log("Seed completed successfully!");
  console.log(`Schools: ${schoolA.name}, ${schoolB.name}, ${schoolC.name}`);
  console.log("Green Valley: 1 academic year, 10 classes, 20 sections, 30 subjects");
  console.log("Green Valley: 500 demo students and their enrolments");
  console.log(`School Admin: ${adminA.email}`);
  console.log(`Teacher B: ${teacherB.email}`);
  console.log(`Super Admin: ${superAdmin.email}`);
  console.log("Demo password: Demo@12345");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
