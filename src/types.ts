/* Every type in one file so the whole data model can be read at a glance. */

/* ---------- Roles ---------- */

export const ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER", "STUDENT", "PARENT"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  SCHOOL_ADMIN: "School Admin",
  TEACHER: "Teacher",
  STUDENT: "Student",
  PARENT: "Parent",
};

/* ---------- Session ---------- */

/** The signed-in person. One account can belong to many schools. */
export interface User {
  id: string;
  name: string;
  email: string;
  /** True for the platform admin, who sits outside every school. */
  isSuperAdmin: boolean;
}

/** The role one account holds inside one school. */
export interface Membership {
  schoolId: string;
  schoolSlug: string;
  schoolName: string;
  role: Role;
}

/* ---------- Schools ---------- */

export interface School {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "SUSPENDED";
  studentCount: number;
  staffCount: number;
}

/* ---------- People inside a school ---------- */

export interface Student {
  id: string;
  name: string;
  email: string;
  admissionNo: string;
  className: string;
  status: "ACTIVE" | "INACTIVE";
}

export interface Teacher {
  id: string;
  name: string;
  email: string;
  subject: string;
}

/* ---------- Shared list response ---------- */

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}