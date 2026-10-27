import type { Role } from "@/types";

/**
 * Who can open what, in one file.
 *
 * Two tables, both read from here and nowhere else:
 *
 * - `SCHOOL_AREAS` — the screens in the sidebar. Drives `navForRole` and
 *   `RequireArea`, so a hidden tab is also a blocked URL.
 * - `ACTIONS` — the things a screen can do. Drives the buttons, and the backend
 *   re-checks it on every write.
 *
 * Adding a role or a screen is one edit here, never an `if (role === ...)` in a
 * component. The backend remains the authority; this only keeps the UI honest.
 */

/* ------------------------------------------------------------------ *
 * Screens
 * ------------------------------------------------------------------ */

export const SCHOOL_AREAS = {
  dashboard: ["SCHOOL_ADMIN", "TEACHER", "STUDENT", "PARENT"],
  students: ["SCHOOL_ADMIN", "TEACHER"],
  // The staff directory is not in the PRD matrix, so it stays with the one role
  // the matrix gives it to. Teachers reach colleague names through Classes.
  teachers: ["SCHOOL_ADMIN"],
  classes: ["SCHOOL_ADMIN", "TEACHER", "STUDENT"],
  attendance: ["SCHOOL_ADMIN", "TEACHER", "STUDENT", "PARENT"],
  assignments: ["SCHOOL_ADMIN", "TEACHER", "STUDENT", "PARENT"],
  exams: ["SCHOOL_ADMIN", "TEACHER", "STUDENT", "PARENT"],
  announcements: ["SCHOOL_ADMIN", "TEACHER", "STUDENT", "PARENT"],
  parents: ["SCHOOL_ADMIN", "PARENT"],
  "report-cards": ["SCHOOL_ADMIN", "TEACHER", "STUDENT", "PARENT"],
  schedule: ["SCHOOL_ADMIN", "TEACHER", "STUDENT", "PARENT"],
  settings: ["SCHOOL_ADMIN"],
} as const satisfies Record<string, readonly Role[]>;

export type SchoolArea = keyof typeof SCHOOL_AREAS;

/* ------------------------------------------------------------------ *
 * Actions — one row per line of the PRD's capability matrix
 * ------------------------------------------------------------------ */

export const ACTIONS = {
  /* Platform */
  manageSchools: ["SUPER_ADMIN"],
  manageSchoolStatus: ["SUPER_ADMIN"],

  /* People */
  inviteUsers: ["SCHOOL_ADMIN"],
  /** Edit, deactivate and reactivate. Creating is a separate, wider power. */
  manageRoster: ["SCHOOL_ADMIN"],
  /** Admins create anywhere; teachers create only in the classes they teach. */
  createStudent: ["SCHOOL_ADMIN", "TEACHER"],
  resendStudentCredentials: ["SCHOOL_ADMIN", "TEACHER"],
  /** A teacher reads the roster of the classes they teach, and no others. */
  viewRoster: ["SCHOOL_ADMIN", "TEACHER"],
  viewStaffDirectory: ["SCHOOL_ADMIN"],

  /* Academic structure */
  manageClasses: ["SCHOOL_ADMIN"],
  viewOwnClass: ["STUDENT"],

  /* Attendance */
  viewSchoolAttendance: ["SCHOOL_ADMIN", "TEACHER"],
  markAttendance: ["SCHOOL_ADMIN", "TEACHER"],
  viewOwnAttendance: ["STUDENT", "PARENT"],

  /* Exams and grades */
  enterMarks: ["SCHOOL_ADMIN", "TEACHER"],
  publishResults: ["SCHOOL_ADMIN"],
  viewOwnResults: ["STUDENT", "PARENT"],
  viewClassReportCards: ["SCHOOL_ADMIN", "TEACHER"],
  viewOwnReportCard: ["STUDENT", "PARENT"],

  /* Announcements */
  postAnnouncement: ["SCHOOL_ADMIN", "TEACHER"],

  /* Assignments */
  createAssignment: ["SCHOOL_ADMIN", "TEACHER"],
  submitAssignment: ["STUDENT"],
  gradeSubmission: ["SCHOOL_ADMIN", "TEACHER"],

  /* Dashboard roll-ups */
  /** The school-wide numbers. Nobody below the admin gets these. */
  viewSchoolDashboard: ["SCHOOL_ADMIN"],
} as const satisfies Record<string, readonly Role[]>;

export type Action = keyof typeof ACTIONS;

/* ------------------------------------------------------------------ *
 * How far a role reaches
 *
 * A role check alone is never enough, which is what these words mean:
 *
 * - `ALL`      the whole school.
 * - `ASSIGNED` only the classes this teacher is timetabled in or homeroom of.
 * - `OWN`      only this student's records, or a parent's children.
 * ------------------------------------------------------------------ */

export const SCHOOL_SCOPES = ["ALL", "ASSIGNED", "OWN"] as const;
export type SchoolScope = (typeof SCHOOL_SCOPES)[number];

/** The Super Admin has no membership, so it holds no scope inside a school. */
export const ROLE_SCOPES: Record<Exclude<Role, "SUPER_ADMIN">, SchoolScope> = {
  SCHOOL_ADMIN: "ALL",
  TEACHER: "ASSIGNED",
  STUDENT: "OWN",
  PARENT: "OWN",
};

/* ------------------------------------------------------------------ *
 * Lookups
 * ------------------------------------------------------------------ */

export function canAccessArea(role: Role | null, area: SchoolArea): boolean {
  if (!role) return false;
  return (SCHOOL_AREAS[area] as readonly Role[]).includes(role);
}

export function canPerform(role: Role | null, action: Action): boolean {
  if (!role) return false;
  return (ACTIONS[action] as readonly Role[]).includes(role);
}

/** How far this role reaches inside this school, or null when it has none. */
export function scopeFor(role: Role | null): SchoolScope | null {
  if (!role || role === "SUPER_ADMIN") return null;
  return ROLE_SCOPES[role];
}

/* ------------------------------------------------------------------ *
 * The dashboard each role gets
 *
 * Derived from the action table rather than written out per role, so a screen
 * can never disagree with the permissions it claims to follow.
 * ------------------------------------------------------------------ */

export const DASHBOARD_VARIANTS = ["SCHOOL", "TEACHER", "STUDENT", "PARENT"] as const;
export type DashboardVariant = (typeof DASHBOARD_VARIANTS)[number];

export function dashboardFor(role: Role | null): DashboardVariant | null {
  if (canPerform(role, "viewSchoolDashboard")) return "SCHOOL";
  if (canPerform(role, "markAttendance")) return "TEACHER";
  if (canPerform(role, "submitAssignment")) return "STUDENT";
  if (canPerform(role, "viewOwnResults")) return "PARENT";
  return null;
}
