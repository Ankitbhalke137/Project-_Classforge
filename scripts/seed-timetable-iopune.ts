import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config({ path: ".env.local" });
dotenv.config();

const prisma = new PrismaClient();

const SLUG = "ioi-pune";

/** Periods read from the timetable image (all in ROOM 3). */
const PERIODS = [
  { period: 1, startTime: "09:00", endTime: "10:15", label: "Period 1" },
  { period: 2, startTime: "10:20", endTime: "11:35", label: "Period 2" },
  { period: 3, startTime: "11:40", endTime: "12:55", label: "Period 3" },
  { period: 4, startTime: "13:25", endTime: "14:40", label: "Period 4" },
  { period: 5, startTime: "14:45", endTime: "16:00", label: "Period 5" },
];

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] as const;

function fakeEmail(name: string) {
  return `${name.toLowerCase().replace(/\s+/g, ".")}@wrong.example`;
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: SLUG } });
  if (!tenant) throw new Error(`Tenant ${SLUG} not found`);

  const year = await prisma.academicYear.findFirst({
    where: { tenantId: tenant.id, status: "ACTIVE" },
  });
  if (!year) throw new Error("No ACTIVE academic year for ioi-pune");

  /* ---------- idempotent cleanup for this class ---------- */
  const existingClass = await prisma.schoolClass.findFirst({
    where: { tenantId: tenant.id, name: "Class 10 - A" },
    include: { sections: true },
  });
  if (existingClass) {
    const sectionIds = existingClass.sections.map((s) => s.id);
    await prisma.timetableSlot.deleteMany({
      where: { tenantId: tenant.id, sectionId: { in: sectionIds } },
    });
    await prisma.section.deleteMany({ where: { id: { in: sectionIds } } });
    await prisma.subject.deleteMany({ where: { tenantId: tenant.id, classId: existingClass.id } });
    await prisma.schoolClass.delete({ where: { id: existingClass.id } });
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
      name: "Class 10 - A",
      room: "ROOM 3",
      capacity: 50,
    },
  });
  const section = await prisma.section.create({
    data: { tenantId: tenant.id, classId: schoolClass.id, name: "A" },
  });

  /* ---------- 3. Subjects (from the image) ---------- */
  await prisma.subject.createMany({
    data: [
      { tenantId: tenant.id, classId: schoolClass.id, name: "Operating System", code: "OS" },
      { tenantId: tenant.id, classId: schoolClass.id, name: "OJT / Java Web Developer (Spring Boot)", code: "OJT" },
      { tenantId: tenant.id, classId: schoolClass.id, name: "Data Visualization", code: "DV" },
      { tenantId: tenant.id, classId: schoolClass.id, name: "Essential Language Skills", code: "ELS" },
      { tenantId: tenant.id, classId: schoolClass.id, name: "Advanced Data Structures and Algorithms (DSA-2)", code: "DSA2" },
      { tenantId: tenant.id, classId: schoolClass.id, name: "Python for Data Science", code: "PDS" },
    ],
  });
  const subjList = await prisma.subject.findMany({
    where: { tenantId: tenant.id, classId: schoolClass.id },
  });
  const byName = new Map(subjList.map((s) => [s.name, s]));

  /* ---------- 4. Teachers (names not shown in image -> placeholders) ---------- */
  const teacherNames = ["Faculty A", "Faculty B", "Faculty C", "Faculty D"];
  await prisma.teacher.createMany({
    data: teacherNames.map(function (name, index) {
      return { tenantId: tenant.id, firstName: name, lastName: "", employeeNo: "TCH" + String(index + 1).padStart(3, "0") };
    }),
  });
  const teacherList = await prisma.teacher.findMany({ where: { tenantId: tenant.id } });
  const byTeacher = new Map(teacherList.map(function (t) { return [t.firstName, t]; }));

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
    await prisma.teacher.update({ where: { id: t.id }, data: { userId: user.id } });
  }

  /* ---------- 5. Timetable slots from the image ---------- */
  function slot(day: string, period: number, subject: string, teacher: string) {
    const s = byName.get(subject);
    if (!s) throw new Error("Unknown subject: " + subject);
    const t = byTeacher.get(teacher);
    if (!t) throw new Error("Unknown teacher: " + teacher);
    return {
      tenantId: tenant!.id,
      sectionId: section.id,
      subjectId: s.id,
      teacherId: t.id,
      day: day,
      period: period,
    };
  }

  const slots: ReturnType<typeof slot>[] = [
    /* MONDAY */
    slot("MONDAY", 1, "Operating System", "Faculty A"),
    slot("MONDAY", 2, "OJT / Java Web Developer (Spring Boot)", "Faculty B"),
    slot("MONDAY", 3, "Data Visualization", "Faculty C"),
    slot("MONDAY", 4, "Essential Language Skills", "Faculty D"),
    slot("MONDAY", 5, "Advanced Data Structures and Algorithms (DSA-2)", "Faculty A"),
    /* TUESDAY */
    slot("TUESDAY", 1, "OJT / Java Web Developer (Spring Boot)", "Faculty B"),
    slot("TUESDAY", 2, "Operating System", "Faculty A"),
    slot("TUESDAY", 3, "OJT / Java Web Developer (Spring Boot)", "Faculty B"),
    slot("TUESDAY", 4, "Advanced Data Structures and Algorithms (DSA-2)", "Faculty A"),
    slot("TUESDAY", 5, "Data Visualization", "Faculty C"),
    /* WEDNESDAY */
    slot("WEDNESDAY", 1, "Advanced Data Structures and Algorithms (DSA-2)", "Faculty A"),
    slot("WEDNESDAY", 2, "Operating System", "Faculty A"),
    slot("WEDNESDAY", 3, "Advanced Data Structures and Algorithms (DSA-2)", "Faculty A"),
    slot("WEDNESDAY", 4, "Python for Data Science", "Faculty C"),
    slot("WEDNESDAY", 5, "OJT / Java Web Developer (Spring Boot)", "Faculty B"),
    /* THURSDAY */
    slot("THURSDAY", 1, "Python for Data Science", "Faculty C"),
    slot("THURSDAY", 2, "Advanced Data Structures and Algorithms (DSA-2)", "Faculty A"),
    slot("THURSDAY", 3, "Operating System", "Faculty A"),
    slot("THURSDAY", 4, "Data Visualization", "Faculty C"),
    slot("THURSDAY", 5, "OJT / Java Web Developer (Spring Boot)", "Faculty B"),
    /* FRIDAY */
    slot("FRIDAY", 1, "Essential Language Skills", "Faculty D"),
    slot("FRIDAY", 2, "Operating System", "Faculty A"),
    slot("FRIDAY", 3, "OJT / Java Web Developer (Spring Boot)", "Faculty B"),
    slot("FRIDAY", 4, "OJT / Java Web Developer (Spring Boot)", "Faculty B"),
    slot("FRIDAY", 5, "Advanced Data Structures and Algorithms (DSA-2)", "Faculty A"),
  ];

  await prisma.timetableSlot.createMany({ data: slots });

  /* teaching assignments so the dashboard ownership check resolves */
  const pairs = new Map<string, { teacherId: string; subjectId: string }>();
  for (const s of slots) {
    pairs.set(s.teacherId + "|" + s.subjectId, { teacherId: s.teacherId, subjectId: s.subjectId });
  }
  await prisma.teachingAssignment.createMany({
    data: Array.from(pairs.values()).map(function (p) {
      return { tenantId: tenant.id, teacherId: p.teacherId, subjectId: p.subjectId, sectionId: section.id };
    }),
    skipDuplicates: true,
  });

  console.log("Done. Created for", tenant.name, "(" + tenant.slug + "):");
  console.log("  periods:", PERIODS.length);
  console.log("  class:", schoolClass.name, "-> section", section.name);
  console.log("  subjects:", subjList.length);
  console.log("  teachers:", teacherList.length, "(placeholder emails, names not in image)");
  console.log("  timetable slots:", slots.length);

  await prisma.$disconnect();
}

main().catch(async function (e) {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
