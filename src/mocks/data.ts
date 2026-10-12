import type { Membership, School, Student, Teacher, User } from "@/types";

/** Every demo account uses this password. */
export const DEMO_PASSWORD = "demo1234";

const GREENWOOD: Membership = {
  schoolId: "sch_greenwood",
  schoolSlug: "greenwood",
  schoolName: "Greenwood High",
  role: "SCHOOL_ADMIN",
};
const RIVERSIDE: Membership = {
  schoolId: "sch_riverside",
  schoolSlug: "riverside",
  schoolName: "Riverside Academy",
  role: "SCHOOL_ADMIN",
};

/**
 * The accounts shown on the sign-in screen. Between them they cover every role
 * in the product, so you can click through the app and see the sidebar change.
 */
export const ACCOUNTS: Record<
  string,
  { user: User; schools: Membership[]; label: string }
> = {
  "admin@classforge.dev": {
    user: { id: "u1", name: "Ava Admin", email: "admin@classforge.dev", isSuperAdmin: true },
    schools: [],
    label: "Super Admin — sees every school",
  },
  "principal@greenwood.edu": {
    user: { id: "u2", name: "Priya Rao", email: "principal@greenwood.edu", isSuperAdmin: false },
    schools: [
      { ...GREENWOOD, role: "SCHOOL_ADMIN" },
      { ...RIVERSIDE, role: "SCHOOL_ADMIN" },
    ],
    label: "School Admin — two schools, full sidebar",
  },
  "teacher@greenwood.edu": {
    user: { id: "u3", name: "Tom Iyer", email: "teacher@greenwood.edu", isSuperAdmin: false },
    schools: [{ ...GREENWOOD, role: "TEACHER" }],
    label: "Teacher — no school switching",
  },
  "student@greenwood.edu": {
    user: { id: "u4", name: "Sara Khan", email: "student@greenwood.edu", isSuperAdmin: false },
    schools: [{ ...GREENWOOD, role: "STUDENT" }],
    label: "Student — read only, short sidebar",
  },
};

export const SCHOOLS: School[] = [
  {
    id: "sch_greenwood",
    name: "Greenwood High",
    slug: "greenwood",
    status: "ACTIVE",
    studentCount: 3,
    staffCount: 3,
  },
  {
    id: "sch_riverside",
    name: "Riverside Academy",
    slug: "riverside",
    status: "ACTIVE",
    studentCount: 0,
    staffCount: 0,
  },
];

const STUDENT_NAMES = [
  "Sara Khan", "Ravi Menon", "Anya Dsouza", "Kabir Shah",
  "Meera Iyer", "Jon Bell", "Priya Nair", "Omar Farid",
  "Lena Ortiz", "Dev Patel", "Zoya Ali", "Kim Nakamura",
];

const CLASSES = ["Grade 9", "Grade 10", "Grade 11", "Grade 12"];

/** Builds a predictable student list per school so the table is stable. */
export const STUDENTS: Record<string, Student[]> = Object.fromEntries(
  SCHOOLS.map((school, schoolIndex) => [
    school.slug,
    STUDENT_NAMES.map((name, index) => ({
      id: `${school.slug}_stu_${index}`,
      name,
      email: `${name.split(" ")[0].toLowerCase()}@${school.slug}.edu`,
      admissionNo: `${schoolIndex + 1}${String(index + 1).padStart(3, "0")}`,
      className: CLASSES[index % CLASSES.length],
      status: index === 5 ? ("INACTIVE" as const) : ("ACTIVE" as const),
    })),
  ]),
);

export const TEACHERS: Record<string, Teacher[]> = Object.fromEntries(
  SCHOOLS.map((school) => [
    school.slug,
    [
      { id: `${school.slug}_tch_1`, name: "Tom Iyer", email: "tom@greenwood.edu", subject: "Physics" },
      { id: `${school.slug}_tch_2`, name: "Grace Lee", email: "grace@greenwood.edu", subject: "Mathematics" },
      { id: `${school.slug}_tch_3`, name: "Nadia Roy", email: "nadia@greenwood.edu", subject: "History" },
    ],
  ]),
);