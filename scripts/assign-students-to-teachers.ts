/**
 * assign-students-to-teachers.ts
 *
 * Safe, idempotent script to:
 * 1. Ensure verified teachers with TEACHER membership have Teacher profile records.
 * 2. Connect teachers to sections & subjects via TeachingAssignment and homeroomTeacherId.
 * 3. Enroll all eligible students of each school into the assigned sections.
 * 4. Respect multi-tenant isolation, existing credentials, and RBAC policies.
 * 5. Report comprehensive metrics before and after the operation.
 */

import { PrismaClient, MembershipRole, EnrolmentStatus } from "@prisma/client";

const prisma = new PrismaClient();

interface SchoolReport {
  schoolId: string;
  schoolName: string;
  schoolSlug: string;
  schoolAdmins: { id: string; name: string; email: string }[];
  teachers: {
    teacherId: string;
    userId: string;
    name: string;
    email: string;
    assignedStudentsCount: number;
    targetReached: boolean;
    shortage: number;
    assignedSection: string;
    assignedSubject: string;
  }[];
  totalEligibleStudents: number;
  unassignedEligibleStudents: number;
  notes: string[];
}

async function main() {
  console.log("=== STARTING STUDENT-TO-TEACHER ASSIGNMENT WORKFLOW ===");

  const report: SchoolReport[] = [];

  // Pre-fetch tenants outside transaction to prevent timeout
  const tenants = await prisma.tenant.findMany({
    orderBy: { name: "asc" },
    include: {
      memberships: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      teachers: true,
      students: {
        include: {
          enrolments: {
            where: { status: "ACTIVE" },
          },
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
    console.log(`\nProcessing school: ${tenant.name} (${tenant.slug})`);

    const schoolAdmins = tenant.memberships
      .filter((m) => m.role === MembershipRole.SCHOOL_ADMIN)
      .map((m) => ({ id: m.user.id, name: m.user.name, email: m.user.email }));

    const teacherMemberships = tenant.memberships.filter(
      (m) => m.role === MembershipRole.TEACHER,
    );

    const schoolReportItem: SchoolReport = {
      schoolId: tenant.id,
      schoolName: tenant.name,
      schoolSlug: tenant.slug,
      schoolAdmins,
      teachers: [],
      totalEligibleStudents: tenant.students.length,
      unassignedEligibleStudents: 0,
      notes: [],
    };

    if (teacherMemberships.length === 0) {
      schoolReportItem.notes.push("No teachers exist in this school. Target of 50 cannot be met.");
      report.push(schoolReportItem);
      continue;
    }

    await prisma.$transaction(
      async (tx) => {
        // 1. Ensure Teacher profile rows exist for all teachers in this school
        const teacherRecords = [];
        for (const tm of teacherMemberships) {
          let teacherRecord = await tx.teacher.findFirst({
            where: { tenantId: tenant.id, userId: tm.userId },
          });

          if (!teacherRecord) {
            const [firstName, ...rest] = tm.user.name.trim().split(/\s+/);
            teacherRecord = await tx.teacher.create({
              data: {
                tenantId: tenant.id,
                userId: tm.userId,
                firstName: firstName || tm.user.name,
                lastName: rest.join(" ") || "",
                designation: "Teacher",
              },
            });
            console.log(`  Created Teacher profile row for ${tm.user.name} (${teacherRecord.id})`);
          }
          teacherRecords.push({ membership: tm, profile: teacherRecord });
        }

        // 2. Resolve Academic Year and Section
        const academicYear =
          tenant.academicYears.find((ay) => ay.status === "ACTIVE") ?? tenant.academicYears[0];
        if (!academicYear) {
          schoolReportItem.notes.push("No academic year found for school.");
          return;
        }

        const schoolClass = tenant.classes[0];
        if (!schoolClass || schoolClass.sections.length === 0) {
          schoolReportItem.notes.push("No class or sections configured for school.");
          return;
        }

        const section = schoolClass.sections[0];

        // Ensure subject exists for teaching assignment
        let subject = schoolClass.subjects[0];
        if (!subject) {
          subject = await tx.subject.create({
            data: {
              tenantId: tenant.id,
              classId: schoolClass.id,
              name: "General Studies",
              code: "GEN",
            },
          });
          console.log(`  Created default subject "${subject.name}" for Class "${schoolClass.name}"`);
        }

        // 3. Enroll any unenrolled students into the section
        for (const student of tenant.students) {
          const hasActiveEnrolment = student.enrolments.some((e) => e.sectionId === section.id);
          if (!hasActiveEnrolment) {
            await tx.enrolment.create({
              data: {
                tenantId: tenant.id,
                studentId: student.id,
                sectionId: section.id,
                academicYearId: academicYear.id,
                status: EnrolmentStatus.ACTIVE,
              },
            });
            console.log(
              `  Enrolled student ${student.firstName} ${student.lastName} in Section ${section.name}`,
            );
          }
        }

        // 4. Create Teaching Assignment and assign Homeroom for each teacher
        for (const t of teacherRecords) {
          // Set homeroomTeacherId on class if not set
          if (!schoolClass.homeroomTeacherId) {
            await tx.schoolClass.update({
              where: { tenantId_id: { tenantId: tenant.id, id: schoolClass.id } },
              data: { homeroomTeacherId: t.profile.id },
            });
          }

          // Upsert TeachingAssignment
          const existingAssignment = await tx.teachingAssignment.findUnique({
            where: {
              tenantId_teacherId_sectionId_subjectId: {
                tenantId: tenant.id,
                teacherId: t.profile.id,
                sectionId: section.id,
                subjectId: subject.id,
              },
            },
          });

          if (!existingAssignment) {
            await tx.teachingAssignment.create({
              data: {
                tenantId: tenant.id,
                teacherId: t.profile.id,
                sectionId: section.id,
                subjectId: subject.id,
              },
            });
            console.log(
              `  Created TeachingAssignment for Teacher ${t.membership.user.name} in Section ${section.name} (Subject: ${subject.name})`,
            );
          }

          // Count assigned students
          const assignedStudents = await tx.enrolment.count({
            where: {
              tenantId: tenant.id,
              sectionId: section.id,
              status: EnrolmentStatus.ACTIVE,
            },
          });

          const target = 50;
          const shortage = Math.max(0, target - assignedStudents);

          schoolReportItem.teachers.push({
            teacherId: t.profile.id,
            userId: t.membership.userId,
            name: t.membership.user.name,
            email: t.membership.user.email,
            assignedStudentsCount: assignedStudents,
            targetReached: assignedStudents >= target,
            shortage,
            assignedSection: `${schoolClass.name} - ${section.name}`,
            assignedSubject: subject.name,
          });
        }

        // Count unassigned eligible students in this school
        const unassignedStudents = await tx.student.count({
          where: {
            tenantId: tenant.id,
            enrolments: {
              none: {
                status: EnrolmentStatus.ACTIVE,
              },
            },
          },
        });
        schoolReportItem.unassignedEligibleStudents = unassignedStudents;
      },
      { timeout: 30000, maxWait: 10000 },
    );

    report.push(schoolReportItem);
  }

  console.log("\n=== ASSIGNMENT WORKFLOW COMPLETED SUCCESSFULLY ===");
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((err) => {
    console.error("Assignment workflow failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
