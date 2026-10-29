import type { ComponentType, SVGProps } from "react";
import {
  AnnouncementsIcon,
  AssignmentsIcon,
  AttendanceIcon,
  ClassesIcon,
  DashboardIcon,
  ExamsIcon,
  ReportsIcon,
  ScheduleIcon,
  SettingsIcon,
  StudentsIcon,
  TeachersIcon,
} from "@/components/ui/icons";
import { canAccessArea, ROLE_PRIORITY, type SchoolArea } from "@/lib/roles";
import type { Membership, Role, School, User } from "@/types";

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
  { label: "Reports", area: "report-cards", path: "reports", icon: ReportsIcon },
  { label: "Parents", area: "parents", path: "parents", icon: StudentsIcon },
  { label: "Announcements", area: "announcements", icon: AnnouncementsIcon },
  { label: "Settings", area: "settings", icon: SettingsIcon },
];

/**
 * The URL for a screen.
 *
 * Accepts a bare path — `schoolHref("greenfield", "students")` — or a NavItem,
 * which is how the sidebar reaches screens whose route is named differently.
 */
export function schoolHref(schoolSlug: string, target: string | NavItem): string {
  const path = typeof target === "string" ? target : (target.path ?? target.area);
  return `/${schoolSlug}/${path}`;
}

/**
 * The URL for the screen guarded by a given area.
 *
 * Use this rather than `schoolHref` when the caller holds a permission key
 * instead of a route: it resolves through the nav table, so an area whose route
 * is named differently — Reports is guarded by `report-cards` — still lands on a
 * URL that exists.
 */
export function schoolHrefForArea(schoolSlug: string, area: SchoolArea): string {
  const item = SCHOOL_NAV.find((candidate) => candidate.area === area);
  return schoolHref(schoolSlug, item ?? area);
}

/** Drops the items this role cannot open. */
export function navForRole(role: Role | null): NavItem[] {
  return SCHOOL_NAV.filter((item) => canAccessArea(role, item.area));
}

/** Where to send someone once they are signed in. */
export function landingPath(user: User | null, schools: Membership[]): string {
  if (!user) return "/login";
  if (user.isSuperAdmin) return "/platform";

  const active = schools.length > 0 ? schools[0] : null;
  return active ? `/${active.schoolSlug}/dashboard` : "/no-access";
}

/** All distinct (school, role) combinations the user can sign in as,
 * de-duplicated so the same school with two roles shows both options. */
export function loginContexts(schools: Membership[]): { schoolSlug: string; schoolName: string; role: Role; status: School["status"] }[] {
  const seen = new Set<string>();
  return schools
    .filter((s) => {
      const key = `${s.schoolSlug}|${s.role}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((s) => ({
      schoolSlug: s.schoolSlug,
      schoolName: s.schoolName,
      role: s.role,
      status: s.status,
    }));
}

/**
 * The context to open first after signing in: the most privileged role in the
 * first school the person belongs to. Without this, a School Admin who also
 * teaches could land in their teacher context purely because of row order, and
 * miss the powers their admin role gives them.
 */
export function defaultLoginContext(
  schools: Membership[],
): { schoolSlug: string; schoolName: string; role: Role; status: School["status"] } | null {
  const contexts = loginContexts(schools);
  const firstSchool = contexts[0]?.schoolSlug;
  if (!firstSchool) return null;

  return contexts
    .filter((context) => context.schoolSlug === firstSchool)
    .sort((a, b) => ROLE_PRIORITY[b.role] - ROLE_PRIORITY[a.role])[0];
}

/** True when the user has more than one sign-in context to choose from. */
export function needsSchoolSelection(schools: Membership[]): boolean {
  return loginContexts(schools).length > 1;
}