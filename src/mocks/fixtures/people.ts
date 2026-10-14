/**
 * The people in a school: staff first (classes need a homeroom teacher), then
 * students (classes need a roster), then parents (students need a guardian).
 */

import {
  AREAS,
  BLOOD_GROUPS,
  DESIGNATIONS,
  FIRST_NAMES,
  LAST_NAMES,
  OCCUPATIONS,
  QUALIFICATIONS,
  RESERVED_STUDENT_NAMES,
  RESERVED_TEACHER_NAMES,
  STREETS,
} from "@/mocks/fixtures/catalog";
import type { SchoolProfile } from "@/mocks/fixtures/profile";
import {
  TODAY,
  addDays,
  hashSeed,
  pick,
  randomInt,
  type Random,
} from "@/mocks/fixtures/random";
import type { Gender, Parent, SchoolClass, Student, Subject, Teacher } from "@/types";

/* ---------- Staff ---------- */

/**
 * One teacher per subject on offer first, then the remaining budget spread round
 * robin. The extras are what give the timetable enough free teachers to avoid
 * double-booking somebody into two rooms in the same period.
 */
export function buildTeachers(
  profile: SchoolProfile,
  random: Random,
  subjects: Subject[],
): Teacher[] {
  const teachers: Teacher[] = [];

  const addTeacher = (subject: Subject, isFirstForSubject: boolean) => {
    const sequence = teachers.length + 1;
    const name = teacherName(profile, sequence);
    const [first, last] = name.split(" ");

    teachers.push({
      id: `${profile.slug}_tch_${String(sequence).padStart(2, "0")}`,
      name,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@${profile.slug}.edu`,
      subject: subject.name,
      employeeNo: `${profile.code}-T-${String(sequence).padStart(3, "0")}`,
      phone: `+91 ${randomInt(random, 70_000, 99_999)} ${randomInt(random, 10_000, 99_999)}`,
      qualification: pick(random, QUALIFICATIONS),
      // Whoever opens a subject heads the department.
      designation: isFirstForSubject ? "Head of Department" : pick(random, DESIGNATIONS),
      joinedOn: addDays(TODAY, -randomInt(random, 200, 3_800)).toISOString(),
      subjectIds: [subject.id],
      // Filled in by attachClassesToTeachers.
      classIds: [],
    });
  };

  for (const subject of subjects) addTeacher(subject, true);
  for (let index = 0; teachers.length < profile.teacherCount; index += 1) {
    addTeacher(subjects[index % subjects.length], false);
  }

  return teachers;
}

/** Greenwood's first three teachers are the named demo accounts. */
function teacherName(profile: SchoolProfile, sequence: number): string {
  if (profile.slug === "greenwood" && sequence <= RESERVED_TEACHER_NAMES.length) {
    return RESERVED_TEACHER_NAMES[sequence - 1];
  }

  const offset = hashSeed(`${profile.slug}:teacher:${sequence}`) % (FIRST_NAMES.length * LAST_NAMES.length);
  return `${FIRST_NAMES[offset % FIRST_NAMES.length]} ${LAST_NAMES[Math.floor(offset / FIRST_NAMES.length) % LAST_NAMES.length]}`;
}

/** Called once the classes exist — a teacher belongs to every class they teach. */
export function attachClassesToTeachers(
  teachers: Teacher[],
  classes: SchoolClass[],
  timetable: { classId: string; teacherId: string }[],
): void {
  const byTeacher = new Map<string, Set<string>>();

  const link = (teacherId: string, classId: string) => {
    if (!byTeacher.has(teacherId)) byTeacher.set(teacherId, new Set());
    byTeacher.get(teacherId)!.add(classId);
  };

  for (const slot of timetable) link(slot.teacherId, slot.classId);
  for (const schoolClass of classes) {
    if (schoolClass.homeroomTeacherId) link(schoolClass.homeroomTeacherId, schoolClass.id);
  }

  for (const teacher of teachers) {
    teacher.classIds = [...(byTeacher.get(teacher.id) ?? [])];
  }
}

/* ---------- Students ---------- */

export function buildStudents(profile: SchoolProfile, random: Random, classes: SchoolClass[]): Student[] {
  const students: Student[] = [];
  // Churn only shows up in a school with enough students for it to be plausible.
  const hasChurn = profile.studentsPerClass * classes.length >= 20;

  for (const schoolClass of classes) {
    for (let seat = 0; seat < profile.studentsPerClass; seat += 1) {
      const index = students.length;
      const name = studentName(profile, index);
      const [first, last] = name.split(" ");

      students.push({
        id: `${schoolClass.id}_stu_${String(seat + 1).padStart(2, "0")}`,
        name,
        email: `${first.toLowerCase()}.${last.toLowerCase()}@${profile.slug}.edu`,
        admissionNo: admissionNo(profile, schoolClass, seat),
        className: schoolClass.name,
        status: hasChurn && (index % 23 === 5 || index % 31 === 11) ? "INACTIVE" : "ACTIVE",
        classId: schoolClass.id,
        grade: schoolClass.grade,
        section: schoolClass.section,
        gender: genderFor(name),
        dateOfBirth: addDays(TODAY, -randomInt(random, 3_800, 7_000)).toISOString(),
        phone: `+91 ${randomInt(random, 70_000, 99_999)} ${randomInt(random, 10_000, 99_999)}`,
        address: `${randomInt(random, 1, 240)}, ${pick(random, STREETS)}, ${pick(random, AREAS)}`,
        bloodGroup: pick(random, BLOOD_GROUPS),
        // Filled in by attachParents once the guardians exist.
        parentId: null,
        admittedOn: addDays(TODAY, -randomInt(random, 120, 2_000)).toISOString(),
      });
    }
  }

  return students;
}

/**
 * Greenwood's first class is seeded with the named demo students.
 *
 * After that, names come in twos sharing a surname, so a guardian can have two
 * children in the school — which is what the parent demo account needs to show.
 * The pair is counted across classes, so siblings land in different grades.
 */
function studentName(profile: SchoolProfile, index: number): string {
  if (profile.slug === "greenwood" && index < RESERVED_STUDENT_NAMES.length) {
    return RESERVED_STUDENT_NAMES[index];
  }

  const pair = Math.floor(index / 2);
  const surname = LAST_NAMES[hashSeed(`${profile.slug}:surname:${pair}`) % LAST_NAMES.length];

  const pick1 = (seed: number) =>
    FIRST_NAMES[hashSeed(`${profile.slug}:first:${seed}`) % FIRST_NAMES.length];

  let first = pick1(index);

  // Two siblings should not also share a first name.
  if (index % 2 === 1 && first === pick1(index - 1)) {
    first = FIRST_NAMES[(FIRST_NAMES.indexOf(first) + 1) % FIRST_NAMES.length];
  }

  return `${first} ${surname}`;
}

/** "GWH-26-0901" — school code, entry year, grade, then seat in the class. */
function admissionNo(profile: SchoolProfile, schoolClass: SchoolClass, seat: number): string {
  const gradeNumber = schoolClass.grade.replace(/\D/g, "");
  const year = String(TODAY.getFullYear()).slice(2);
  return `${profile.code}-${year}-${gradeNumber}${String(seat + 1).padStart(2, "0")}`;
}

const FEMALE_NAMES = [
  "Sara", "Anya", "Meera", "Priya", "Lena", "Zoya", "Aisha", "Neha", "Fatima", "Ishita",
  "Tanvi", "Sana", "Riya", "Pooja", "Sneha", "Anjali", "Divya", "Trisha", "Kavya", "Nisha",
  "Leena", "Amrita", "Meenal", "Shruti",
];

const MALE_NAMES = [
  "Ravi", "Kabir", "Jon", "Omar", "Dev", "Kim", "Rohan", "Imran", "Arjun", "Vihaan",
  "Aditya", "Karan", "Nikhil", "Rahul", "Vikram", "Kunal", "Sameer", "Manav", "Rohit",
  "Abhay", "Harsh", "Yash", "Neel", "Farhan",
];

/** Taken from the generated name, so the record never contradicts the roster. */
function genderFor(name: string): Gender {
  const [first] = name.split(" ");
  if (FEMALE_NAMES.includes(first)) return "FEMALE";
  if (MALE_NAMES.includes(first)) return "MALE";
  return "OTHER";
}

/* ---------- Parents ---------- */

/**
 * One guardian per pair of students, since the names were generated as siblings.
 * Sara Khan's father is pinned first so the parent demo account really is the
 * guardian of the student demo account.
 */
export function buildParents(profile: SchoolProfile, random: Random, students: Student[]): Parent[] {
  const parents: Parent[] = [];

  students.forEach((student, index) => {
    if (index % 2 === 1 && parents.length > 0) {
      parents[parents.length - 1].studentIds.push(student.id);
      return;
    }

    const surname = student.name.split(" ")[1];
    const isSaraKhan = profile.slug === "greenwood" && index === 0;
    const firstName = isSaraKhan ? "Imran" : pick(random, FIRST_NAMES);

    parents.push({
      id: `${profile.slug}_par_${String(parents.length + 1).padStart(3, "0")}`,
      name: `${firstName} ${surname}`,
      email: `${firstName.toLowerCase()}.${surname.toLowerCase()}@${profile.slug}.edu`,
      phone: `+91 ${randomInt(random, 70_000, 99_999)} ${randomInt(random, 10_000, 99_999)}`,
      occupation: pick(random, OCCUPATIONS),
      studentIds: [student.id],
    });
  });

  return parents;
}

/** Back-link: each student points at the guardian who holds their record. */
export function attachParents(students: Student[], parents: Parent[]): void {
  for (const student of students) {
    student.parentId = parents.find((parent) => parent.studentIds.includes(student.id))?.id ?? null;
  }
}