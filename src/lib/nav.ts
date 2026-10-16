import type { ComponentType, SVGProps } from "react";
import {
  AnnouncementsIcon,
  AssignmentsIcon,
  AttendanceIcon,
  ClassesIcon,
  DashboardIcon,
  ExamsIcon,
  FeesIcon,
  ReportsIcon,
  ScheduleIcon,
  SettingsIcon,
  StudentsIcon,
  TeachersIcon,
} from "@/components/ui/icons";
import { canAccessArea, type SchoolArea } from "@/lib/roles";
import type { Membership, Role, User } from "@/types";

export interface NavItem {
  label: string;
  /**
   * The permission key this screen is guarded by, read from `SCHOOL_AREAS`.
   * A hidden item is also a blocked URL, so the two can never disagree.
   */
  area: SchoolArea;
  /**
   * URL segment. Only set where the route is named differently from the area it
   * guards — Reports is guarded by `report-cards` but lives at `/reports`.
   */
  path?: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** The route exists and is guarded, but its screen is still a placeholder. */
  soon?: boolean;
}

/**
 * The sidebar, in order. Which of these a person sees depends on their role.
 *
 * The order follows the design's operational grouping — people, then daily
 * operations, then academic records, then money, then communications — with the
 * screens the app already had slotted in beside their nearest sibling.
 */
export const SCHOOL_NAV: NavItem[] = [
  { label: "Dashboard", area: "dashboard", icon: DashboardIcon },
  { label: "Students", area: "students", icon: StudentsIcon },
  { label: "Teachers", area: "teachers", icon: TeachersIcon },
  { label: "Classes & Sections", area: "classes", icon: ClassesIcon },
  { label: "Attendance", area: "attendance", icon: AttendanceIcon },
  { label: "Schedule", area: "schedule", icon: ScheduleIcon },
  { label: "Assignments", area: "assignments", icon: AssignmentsIcon },
  { label: "Exams & Grades", area: "exams", icon: ExamsIcon },
  { label: "Reports", area: "report-cards", path: "reports", icon: ReportsIcon, soon: true },
  { label: "Fees", area: "fees", icon: FeesIcon },
  { label: "Announcements", area: "announcements", icon: AnnouncementsIcon },
  { label: "Settings", area: "settings", icon: SettingsIcon, soon: true },
];

/**
 * The URL for a screen.
 *
 * Accepts a bare area — `schoolHref("greenfield", "students")` — or a NavItem,
 * which is how the sidebar reaches screens whose route is named differently.
 */
export function schoolHref(schoolSlug: string, target: SchoolArea | NavItem): string {
  const path = typeof target === "string" ? target : (target.path ?? target.area);
  return `/${schoolSlug}/${path}`;
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