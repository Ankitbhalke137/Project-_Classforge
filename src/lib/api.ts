import type {
  AcademicTerm,
  AcademicYear,
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
  ExamStatus,
  FeeInvoice,
  FeeSummary,
  MyResults,
  Paginated,
  Parent,
  PlatformAdmin,
  PlatformStats,
  CreatedPlatformAdmin,
  ReportCard,
  School,
  SchoolCalendar,
  SchoolClass,
  SchoolDashboard,
  SchoolIdentity,
  StaffRole,
  Student,
  StudentAttendance,
  Subject,
  SubmissionStatus,
  Teacher,
  TeachingAssignment,
  TimetablePeriod,
  TimetableSlot,
  User,
  Membership,
  NotificationPreferences,
} from "@/types";

/* ------------------------------------------------------------------ *
 * Base URL
 *
 * The API routes live inside this Next app, so requests go to this origin by
 * default. Set NEXT_PUBLIC_API_BASE_URL only if the API is ever split onto its
 * own host.
 * ------------------------------------------------------------------ */

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

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
  /**
   * The backend hands the access token back as an httpOnly cookie, not in the
   * body — so there is no `token` field here to read.
   */
  login: (email: string, password: string) =>
    api<{ user: User; schools: Membership[] }>("/api/auth/login", {
      method: "POST",
      body: { email, password },
    }),
  /**
   * Revalidates the session cookie against the server.
   *
   * The signed-in account's user record and school memberships come back fresh,
   * so a role revoked in another tab is picked up without re-login.
   */
  /**
   * The signed-in account's profile and the schools it can switch between.
   *
   * Revalidates the httpOnly session cookie, so a role revoked in another tab
   * is picked up without re-login.
   */
  me: () => api<{ user: User; schools: Membership[] }>("/api/auth/me"),

  /**
   * Changes the signed-in account's own password.
   *
   * The server asks for the current password, so this cannot be used to take
   * over an account from a session alone.
   */
  changePassword: (body: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) =>
    api<{ message: string }>("/api/auth/change-password", {
      method: "POST",
      body,
    }),
};

/** Super Admin only. */
export const platformApi = {
  listSchools: () => api<School[]>("/api/platform/schools"),
  createSchool: (name: string, slug: string) =>
    api<School>("/api/platform/schools", { method: "POST", body: { name, slug } }),
  updateSchool: (
    schoolId: string,
    body: { name?: string; slug?: string; status?: School["status"] },
  ) => api<School>(`/api/platform/schools/${schoolId}`, { method: "PATCH", body }),
  removeSchool: (schoolId: string, force = false) =>
    api<{ removed: boolean; id: string }>(
      `/api/platform/schools/${schoolId}${force ? "?force=true" : ""}`,
      { method: "DELETE" },
    ),
  stats: () => api<PlatformStats>("/api/platform/stats"),

  /* Staff access — who administers each school. */
  listAdmins: () => api<PlatformAdmin[]>("/api/platform/admins"),
  createAdmin: (body: {
    name: string;
    email: string;
    schoolId: string;
    role: StaffRole;
  }) => api<CreatedPlatformAdmin>("/api/platform/admins", { method: "POST", body }),
  updateAdmin: (
    userId: string,
    body: { tenantId: string; role?: StaffRole; status?: "ACTIVE" | "INACTIVE" },
  ) => api<PlatformAdmin>(`/api/platform/admins/${userId}`, { method: "PATCH", body }),
  removeAdmin: (userId: string, tenantId: string) =>
    api<{ removed: boolean }>(
      `/api/platform/admins/${userId}?tenantId=${encodeURIComponent(tenantId)}`,
      { method: "DELETE" },
    ),
  /** Issues a fresh temporary password for an existing member and emails it. */
  resendAdminCredentials: (userId: string, tenantId: string) =>
    api<{
      userId: string;
      tenantId: string;
      name: string;
      email: string;
      schoolName: string;
      emailSent: boolean;
      emailError: string | null;
    }>(`/api/platform/admins/${userId}/resend`, { method: "POST", body: { tenantId } }),
};

export type ListParams = Record<string, string | number | undefined>;

/** Every school endpoint carries the school slug, so the backend knows whose data it is. */
export const schoolApi = {
  /* --- People --- */
  listStudents: (
    schoolSlug: string,
    params: {
      page?: number;
      limit?: number;
      search?: string;
      classId?: string;
      sectionId?: string;
      status?: string;
      sort?: string;
    } = {},
  ) => api<Paginated<Student>>(withQuery(`/api/t/${schoolSlug}/students`, params)),

  getStudent: (schoolSlug: string, studentId: string) =>
    api<Student>(`/api/t/${schoolSlug}/students/${studentId}`),

  createStudent: (
    schoolSlug: string,
    body: {
      firstName: string;
      lastName: string;
      admissionNo: string;
      dateOfBirth?: string | null;
      email: string;
      phone?: string | null;
      guardianName?: string | null;
      guardianPhone?: string | null;
      sectionId?: string | null;
      academicYearId?: string | null;
    },
  ) =>
    api<
      Student & {
        temporaryPassword: string | null;
        emailSent: boolean;
        emailError: string | null;
      }
    >(`/api/t/${schoolSlug}/students`, {
      method: "POST",
      body,
    }),

  /** Issues a fresh temporary password and emails it to the student. */
  resendStudentCredentials: (schoolSlug: string, id: string) =>
    api<{
      email: string;
      name: string;
      temporaryPassword: string;
      emailSent: boolean;
      emailError: string | null;
    }>(`/api/t/${schoolSlug}/students/${id}/resend-credentials`, { method: "POST" }),

  updateStudent: (
    schoolSlug: string,
    id: string,
    body: {
      firstName?: string;
      lastName?: string;
      admissionNo?: string;
      dateOfBirth?: string | null;
      email?: string | null;
      phone?: string | null;
      guardianName?: string | null;
      guardianPhone?: string | null;
      sectionId?: string | null;
      academicYearId?: string | null;
      status?: "ACTIVE" | "INACTIVE" | "WITHDRAWN" | "COMPLETED" | "TRANSFERRED";
    },
  ) =>
    api<Student>(`/api/t/${schoolSlug}/students/${id}`, {
      method: "PATCH",
      body,
    }),

  deleteStudent: (schoolSlug: string, id: string, permanent?: boolean) =>
    api<{ message: string; deleted?: boolean; status?: string }>(
      withQuery(`/api/t/${schoolSlug}/students/${id}`, {
        permanent: permanent ? "true" : undefined,
      }),
      { method: "DELETE" },
    ),

  getStudentAttendance: (
    schoolSlug: string,
    studentId: string,
    params: { days?: number } = {},
  ) =>
    api<StudentAttendance>(
      withQuery(`/api/t/${schoolSlug}/students/${studentId}/attendance`, params),
    ),

  getReportCard: (schoolSlug: string, studentId: string, params: { term: string }) =>
    api<ReportCard>(
      withQuery(`/api/t/${schoolSlug}/students/${studentId}/report-card`, params),
    ),

  listClassesWithSections: (schoolSlug: string) =>
    api<{
      data: Array<{
        id: string;
        name: string;
        academicYear: { id: string; name: string; status: string };
        sections: Array<{ id: string; name: string }>;
      }>;
    }>(`/api/t/${schoolSlug}/classes`),

  /** Always paginated — the rows arrive under `data` with a `pagination` block. */
  listTeachers: (schoolSlug: string, params: ListParams = {}) =>
    api<Paginated<Teacher>>(withQuery(`/api/t/${schoolSlug}/teachers`, params)),

  /** Creates the staff profile, the login and the membership in one call. */
  createTeacher: (
    schoolSlug: string,
    body: {
      firstName: string;
      lastName: string;
      email: string;
      employeeNo?: string | null;
      phone?: string | null;
      qualification?: string | null;
      designation?: string | null;
    },
  ) =>
    api<{
      teacher: Teacher;
      temporaryPassword: string | null;
      emailSent: boolean;
      emailError: string | null;
      existingAccount: boolean;
    }>(`/api/t/${schoolSlug}/teachers`, { method: "POST", body }),

  updateTeacher: (
    schoolSlug: string,
    id: string,
    body: {
      firstName?: string;
      lastName?: string;
      employeeNo?: string | null;
      phone?: string | null;
      qualification?: string | null;
      designation?: string | null;
      status?: "ACTIVE" | "INACTIVE";
    },
  ) => api<Teacher>(`/api/t/${schoolSlug}/teachers/${id}`, { method: "PATCH", body }),

  deactivateTeacher: (schoolSlug: string, id: string) =>
    api<{ deactivated: boolean; status: string }>(
      `/api/t/${schoolSlug}/teachers/${id}`,
      { method: "DELETE" },
    ),


  listParents: (schoolSlug: string, params: ListParams = {}) =>
    api<Paginated<Parent>>(withQuery(`/api/t/${schoolSlug}/parents`, params)),
  listParentChildren: (schoolSlug: string, parentId: string) =>
    api<Student[]>(`/api/t/${schoolSlug}/parents/${parentId}/children`),

  /* --- Academic structure --- */
  listAcademicYears: (schoolSlug: string) =>
    api<AcademicYear[]>(`/api/t/${schoolSlug}/academic-years`),
  createAcademicYear: (
    schoolSlug: string,
    body: { name: string; startDate: string; endDate: string; status?: AcademicYear["status"] },
  ) => api<AcademicYear>(`/api/t/${schoolSlug}/academic-years`, { method: "POST", body }),
  updateAcademicYear: (
    schoolSlug: string,
    id: string,
    body: {
      name?: string;
      startDate?: string;
      endDate?: string;
      status?: AcademicYear["status"];
    },
  ) => api<AcademicYear>(`/api/t/${schoolSlug}/academic-years/${id}`, { method: "PATCH", body }),
  deleteAcademicYear: (schoolSlug: string, id: string) =>
    api<{ removed: boolean }>(`/api/t/${schoolSlug}/academic-years/${id}`, { method: "DELETE" }),

  listTerms: (schoolSlug: string, academicYearId?: string) =>
    api<AcademicTerm[]>(
      withQuery(`/api/t/${schoolSlug}/terms`, { academicYearId }),
    ),
  createTerm: (
    schoolSlug: string,
    body: { academicYearId: string; label: string; startDate: string; endDate: string },
  ) => api<AcademicTerm>(`/api/t/${schoolSlug}/terms`, { method: "POST", body }),
  updateTerm: (
    schoolSlug: string,
    id: string,
    body: { label?: string; startDate?: string; endDate?: string; position?: number },
  ) => api<AcademicTerm>(`/api/t/${schoolSlug}/terms/${id}`, { method: "PATCH", body }),
  deleteTerm: (schoolSlug: string, id: string) =>
    api<{ removed: boolean }>(`/api/t/${schoolSlug}/terms/${id}`, { method: "DELETE" }),

  listSubjects: (schoolSlug: string, params: { classId?: string } = {}) =>
    api<Subject[]>(withQuery(`/api/t/${schoolSlug}/subjects`, params)),
  createSubject: (
    schoolSlug: string,
    body: { classId: string; name: string; code?: string | null },
  ) => api<Subject>(`/api/t/${schoolSlug}/subjects`, { method: "POST", body }),
  updateSubject: (
    schoolSlug: string,
    id: string,
    body: { name?: string; code?: string | null },
  ) => api<Subject>(`/api/t/${schoolSlug}/subjects/${id}`, { method: "PATCH", body }),
  deleteSubject: (schoolSlug: string, id: string) =>
    api<{ removed: boolean }>(`/api/t/${schoolSlug}/subjects/${id}`, { method: "DELETE" }),

  listClasses: (schoolSlug: string, params: { grade?: string; search?: string } = {}) =>
    api<SchoolClass[]>(withQuery(`/api/t/${schoolSlug}/classes`, params)),
  createClass: (
    schoolSlug: string,
    body: {
      name: string;
      academicYearId?: string;
      room?: string | null;
      capacity?: number;
      homeroomTeacherId?: string | null;
      sections?: string[];
    },
  ) =>
    api<{ id: string; name: string; sections: string[] }>(`/api/t/${schoolSlug}/classes`, {
      method: "POST",
      body,
    }),
  updateClass: (
    schoolSlug: string,
    id: string,
    body: {
      name?: string;
      room?: string | null;
      capacity?: number;
      homeroomTeacherId?: string | null;
    },
  ) => api<{ id: string }>(`/api/t/${schoolSlug}/classes/${id}`, { method: "PATCH", body }),
  deleteClass: (schoolSlug: string, id: string) =>
    api<{ removed: boolean }>(`/api/t/${schoolSlug}/classes/${id}`, { method: "DELETE" }),

  addSection: (schoolSlug: string, classId: string, name: string) =>
    api<{ id: string; name: string }>(`/api/t/${schoolSlug}/classes/${classId}/sections`, {
      method: "POST",
      body: { name },
    }),
  updateSection: (schoolSlug: string, sectionId: string, name: string) =>
    api<{ id: string; name: string }>(`/api/t/${schoolSlug}/sections/${sectionId}`, {
      method: "PATCH",
      body: { name },
    }),
  deleteSection: (schoolSlug: string, sectionId: string) =>
    api<{ removed: boolean }>(`/api/t/${schoolSlug}/sections/${sectionId}`, {
      method: "DELETE",
    }),

  listTeachingAssignments: (
    schoolSlug: string,
    params: { sectionId?: string; teacherId?: string } = {},
  ) =>
    api<TeachingAssignment[]>(
      withQuery(`/api/t/${schoolSlug}/teaching-assignments`, params),
    ),
  createTeachingAssignment: (
    schoolSlug: string,
    body: { teacherId: string; sectionId: string; subjectId: string },
  ) =>
    api<{ id: string }>(`/api/t/${schoolSlug}/teaching-assignments`, {
      method: "POST",
      body,
    }),
  deleteTeachingAssignment: (schoolSlug: string, id: string) =>
    api<{ removed: boolean }>(`/api/t/${schoolSlug}/teaching-assignments/${id}`, {
      method: "DELETE",
    }),

  listTimetablePeriods: (schoolSlug: string) =>
    api<TimetablePeriod[]>(`/api/t/${schoolSlug}/timetable-periods`),
  createTimetablePeriod: (
    schoolSlug: string,
    body: { period: number; startTime: string; endTime: string; label?: string | null },
  ) =>
    api<TimetablePeriod>(`/api/t/${schoolSlug}/timetable-periods`, {
      method: "POST",
      body,
    }),
  updateTimetablePeriod: (
    schoolSlug: string,
    id: string,
    body: { period?: number; startTime?: string; endTime?: string; label?: string | null },
  ) =>
    api<TimetablePeriod>(`/api/t/${schoolSlug}/timetable-periods/${id}`, {
      method: "PATCH",
      body,
    }),
  deleteTimetablePeriod: (schoolSlug: string, id: string) =>
    api<{ removed: boolean }>(`/api/t/${schoolSlug}/timetable-periods/${id}`, {
      method: "DELETE",
    }),

  getClassTimetable: (schoolSlug: string, classId: string) =>
    api<TimetableSlot[]>(`/api/t/${schoolSlug}/classes/${classId}/timetable`),
  saveClassTimetable: (
    schoolSlug: string,
    classId: string,
    slots: { day: string; period: number; subjectId: string; teacherId: string }[],
  ) =>
    api<TimetableSlot[]>(`/api/t/${schoolSlug}/classes/${classId}/timetable`, {
      method: "PUT",
      body: { slots },
    }),

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
  /** Published results for the signed-in student (and an empty list for a parent). */
  getMyResults: (schoolSlug: string) =>
    api<MyResults>(`/api/t/${schoolSlug}/me/results`),
  createExam: (
    schoolSlug: string,
    body: {
      name: string;
      term?: string | null;
      subjectId: string;
      sectionId: string;
      examDate: string;
      maxMarks: number;
      passMarks?: number;
      status?: ExamStatus;
    },
  ) => api<Exam>(`/api/t/${schoolSlug}/exams`, { method: "POST", body }),
  updateExam: (
    schoolSlug: string,
    examId: string,
    body: {
      name?: string;
      term?: string | null;
      examDate?: string;
      maxMarks?: number;
      passMarks?: number;
      status?: ExamStatus;
    },
  ) => api<Exam>(`/api/t/${schoolSlug}/exams/${examId}`, { method: "PATCH", body }),
  deleteExam: (schoolSlug: string, examId: string) =>
    api<{ removed: boolean }>(`/api/t/${schoolSlug}/exams/${examId}`, { method: "DELETE" }),
  getExamResults: (schoolSlug: string, examId: string) =>
    api<{ exam: Exam; results: ExamResult[] }>(`/api/t/${schoolSlug}/exams/${examId}/results`),
  saveExamMarks: (
    schoolSlug: string,
    examId: string,
    records: { studentId: string; score: number | null; remarks?: string | null }[],
  ) =>
    api<{ exam: Exam; results: ExamResult[] }>(
      `/api/t/${schoolSlug}/exams/${examId}/results`,
      { method: "PUT", body: { records } },
    ),
  publishExam: (schoolSlug: string, examId: string) =>
    api<{ exam: Exam; results: ExamResult[] }>(
      `/api/t/${schoolSlug}/exams/${examId}/publish`,
      { method: "POST" },
    ),
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
    body: Pick<Announcement, "title" | "body" | "audience" | "priority"> & {
      pinned?: boolean;
      sectionId?: string | null;
    },
  ) => api<Announcement>(`/api/t/${schoolSlug}/announcements`, { method: "POST", body }),

  /* --- Invites --- */
  /** Adds a person to this school and emails them a temporary password. */
  invite: (
    schoolSlug: string,
    body: { name: string; email: string; role: "TEACHER" | "STUDENT" },
  ) =>
    api<{
      userId: string;
      name: string;
      email: string;
      role: string;
      schoolName: string;
      temporaryPassword: string | null;
      emailSent: boolean;
      /** Why the email did not go out. Null when it did, or when there was none to send. */
      emailError?: string | null;
    }>(`/api/t/${schoolSlug}/invite`, { method: "POST", body }),

  /* --- Calendar --- */
  /** This school's academic year, terms and timetable. */
  getCalendar: (schoolSlug: string) => api<SchoolCalendar>(`/api/t/${schoolSlug}/calendar`),

  /* --- Notification preferences --- */
  getNotificationPreferences: (schoolSlug: string) =>
    api<NotificationPreferences>(`/api/t/${schoolSlug}/notification-preferences`),
  saveNotificationPreferences: (
    schoolSlug: string,
    body: NotificationPreferences,
  ) =>
    api<NotificationPreferences>(`/api/t/${schoolSlug}/notification-preferences`, {
      method: "PUT",
      body,
    }),

  /* --- Fees --- */
  /**
   * The ledger is scoped by the session on the server: a School Admin sees the
   * whole school, a parent only their own children. The client must never send
   * an email to name the viewer.
   */
  listFees: (
    schoolSlug: string,
    params: {
      page?: number;
      search?: string;
      status?: string;
      classId?: string;
      term?: string;
    } = {},
  ) => api<Paginated<FeeInvoice>>(withQuery(`/api/t/${schoolSlug}/fees`, params)),
  getFeeSummary: (schoolSlug: string) =>
    api<FeeSummary>(`/api/t/${schoolSlug}/fees/summary`),
  createFeeInvoice: (
    schoolSlug: string,
    body: {
      studentId: string;
      feeType: FeeInvoice["feeType"];
      term: string;
      amount: number;
      dueDate: string;
      invoiceNo?: string;
    },
  ) => api<FeeInvoice>(`/api/t/${schoolSlug}/fees`, { method: "POST", body }),
  recordFeePayment: (schoolSlug: string, invoiceId: string, amount: number) =>
    api<FeeInvoice>(`/api/t/${schoolSlug}/fees/${invoiceId}`, {
      method: "PATCH",
      body: { amount },
    }),

  /* --- Roll-up for the dashboard --- */
  getDashboard: (schoolSlug: string) => api<SchoolDashboard>(`/api/t/${schoolSlug}/dashboard`),
};
