import type {
  Announcement,
  AnnouncementPriority,
  AssignmentDetail,
  AssignmentListRow,
  AssignmentSubmission,
  AttendanceRecord,
  AttendanceStatus,
  AttendanceSummary,
  AttendanceTrendPoint,
  Exam,
  ExamResult,
  FeeInvoice,
  FeeSummary,
  Paginated,
  Parent,
  PlatformStats,
  ReportCard,
  School,
  SchoolClass,
  SchoolDashboard,
  SchoolIdentity,
  Student,
  StudentAttendance,
  Subject,
  SubmissionStatus,
  Teacher,
  TimetableSlot,
  User,
  Membership,
} from "@/types";

/* ------------------------------------------------------------------ *
 * Mock switch
 *
 * Mocks stand in for the backend until it is live. Requests then stay on
 * the current origin so the mock service worker can intercept them.
 * ------------------------------------------------------------------ */

export const MOCKS_ENABLED = process.env.NEXT_PUBLIC_ENABLE_MOCKS !== "false";

const BASE_URL = MOCKS_ENABLED ? "" : (process.env.NEXT_PUBLIC_API_BASE_URL ?? "");

/* ------------------------------------------------------------------ *
 * The one fetch helper
 * ------------------------------------------------------------------ */

export class ApiError extends Error {
  status: number;
  /** Field-level messages, e.g. { email: "Email is already taken" }. */
  fields: Record<string, string>;

  constructor(status: number, message: string, fields: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

function withQuery(path: string, params: Record<string, string | number | undefined>) {
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") clean[key] = String(value);
  }

  const search = new URLSearchParams(clean).toString();
  return search ? `${path}?${search}` : path;
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? "GET",
    credentials: "include",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.message ?? "Something went wrong",
      payload?.fields,
    );
  }

  return payload as T;
}

/* ------------------------------------------------------------------ *
 * Endpoints — these paths are the contract agreed with the backend.
 * ------------------------------------------------------------------ */

export const authApi = {
  login: (email: string, password: string) =>
    api<{ token: string; user: User; schools: Membership[] }>("/api/auth/login", {
      method: "POST",
      body: { email, password },
    }),
};

/** Super Admin only. */
export const platformApi = {
  listSchools: () => api<School[]>("/api/platform/schools"),
  createSchool: (name: string, slug: string) =>
    api<School>("/api/platform/schools", { method: "POST", body: { name, slug } }),
  setSchoolStatus: (schoolSlug: string, status: School["status"]) =>
    api<School>(`/api/platform/schools/${schoolSlug}`, { method: "PATCH", body: { status } }),
  stats: () => api<PlatformStats>("/api/platform/stats"),
};

export type ListParams = Record<string, string | number | undefined>;

/** Every school endpoint carries the school slug, so the backend knows whose data it is. */
export const schoolApi = {
  /* --- People --- */
  listStudents: (schoolSlug: string, params: { page?: number; search?: string; classId?: string; status?: string } = {}) =>
    api<Paginated<Student>>(withQuery(`/api/t/${schoolSlug}/students`, params)),
  getStudent: (schoolSlug: string, studentId: string) =>
    api<Student>(`/api/t/${schoolSlug}/students/${studentId}`),
  getStudentAttendance: (schoolSlug: string, studentId: string, params: { days?: number } = {}) =>
    api<StudentAttendance>(withQuery(`/api/t/${schoolSlug}/students/${studentId}/attendance`, params)),
  getReportCard: (schoolSlug: string, studentId: string, params: { term: string }) =>
    api<ReportCard>(withQuery(`/api/t/${schoolSlug}/students/${studentId}/report-card`, params)),
  listTeachers: (schoolSlug: string) =>
    api<Teacher[]>(`/api/t/${schoolSlug}/teachers`),
  listParents: (schoolSlug: string, params: ListParams = {}) =>
    api<Paginated<Parent>>(withQuery(`/api/t/${schoolSlug}/parents`, params)),
  listParentChildren: (schoolSlug: string, parentId: string) =>
    api<Student[]>(`/api/t/${schoolSlug}/parents/${parentId}/children`),

  /* --- Academic structure --- */
  listSubjects: (schoolSlug: string) =>
    api<Subject[]>(`/api/t/${schoolSlug}/subjects`),
  listClasses: (schoolSlug: string, params: { grade?: string; search?: string } = {}) =>
    api<SchoolClass[]>(withQuery(`/api/t/${schoolSlug}/classes`, params)),
  getClassTimetable: (schoolSlug: string, classId: string) =>
    api<TimetableSlot[]>(`/api/t/${schoolSlug}/classes/${classId}/timetable`),

  /* --- Attendance --- */
  /** The register for one class on one day, for marking. */
  getRegister: (schoolSlug: string, params: { classId: string; date: string }) =>
    api<{
      date: string;
      class: SchoolClass;
      students: Student[];
      records: AttendanceRecord[];
    }>(withQuery(`/api/t/${schoolSlug}/attendance/register`, params)),
  markAttendance: (
    schoolSlug: string,
    body: { date: string; classId: string; records: { studentId: string; status: AttendanceStatus }[] },
  ) =>
    api<{ records: AttendanceRecord[] }>(`/api/t/${schoolSlug}/attendance`, {
      method: "POST",
      body,
    }),
  /** Every class on one day, for the school's day sheet. */
  getDaySheet: (schoolSlug: string, params: { date: string }) =>
    api<AttendanceSummary[]>(withQuery(`/api/t/${schoolSlug}/attendance`, params)),
  getAttendanceTrend: (schoolSlug: string, params: { days?: number } = {}) =>
    api<AttendanceTrendPoint[]>(withQuery(`/api/t/${schoolSlug}/attendance/trend`, params)),

  /* --- Exams --- */
  listExams: (
    schoolSlug: string,
    params: { page?: number; search?: string; term?: string; status?: string; classId?: string } = {},
  ) => api<Paginated<Exam>>(withQuery(`/api/t/${schoolSlug}/exams`, params)),
  getExamResults: (schoolSlug: string, examId: string) =>
    api<{ exam: Exam; results: ExamResult[] }>(`/api/t/${schoolSlug}/exams/${examId}/results`),
  publishExam: (schoolSlug: string, examId: string) =>
    api<Exam>(`/api/t/${schoolSlug}/exams/${examId}/publish`, { method: "POST" }),
  /** Whole-class report cards for a published term. */
  listReportCards: (schoolSlug: string, params: { classId: string; term: string }) =>
    api<ReportCard[]>(withQuery(`/api/t/${schoolSlug}/report-cards`, params)),

  /* --- Assignments --- */
  listAssignments: (
    schoolSlug: string,
    params: {
      page?: number;
      search?: string;
      status?: string;
      classId?: string;
      subjectId?: string;
      mine?: boolean;
      /** Required with mine=true: who is asking. */
      email?: string;
    } = {},
  ) => api<Paginated<AssignmentListRow>>(withQuery(`/api/t/${schoolSlug}/assignments`, {
    ...params,
    // withQuery only carries strings and numbers.
    mine: params.mine ? "true" : undefined,
  })),
  getAssignment: (schoolSlug: string, assignmentId: string) =>
    api<AssignmentDetail>(`/api/t/${schoolSlug}/assignments/${assignmentId}`),
  createAssignment: (
    schoolSlug: string,
    body: {
      title: string;
      description: string;
      classId: string;
      subjectId: string;
      dueDate: string;
      maxMarks: number;
    },
  ) => api<AssignmentListRow>(`/api/t/${schoolSlug}/assignments`, { method: "POST", body }),
  /** A student hands the work in. */
  submitAssignment: (
    schoolSlug: string,
    assignmentId: string,
    body: { studentId: string; status: SubmissionStatus },
  ) =>
    api<AssignmentSubmission>(`/api/t/${schoolSlug}/assignments/${assignmentId}/submissions`, {
      method: "POST",
      body,
    }),
  /** A teacher marks one submission. */
  gradeSubmission: (
    schoolSlug: string,
    assignmentId: string,
    body: { studentId: string; marksObtained: number; feedback?: string },
  ) => api<AssignmentSubmission>(`/api/t/${schoolSlug}/assignments/${assignmentId}/grade`, {
    method: "POST",
    body,
  }),

  /** Who the signed-in account is inside this school. */
  getIdentity: (schoolSlug: string, email: string) =>
    api<SchoolIdentity>(withQuery(`/api/t/${schoolSlug}/me`, { email })),

  /* --- Announcements --- */
  listAnnouncements: (
    schoolSlug: string,
    params: { page?: number; search?: string; priority?: AnnouncementPriority; audience?: string } = {},
  ) => api<Paginated<Announcement>>(withQuery(`/api/t/${schoolSlug}/announcements`, params)),
  createAnnouncement: (
    schoolSlug: string,
    body: Pick<Announcement, "title" | "body" | "audience" | "priority"> & { pinned?: boolean },
  ) => api<Announcement>(`/api/t/${schoolSlug}/announcements`, { method: "POST", body }),

  /* --- Fees --- */
  listFees: (
    schoolSlug: string,
    params: { page?: number; search?: string; status?: string; classId?: string; term?: string } = {},
  ) => api<Paginated<FeeInvoice>>(withQuery(`/api/t/${schoolSlug}/fees`, params)),
  getFeeSummary: (schoolSlug: string) => api<FeeSummary>(`/api/t/${schoolSlug}/fees/summary`),

  /* --- Roll-up for the dashboard --- */
  getDashboard: (schoolSlug: string) => api<SchoolDashboard>(`/api/t/${schoolSlug}/dashboard`),
};