/**
 * Academic structure: what is taught, in which class, by whom, and how it went.
 *
 * Built top-down — subjects, then staff, then classes, then everything that
 * hangs off a class — so no fixture has to reach backwards for an id.
 */

import {
  EXAM_SESSIONS,
  ROOMS,
  SCHOOL_DAYS,
  subjectsForGrade,
} from "@/mocks/fixtures/catalog";
import type { SchoolProfile } from "@/mocks/fixtures/profile";
import {
  TODAY,
  addDays,
  chance,
  createRandom,
  dateKey,
  dateTimeKey,
  hashSeed,
  pick,
  randomInt,
  type Random,
} from "@/mocks/fixtures/random";
import type {
  Exam,
  ExamResult,
  Grade,
  SchoolClass,
  Subject,
  Teacher,
  TimetableSlot,
} from "@/types";

/* ---------- Subjects ---------- */

/**
 * One Subject per subject name, not one per grade — a class picks the subjects
 * its grade is offered, so the same Physics id appears across every section.
 */
export function buildSubjects(profile: SchoolProfile): Subject[] {
  const offered = profile.grades.flatMap((grade) => subjectsForGrade(grade));
  const unique = offered.filter(
    (subject, index, all) => all.findIndex((other) => other.name === subject.name) === index,
  );

  return unique.map((subject) => ({
    id: `${profile.slug}_sub_${subject.code.toLowerCase()}`,
    name: subject.name,
    code: subject.code,
    // An empty list in the catalogue means "every grade", so fill it in.
    grades:
      subject.grades.length === 0
        ? [...profile.grades]
        : subject.grades.filter((grade) => profile.grades.includes(grade)),
    maxMarks: subject.maxMarks,
  }));
}

/* ---------- Classes ---------- */

export function buildClasses(
  profile: SchoolProfile,
  random: Random,
  subjects: Subject[],
  teachers: Teacher[],
): SchoolClass[] {
  const classes: SchoolClass[] = [];
  // A school gives each class its own form teacher where it can.
  const taken = new Set<string>();

  for (const grade of profile.grades) {
    const gradeSubjects = subjects.filter((subject) => subject.grades.includes(grade));

    for (const section of profile.sections) {
      const homeroom = pickHomeroomTeacher(gradeSubjects, teachers, taken, random);
      if (homeroom) taken.add(homeroom.id);

      classes.push({
        id: `${profile.slug}_cls_${String(classes.length + 1).padStart(2, "0")}`,
        name: `${grade} · ${section}`,
        grade,
        section,
        room: pick(random, ROOMS),
        homeroomTeacherId: homeroom?.id ?? null,
        subjectIds: gradeSubjects.map((subject) => subject.id),
        // Patched in index.ts once the roster exists.
        studentCount: 0,
        capacity: profile.studentsPerClass + randomInt(random, 1, 5),
      });
    }
  }

  return classes;
}

/** Prefers someone who is not already a form teacher elsewhere. */
function pickHomeroomTeacher(
  gradeSubjects: Subject[],
  teachers: Teacher[],
  taken: Set<string>,
  random: Random,
): Teacher | null {
  const eligible = teachers.filter((teacher) =>
    teacher.subjectIds.some((id) => gradeSubjects.some((subject) => subject.id === id)),
  );

  if (eligible.length === 0) return null;

  const free = eligible.filter((teacher) => !taken.has(teacher.id));
  const pool = free.length > 0 ? free : eligible;
  return pool[randomInt(random, 0, pool.length - 1)];
}

/* ---------- Timetable ---------- */

/**
 * A weekly grid per class.
 *
 * A teacher cannot be in two rooms at once, so each (day, period) keeps a list of
 * teachers already booked and the slot is left out when everyone teaching that
 * subject is busy. The gaps are the double period and assembly.
 */
export function buildTimetable(
  profile: SchoolProfile,
  random: Random,
  classes: SchoolClass[],
  subjects: Subject[],
  teachers: Teacher[],
): TimetableSlot[] {
  const byId = new Map(subjects.map((subject) => [subject.id, subject]));
  const slots: TimetableSlot[] = [];

  // Booked per (day, period) across the whole school, not per class — that is
  // what stops one teacher being placed in two rooms at the same time.
  const bookedByTeacher = new Map<string, Set<string>>();

  for (const schoolClass of classes) {
    const classSubjects = schoolClass.subjectIds.map((id) => byId.get(id)!);

    SCHOOL_DAYS.forEach((day, dayIndex) => {
      for (let period = 1; period <= 6; period += 1) {
        const key = `${day}_${period}`;
        const busy = bookedByTeacher.get(key) ?? new Set<string>();
        bookedByTeacher.set(key, busy);

        const booked = findFreeBooking(classSubjects, teachers, day, period, dayIndex, busy, random);
        if (!booked) continue;

        busy.add(booked.teacherId);
        slots.push({
          id: `${schoolClass.id}_${day}_${period}`,
          classId: schoolClass.id,
          day,
          period,
          subjectId: booked.subjectId,
          teacherId: booked.teacherId,
        });
      }
    });
  }

  return slots;
}

function findFreeBooking(
  classSubjects: Subject[],
  teachers: Teacher[],
  day: string,
  period: number,
  dayIndex: number,
  busy: Set<string>,
  random: Random,
): { subjectId: string; teacherId: string } | null {
  // Rotating the start point means every subject comes round across the week.
  const start = (dayIndex * 2 + period) % classSubjects.length;

  for (let attempt = 0; attempt < classSubjects.length; attempt += 1) {
    const subject = classSubjects[(start + attempt) % classSubjects.length];
    const free = teachers.filter(
      (teacher) =>
        teacher.subjectIds.includes(subject.id) && !busy.has(teacher.id),
    );

    if (free.length > 0) {
      return { subjectId: subject.id, teacherId: pick(random, free).id };
    }
  }

  return null;
}

/* ---------- Exams & results ---------- */

export function buildExams(
  profile: SchoolProfile,
  random: Random,
  classes: SchoolClass[],
  subjects: Subject[],
  teachers: Teacher[],
): Exam[] {
  const byId = new Map(subjects.map((subject) => [subject.id, subject]));
  const exams: Exam[] = [];

  for (const schoolClass of classes) {
    for (const session of EXAM_SESSIONS) {
      const date = addDays(TODAY, session.offset);

      // Every subject the class takes gets examined, as it would in a real school.
      for (const subjectId of schoolClass.subjectIds) {
        const subject = byId.get(subjectId)!;
        // The subject belongs in the id: one session per class covers several
        // subjects, and they would otherwise collide on a single id.
        const examId = `${schoolClass.id}_exam_${slug(session.name)}_${slug(session.term)}_${slug(subject.code)}`;
        const teacherId = examTeacher(subjectId, teachers, random);

        exams.push({
          id: examId,
          name: session.name,
          term: session.term,
          classId: schoolClass.id,
          subjectId,
          teacherId,
          date: dateKey(date),
          maxMarks: subject.maxMarks,
          passMarks: Math.round(subject.maxMarks * 0.35),
          status: session.status,
          publishedAt: session.status === "PUBLISHED" ? dateTimeKey(date, 12) : null,
        });
      }
    }
  }

  return exams;
}

function examTeacher(subjectId: string, teachers: Teacher[], random: Random): string {
  const eligible = teachers.filter((teacher) => teacher.subjectIds.includes(subjectId));
  const pool = eligible.length > 0 ? eligible : teachers;
  return pick(random, pool).id;
}

/**
 * One result per student per exam.
 *
 * Marks lean on a per-student ability rather than pure chance, so the same
 * student tends to do well across subjects and a report card reads plausibly.
 */
export function buildResults(exams: Exam[], studentsByClass: Map<string, string[]>): ExamResult[] {
  const results: ExamResult[] = [];

  for (const exam of exams) {
    if (exam.status === "SCHEDULED") continue;

    const random = createRandom(`${exam.id}:marks`);
    const classIds = studentsByClass.get(exam.classId) ?? [];

    for (const studentId of classIds) {
      // An exam sitting today is only part-marked, which is a state worth showing.
      const unmarked = exam.status === "IN_PROGRESS" && chance(random, 45);
      const ability = hashSeed(studentId) / 0xffffffff;

      const marks = unmarked
        ? null
        : Math.min(
            exam.maxMarks,
            Math.round(exam.maxMarks * (0.25 + ability * 0.55 + random() * 0.3)),
          );

      const percentage = marks === null ? null : (marks / exam.maxMarks) * 100;

      results.push({
        id: `${exam.id}_res_${studentId}`,
        examId: exam.id,
        studentId,
        marksObtained: marks,
        grade: percentage === null ? null : gradeFor(percentage),
        remarks: remarkFor(percentage, exam),
      });
    }
  }

  return results;
}

/** The published band at or below this percentage. */
export function gradeFor(percentage: number): Grade {
  const bands: readonly { grade: Grade; min: number }[] = [
    { grade: "A+", min: 90 },
    { grade: "A", min: 80 },
    { grade: "B+", min: 70 },
    { grade: "B", min: 60 },
    { grade: "C", min: 50 },
    { grade: "D", min: 40 },
    { grade: "E", min: 0 },
  ];

  return bands.find((band) => percentage >= band.min)?.grade ?? "E";
}

function remarkFor(percentage: number | null, exam: Exam): string | null {
  if (percentage === null) return "Not yet marked";
  if (percentage >= 90) return "Outstanding";
  if (percentage < 35) return "Below pass mark — needs a catch-up session";
  if (percentage < 50) return "Needs revision";
  if (percentage < exam.passMarks) return "Borderline pass";
  return null;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 12);
}