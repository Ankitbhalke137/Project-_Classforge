/**
 * Builds every fixture once, at module load.
 *
 * The order matters and is the whole reason the builders are split up: subjects
 * exist before staff, staff before classes (a class needs a homeroom teacher),
 * classes before students (a student needs a class), and students before parents
 * (a parent needs a child). Nothing reaches backwards.
 */

import {
  buildClasses,
  buildExams,
  buildResults,
  buildSubjects,
  buildTimetable,
} from "@/mocks/fixtures/academic";
import {
  attachClassesToTeachers,
  attachParents,
  buildParents,
  buildStudents,
  buildTeachers,
} from "@/mocks/fixtures/people";
import { SCHOOL_PROFILES, type SchoolProfile } from "@/mocks/fixtures/profile";
import {
  buildAnnouncements,
  buildAttendance,
  buildFees,
  summariseFees,
} from "@/mocks/fixtures/operations";
import { buildAssignments, buildSubmissions } from "@/mocks/fixtures/assignments";
import { createRandom } from "@/mocks/fixtures/random";
import type {
  Announcement,
  Assignment,
  AssignmentSubmission,
  AttendanceRecord,
  Exam,
  ExamResult,
  FeeInvoice,
  FeeSummary,
  Membership,
  Parent,
  School,
  SchoolClass,
  Student,
  Subject,
  Teacher,
  TimetableSlot,
  User,
} from "@/types";

/** Every demo account uses this password. */
export const DEMO_PASSWORD = "demo1234";

/* ---------- Per-school datasets ---------- */

interface SchoolData {
  subjects: Subject[];
  teachers: Teacher[];
  classes: SchoolClass[];
  students: Student[];
  parents: Parent[];
  timetable: TimetableSlot[];
  exams: Exam[];
  results: ExamResult[];
  assignments: Assignment[];
  submissions: AssignmentSubmission[];
  attendance: AttendanceRecord[];
  announcements: Announcement[];
  invoices: FeeInvoice[];
  feeSummary: FeeSummary;
}

function buildSchoolData(profile: SchoolProfile): SchoolData {
  const random = createRandom(`${profile.slug}:school`);

  const subjects = buildSubjects(profile);
  const teachers = buildTeachers(profile, random, subjects);
  const classes = buildClasses(profile, random, subjects, teachers);
  const timetable = buildTimetable(profile, random, classes, subjects, teachers);

  attachClassesToTeachers(teachers, classes, timetable);

  const students = buildStudents(profile, random, classes);
  for (const schoolClass of classes) {
    schoolClass.studentCount = students.filter((student) => student.classId === schoolClass.id).length;
  }

  const parents = buildParents(profile, random, students);
  attachParents(students, parents);

  // A school that has been onboarded but not yet filled has classes and staff but
  // no exams or registers — the empty states are genuine, not staged.
  const hasStudents = students.length > 0;

  const exams = hasStudents ? buildExams(profile, random, classes, subjects, teachers) : [];
  const studentsByClass = new Map(
    classes.map((schoolClass) => [
      schoolClass.id,
      students.filter((student) => student.classId === schoolClass.id).map((student) => student.id),
    ]),
  );
  const results = hasStudents ? buildResults(exams, studentsByClass) : [];

  const invoices = buildFees(profile, students);

  // Assignments need students and teachers, so they come last.
  const assignments = hasStudents ? buildAssignments(profile, classes, subjects, teachers) : [];

  return {
    subjects,
    teachers,
    classes,
    students,
    parents,
    timetable,
    exams,
    results,
    assignments,
    submissions: hasStudents ? buildSubmissions(assignments, students) : [],
    attendance: hasStudents ? buildAttendance(profile, classes, students) : [],
    announcements: buildAnnouncements(
      profile,
      profile.principalName,
      teachers,
      students.length + teachers.length,
    ),
    invoices: invoices.invoices,
    feeSummary: invoices.summary,
  };
}

const DATA: Record<string, SchoolData> = Object.fromEntries(
  SCHOOL_PROFILES.map((profile) => [profile.slug, buildSchoolData(profile)]),
);

/** A tenant that exists but has nothing in it yet. */
function dataFor(slug: string): SchoolData {
  return (
    DATA[slug] ?? {
      subjects: [],
      teachers: [],
      classes: [],
      students: [],
      parents: [],
      timetable: [],
      exams: [],
      results: [],
      assignments: [],
      submissions: [],
      attendance: [],
      announcements: [],
      invoices: [],
      feeSummary: summariseFees([]),
    }
  );
}

const bySlug = <T>(pick: (data: SchoolData) => T[]): Record<string, T[]> =>
  Object.fromEntries(SCHOOL_PROFILES.map((profile) => [profile.slug, pick(dataFor(profile.slug))]));

export const SUBJECTS = bySlug((data) => data.subjects);
export const TEACHERS = bySlug((data) => data.teachers);
export const CLASSES = bySlug((data) => data.classes);
export const STUDENTS = bySlug((data) => data.students);
export const PARENTS = bySlug((data) => data.parents);
export const TIMETABLE = bySlug((data) => data.timetable);
export const EXAMS = bySlug((data) => data.exams);
export const RESULTS = bySlug((data) => data.results);
export const ASSIGNMENTS = bySlug((data) => data.assignments);
export const SUBMISSIONS = bySlug((data) => data.submissions);
export const ATTENDANCE = bySlug((data) => data.attendance);
export const ANNOUNCEMENTS = bySlug((data) => data.announcements);
export const FEES = bySlug((data) => data.invoices);

export const FEE_SUMMARY: Record<string, FeeSummary> = Object.fromEntries(
  SCHOOL_PROFILES.map((profile) => [profile.slug, dataFor(profile.slug).feeSummary]),
);

/* ---------- Schools ---------- */

/**
 * Counts come from the fixtures rather than being typed in, so a school can never
 * advertise 3 students while the roster lists 72.
 */
export const SCHOOLS: School[] = SCHOOL_PROFILES.map((profile) => {
  const data = dataFor(profile.slug);

  return {
    id: profile.id,
    name: profile.name,
    slug: profile.slug,
    status: profile.status,
    studentCount: data.students.length,
    staffCount: data.teachers.length + data.parents.length,
  };
});

/* ---------- Demo accounts ---------- */

function membership(profile: SchoolProfile, role: Membership["role"]): Membership {
  return {
    schoolId: profile.id,
    schoolSlug: profile.slug,
    schoolName: profile.name,
    role,
    status: profile.status,
  };
}

const greenwood = SCHOOL_PROFILES[0];
const riverside = SCHOOL_PROFILES[1];
const northgate = SCHOOL_PROFILES[2];

/** The person behind each demo login, so "my children" resolves to real records. */
const demoPerson = (slug: string, name: string): { studentId?: string; parentId?: string; teacherId?: string } => ({
  studentId: dataFor(slug).students.find((student) => student.name === name)?.id,
  parentId: dataFor(slug).parents.find((parent) => parent.name === name)?.id,
  teacherId: dataFor(slug).teachers.find((teacher) => teacher.name === name)?.id,
});

/**
 * The accounts shown on the sign-in screen. Between them they cover every role in
 * the product and every tenant state, so you can click through and watch both the
 * sidebar and the data change.
 */
export const ACCOUNTS: Record<
  string,
  { user: User; schools: Membership[]; person: DemoPerson; label: string }
> = {
  "admin@classforge.dev": {
    user: { id: "u1", name: "Ava Admin", email: "admin@classforge.dev", isSuperAdmin: true },
    schools: [],
    person: {},
    label: "Super Admin — sees every school, sits outside them",
  },
  [greenwood.principalEmail]: {
    user: {
      id: "u2",
      name: greenwood.principalName,
      email: greenwood.principalEmail,
      isSuperAdmin: false,
    },
    schools: [membership(greenwood, "SCHOOL_ADMIN"), membership(riverside, "SCHOOL_ADMIN")],
    person: {},
    label: "School Admin — two schools, full sidebar",
  },
  "teacher@greenwood.edu": {
    user: { id: "u3", name: "Tom Iyer", email: "teacher@greenwood.edu", isSuperAdmin: false },
    schools: [membership(greenwood, "TEACHER")],
    person: demoPerson(greenwood.slug, "Tom Iyer"),
    label: "Teacher — own classes, no school switching",
  },
  "student@greenwood.edu": {
    user: { id: "u4", name: "Sara Khan", email: "student@greenwood.edu", isSuperAdmin: false },
    schools: [membership(greenwood, "STUDENT")],
    person: demoPerson(greenwood.slug, "Sara Khan"),
    label: "Student — own marks and attendance only",
  },
  "parent@greenwood.edu": {
    user: { id: "u5", name: "Imran Khan", email: "parent@greenwood.edu", isSuperAdmin: false },
    schools: [membership(greenwood, "PARENT")],
    person: demoPerson(greenwood.slug, "Imran Khan"),
    label: "Parent — two children, fees and report cards",
  },
  [northgate.principalEmail]: {
    user: {
      id: "u6",
      name: northgate.principalName,
      email: northgate.principalEmail,
      isSuperAdmin: false,
    },
    schools: [membership(northgate, "SCHOOL_ADMIN")],
    person: {},
    label: "School Admin of a suspended school — read-only",
  },
};

export interface DemoPerson {
  studentId?: string;
  parentId?: string;
  teacherId?: string;
}

/* ---------- Lookups the handlers need ---------- */

export const CLASS_BY_ID = new Map<string, SchoolClass>();
export const SUBJECT_BY_ID = new Map<string, Subject>();
export const TEACHER_BY_ID = new Map<string, Teacher>();
export const STUDENT_BY_ID = new Map<string, Student>();
export const EXAM_BY_ID = new Map<string, Exam>();
export const PARENT_BY_ID = new Map<string, Parent>();

for (const profile of SCHOOL_PROFILES) {
  const data = dataFor(profile.slug);

  for (const item of data.classes) CLASS_BY_ID.set(item.id, item);
  for (const item of data.subjects) SUBJECT_BY_ID.set(item.id, item);
  for (const item of data.teachers) TEACHER_BY_ID.set(item.id, item);
  for (const item of data.students) STUDENT_BY_ID.set(item.id, item);
  for (const item of data.exams) EXAM_BY_ID.set(item.id, item);
  for (const item of data.parents) PARENT_BY_ID.set(item.id, item);
}

/** The children a parent is a guardian for, in roster order. */
export function childrenOf(parentId: string): Student[] {
  const parent = PARENT_BY_ID.get(parentId);
  if (!parent) return [];
  return parent.studentIds
    .map((studentId) => STUDENT_BY_ID.get(studentId))
    .filter((student): student is Student => Boolean(student));
}