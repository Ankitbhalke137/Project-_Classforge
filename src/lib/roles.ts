import type { Role } from "@/types";

/**
 * The screens that live inside a school, and which roles may open each one.
 *
 * This single table drives the sidebar, so adding a role or a screen is one
 * edit here — no `if (role === ...)` checks scattered through the components.
 * The backend re-checks every request regardless, this only hides UI.
 */
export const SCHOOL_AREAS = {
  dashboard: ["SCHOOL_ADMIN", "TEACHER", "STUDENT", "PARENT"],
  students: ["SCHOOL_ADMIN", "TEACHER"],
  teachers: ["SCHOOL_ADMIN", "TEACHER"],
  classes: ["SCHOOL_ADMIN", "TEACHER", "STUDENT"],
  attendance: ["SCHOOL_ADMIN", "TEACHER", "STUDENT", "PARENT"],
  assignments: ["SCHOOL_ADMIN", "TEACHER", "STUDENT", "PARENT"],
  exams: ["SCHOOL_ADMIN", "TEACHER", "STUDENT", "PARENT"],
  announcements: ["SCHOOL_ADMIN", "TEACHER", "STUDENT", "PARENT"],
} as const satisfies Record<string, readonly Role[]>;

export type SchoolArea = keyof typeof SCHOOL_AREAS;

export function canAccessArea(role: Role | null, area: SchoolArea): boolean {
  if (!role) return false;
  return (SCHOOL_AREAS[area] as readonly Role[]).includes(role);
}