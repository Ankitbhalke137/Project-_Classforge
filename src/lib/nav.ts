import type { ComponentType, SVGProps } from "react";
import {
  AnnouncementsIcon,
  AssignmentsIcon,
  AttendanceIcon,
  ClassesIcon,
  DashboardIcon,
  ExamsIcon,
  StudentsIcon,
  TeachersIcon,
} from "@/components/ui/icons";
import { canAccessArea, type SchoolArea } from "@/lib/roles";
import type { Membership, Role, User } from "@/types";

export interface NavItem {
  label: string;
  area: SchoolArea;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

/** The sidebar, in order. Which of these a person sees depends on their role. */
export const SCHOOL_NAV: NavItem[] = [
  { label: "Dashboard", area: "dashboard", icon: DashboardIcon },
  { label: "Students", area: "students", icon: StudentsIcon },
  { label: "Teachers", area: "teachers", icon: TeachersIcon },
  { label: "Classes", area: "classes", icon: ClassesIcon },
  { label: "Attendance", area: "attendance", icon: AttendanceIcon },
  { label: "Assignments", area: "assignments", icon: AssignmentsIcon },
  { label: "Exams & Grades", area: "exams", icon: ExamsIcon },
  { label: "Announcements", area: "announcements", icon: AnnouncementsIcon },
];

/** The URL for a screen, e.g. ("greenwood", "students") -> "/greenwood/students" */
export function schoolHref(schoolSlug: string, area: SchoolArea): string {
  return `/${schoolSlug}/${area}`;
}

/** Drops the items this role cannot open. */
export function navForRole(role: Role | null): NavItem[] {
  return SCHOOL_NAV.filter((item) => canAccessArea(role, item.area));
}

/** Where to send someone once they are signed in. */
export function landingPath(user: User | null, schools: Membership[]): string {
  if (!user) return "/login";
  if (user.isSuperAdmin) return "/platform";

  const firstSchool = schools[0];
  return firstSchool ? `/${firstSchool.schoolSlug}/dashboard` : "/no-access";
}