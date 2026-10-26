import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config({ path: ".env.local" });
dotenv.config();

const prisma = new PrismaClient();

/** IOI Lucknow tenant — the school named in the WhatsApp timetable image. */
const SLUG = "ioi-lucknow";

/** 5 teaching periods per day, matching the image: break/lunch are gaps, not rows. */
const PERIODS = [
  { period: 1, startTime: "09:10", endTime: "10:25", label: "Period 1" },
  { period: 2, startTime: "10:35", endTime: "11:50", label: "Period 2" },
  { period: 3, startTime: "12:00", endTime: "13:15", label: "Period 3" },
  { period: 4, startTime: "13:55", endTime: "15:10", label: "Period 4" },
  { period: 5, startTime: "15:20", endTime: "16:35", label: "Period 5" },
];

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] as const;

function fakeEmail(name: string) {
  return `${name.toLowerCase().replace(/\s+/g, ".")}@wrong.example`;
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: SLUG } });
  if (!tenant) throw new Error(`Tenant ${SLUG} not found`);

  const existingClass = await prisma.schoolClass.findFirst({
    where: { tenantId: tenant.id, name: "Class 10 - B" },
    include: { sections: true },
  });
  if (existingClass) {
    // Idempotent: wipe everything we created last time for this class.
    const sectionIds = existingClass.sections.map((s) => s.id);
    await prisma.timetableSlot.deleteMany({
      where: { tenantId: tenant.id, sectionId: { in: sectionIds } },
    });
    await prisma.section.deleteMany({ where: { id: { in: sectionIds } } });
    await prisma.subject.deleteMany({
      where: { tenantId: tenant.id, classId: existingClass.id },
    });
    await prisma.schoolClass.delete({ where: { id: existingClass.id } });
    // Teachers/users/memberships we created for this class.
    const classTeachers = await prisma.teacher.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, userId: true },
    });
    const userIds = classTeachers
      .map((t) => t.userId)
      .filter((id): id is string => Boolean(id));
    await prisma.membership.deleteMany({
      where: { tenantId: tenant.id, userId: { in: userIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.teacher.deleteMany({ where: { tenantId: tenant.id } });
  }

  const year = await prisma.academicYear.findFirst({
    where: { tenantId: tenant.id, status: "ACTIVE" },
  });
  if (!year) throw new Error("No ACTIVE academic year for ioi-lucknow");

  /* ---------- 1. Periods ---------- */
  await prisma.timetablePeriod.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.timetablePeriod.createMany({
    data: PERIODS.map((p) => ({ ...p, tenantId: tenant.id })),
  });

  /* ---------- 2. Class + section ---------- */
  const schoolClass = await prisma.schoolClass.create({
    data: {
      tenantId: tenant.id,
      academicYearId: year.id,
      name: "Class 10 - B",
      room: "10-B",
      capacity: 50,
    },
  });

  const realSection = await prisma.section.create({
    data: { tenantId: tenant.id, classId: schoolClass.id, name: "A" },
  });

  /* ---------- 3. Subjects ---------- */
  const subjects = await prisma.subject.createMany({
    data: [
      { tenantId: tenant.id, classId: schoolClass.id, name: "Operating System", code: "OS" },
      { tenantId: tenant.id, classId: schoolClass.id, name: "Python for Data Science", code: "PDS" },
      { tenantId: tenant.id, classId: schoolClass.id, name: "OJT / Java Web Developer (Spring Boot)", code: "OJT" },
      { tenantId: tenant.id, classId: schoolClass.id, name: "Advanced Data Structures and Algorithms (DSA-2)", code: "DSA2" },
      { tenantId: tenant.id, classId: schoolClass.id, name: "Essential Language Skills", code: "ELS" },
      { tenantId: tenant.id, classId: schoolClass.id, name: "Data Visualization", code: "DV" },
      { tenantId: tenant.id, classId: schoolClass.id, name: "CANVA WORKSHOP", code: "CANVA" },
    ],
  });

  const subjList = await prisma.subject.findMany({
    where: { tenantId: tenant.id, classId: schoolClass.id },
  });
  const byName = new Map(subjList.map((s) => [s.name, s]));

  /* ---------- 4. Teachers (placeholder / wrong emails) ---------- */
  const teachers = await prisma.teacher.createMany({
    data: [
      { tenantId: tenant.id, firstName: "Ram", lastName: "", employeeNo: "TCH001" },
      { tenantId: tenant.id, firstName: "Rohit", lastName: "", employeeNo: "TCH002" },
      { tenantId: tenant.id, firstName: "Nishith", lastName: "", employeeNo: "TCH003" },
      { tenantId: tenant.id, firstName: "Upal", lastName: "", employeeNo: "TCH004" },
      { tenantId: tenant.id, firstName: "Usama", lastName: "", employeeNo: "TCH005" },
      { tenantId: tenant.id, firstName: "Azam", lastName: "", employeeNo: "TCH006" },
    ],
  });

  const teacherList = await prisma.teacher.findMany({ where: { tenantId: tenant.id } });
  const byTeacher = new Map(teacherList.map((t) => [t.firstName, t]));

  /* users + memberships so they can sign in (placeholder passwords) */
  for (const t of teacherList) {
    const user = await prisma.user.create({
      data: {
        name: t.firstName,
        email: fakeEmail(t.firstName),
        passwordHash: await bcrypt.hash("password", 10),
      },
    });
    await prisma.membership.create({
      data: { tenantId: tenant.id, userId: user.id, role: "TEACHER", status: "ACTIVE" },
    });
    await prisma.teacher.update({
      where: { id: t.id },
      data: { userId: user.id },
    });
  }

  /* ---------- 5. Timetable slots from the image ---------- */
  const slot = (day: string, period: number, subject: string, ...teachers: string[]) => {
    const s = byName.get(subject);
    if (!s) throw new Error(`Unknown subject: ${subject}`);
    const t = teachers.map((name) => byTeacher.get(name)).filter(Boolean);
    if (t.length === 0) throw new Error(`No teacher for ${subject}`);
    const teacherId = t[0]!.id;
    return {
      tenantId: tenant.id,
      sectionId: realSection.id,
      subjectId: s.id,
      teacherId,
      day,
      period,
    };
  };

  const slots: ReturnType<typeof slot>[] = [
    /* Monday */
    slot("MONDAY", 1, "Operating System", "Ram"),
    slot("MONDAY", 2, "Python for Data Science", "Rohit"),
    slot("MONDAY", 3, "OJT / Java Web Developer (Spring Boot)", "Usama"),
    slot("MONDAY", 4, "Advanced Data Structures and Algorithms (DSA-2)", "Ram"),
    slot("MONDAY", 5, "Advanced Data Structures and Algorithms (DSA-2)", "Ram"),
    /* Tuesday */
    slot("TUESDAY", 1, "Operating System", "Ram"),
    slot("TUESDAY", 2, "Python for Data Science", "Rohit"),
    slot("TUESDAY", 3, "OJT / Java Web Developer (Spring Boot)", "Usama"),
    slot("TUESDAY", 4, "Operating System", "Ram"),
    slot("TUESDAY", 5, "Python for Data Science", "Ram"),
    /* Wednesday */
    slot("WEDNESDAY", 1, "OJT / Java Web Developer (Spring Boot)", "Usama"),
    slot("WEDNESDAY", 2, "Operating System", "Ram"),
    slot("WEDNESDAY", 3, "Advanced Data Structures and Algorithms (DSA-2)", "Ram"),
    slot("WEDNESDAY", 4, "Advanced Data Structures and Algorithms (DSA-2)", "Ram"),
    slot("WEDNESDAY", 5, "Essential Language Skills", "Azam"),
    /* Thursday */
    slot("THURSDAY", 1, "OJT / Java Web Developer (Spring Boot)", "Usama"),
    slot("THURSDAY", 2, "Python for Data Science", "Rohit"),
    slot("THURSDAY", 3, "Python for Data Science", "Ram"),
    slot("THURSDAY", 4, "Operating System", "Ram"),
    slot("THURSDAY", 5, "Operating System", "Ram"),
    /* Friday */
    slot("FRIDAY", 1, "Essential Language Skills", "Azam"),
    slot("FRIDAY", 2, "Data Visualization", "Upal"),
    slot("FRIDAY", 3, "Data Visualization", "Upal"),
    slot("FRIDAY", 4, "OJT / Java Web Developer (Spring Boot)", "Usama"),
    slot("FRIDAY", 5, "CANVA WORKSHOP", "Azam"),
  ];

  const finalSlots = slots;

  await prisma.timetableSlot.createMany({ data: finalSlots });

  console.log("Done. Created for", tenant.name, "(" + tenant.slug + "):");
  console.log("  periods:", PERIODS.length);
  console.log("  class:", schoolClass.name, "-> section", realSection.name);
  console.log("  subjects:", subjList.length + 1);
  console.log("  teachers:", teacherList.length, "(placeholder emails)");
  console.log("  timetable slots:", finalSlots.length);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
