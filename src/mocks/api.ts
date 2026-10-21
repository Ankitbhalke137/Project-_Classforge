import { http, HttpResponse, passthrough } from "msw";
import {
  ACCOUNTS,
  ANNOUNCEMENTS,
  ASSIGNMENTS,
  ATTENDANCE,
  CLASS_BY_ID,
  CLASSES,
  DEMO_PASSWORD,
  EXAMS,
  EXAM_BY_ID,
  FEES,
  FEE_SUMMARY,
  PARENTS,
  PARENT_BY_ID,
  RESULTS,
  SCHOOLS,
  STUDENTS,
  STUDENT_BY_ID,
  SUBJECTS,
  SUBJECT_BY_ID,
  SUBMISSIONS,
  TEACHERS,
  TEACHER_BY_ID,
  TIMETABLE,
  childrenOf,
} from "@/mocks/data";
import { ATTENDANCE_DAYS } from "@/mocks/fixtures/operations";
import { TODAY, dateKey, recentSchoolDays } from "@/mocks/fixtures/random";
import type {
  Announcement,
  Assignment,
  AssignmentDetail,
  AssignmentListRow,
  AssignmentStats,
  AssignmentSubmission,
  AttendanceRecord,
  AttendanceStatus,
  AttendanceSummary,
  AttendanceTrendPoint,
  Exam,
  ExamResult,
  FeeInvoice,
  FeeSummary,
  Grade,
  Paginated,
  Parent,
  PlatformStats,
  ReportCard,
  SchoolClass,
  SchoolDashboard,
  SchoolIdentity,
  Student,
  StudentAttendance,
  SubmissionStatus,
} from "@/types";

const PAGE_SIZE = 8;

/**
 * A stand-in for the backend so the UI can be built and demoed before the API
 * exists. These handlers are the shapes the real endpoints will have.
 */

/* ------------------------------------------------------------------ *
 * Shared list behaviour
 *
 * Every paginated endpoint does the same thing: read page and pageSize off the
 * query string, filter, then slice. Repeating that here keeps each handler down
 * to what is actually specific to it.
 * ------------------------------------------------------------------ */

function pageOf<T>(rows: T[], url: URL, defaultPageSize = PAGE_SIZE): Paginated<T> {
  const page = Math.max(Number(url.searchParams.get("page") ?? 1), 1);
  const pageSize = Math.max(Number(url.searchParams.get("pageSize") ?? defaultPageSize), 1);
  const start = (page - 1) * pageSize;

  return {
    data: rows.slice(start, start + pageSize),
    total: rows.length,
    page,
    pageSize,
  };
}

/** Case-insensitive "does any of these fields contain the search term". */
function matches(row: object, search: string, fields: string[]): boolean {
  if (!search) return true;
  const needle = search.toLowerCase();
  const values = row as Record<string, unknown>;
  return fields.some((field) => String(values[field] ?? "").toLowerCase().includes(needle));
}

function filterParam(url: URL, key: string): string | undefined {
  return url.searchParams.get(key) ?? undefined;
}

function notFound(what: string) {
  return HttpResponse.json({ message: `${what} was not found` }, { status: 404 });
}

/** Tenants created through the platform endpoint during this session. */
const createdSlugs = new Set<string>();

function isKnownTenant(slug: string): boolean {
  return SCHOOLS.some((school) => school.slug === slug) || createdSlugs.has(slug);
}

/** Returns a 404 for a slug nobody has ever heard of, else null to carry on. */
function unknownTenant(slug: unknown) {
  return isKnownTenant(String(slug)) ? null : notFound("That school");
}

/**
 * The student the caller is acting as: their own when signed in as a student,
 * otherwise their first child. Null for staff, who mark whole classes.
 */
function identityOf(email: string | null): string | null {
  const account = email ? ACCOUNTS[email] : undefined;
  if (!account) return null;

  if (account.person.studentId) return account.person.studentId;
  if (account.person.parentId) return childrenOf(account.person.parentId)[0]?.id ?? null;

  return null;
}

/**
 * What `?mine=true` narrows to: a student's own class, a guardian's children's
 * classes, or the tasks a teacher set. Null when the account has no person
 * attached — staff with no identity get nothing rather than everything.
 */
function mineScope(email: string | null): ((assignment: Assignment) => boolean) | null {
  const account = email ? ACCOUNTS[email] : undefined;
  if (!account) return null;

  const classIds = new Set<string>();
  const self = account.person.studentId
    ? STUDENT_BY_ID.get(account.person.studentId)
    : undefined;
  if (self) classIds.add(self.classId);

  for (const child of account.person.parentId ? childrenOf(account.person.parentId) : []) {
    classIds.add(child.classId);
  }

  const teacherId = account.person.teacherId;
  if (classIds.size === 0 && teacherId === undefined) return null;

  return (assignment) =>
    classIds.has(assignment.classId) ||
    (teacherId !== undefined && assignment.teacherId === teacherId);
}

/* ------------------------------------------------------------------ *
 * Auth
 * ------------------------------------------------------------------ */

const login = http.post("/api/auth/login", async ({ request }) => {
  const { email, password } = (await request.json()) as {
    email: string;
    password: string;
  };

  const account = ACCOUNTS[email];

  if (!account || password !== DEMO_PASSWORD) {
    return HttpResponse.json({ message: "Email or password is incorrect" }, { status: 401 });
  }

  return HttpResponse.json({
    token: "mock-token",
    user: account.user,
    schools: account.schools,
  });
});

/* ------------------------------------------------------------------ *
 * Platform — Super Admin only, never reaches into school data
 * ------------------------------------------------------------------ */

const platformHandlers = [
  http.get("/api/platform/schools", () => HttpResponse.json(SCHOOLS)),

  http.get("/api/platform/stats", () => {
    const stats: PlatformStats = {
      schoolCount: SCHOOLS.length,
      activeSchoolCount: SCHOOLS.filter((school) => school.status === "ACTIVE").length,
      suspendedSchoolCount: SCHOOLS.filter((school) => school.status === "SUSPENDED").length,
      totalStudents: SCHOOLS.reduce((sum, school) => sum + school.studentCount, 0),
      totalTeachers: SCHOOLS.reduce(
        (sum, school) => sum + school.staffCount - PARENTS[school.slug]?.length,
        0,
      ),
      tenantLimit: 25,
    };

    return HttpResponse.json(stats);
  }),

  http.post("/api/platform/schools", async ({ request }) => {
    const { name, slug } = (await request.json()) as { name: string; slug: string };

    if (SCHOOLS.some((school) => school.slug === slug)) {
      return HttpResponse.json(
        { message: "That URL is already taken", fields: { slug: "Already in use" } },
        { status: 409 },
      );
    }

    // A new tenant starts empty — the empty states are real, not staged.
    const school = {
      id: `sch_${slug}`,
      name,
      slug,
      status: "ACTIVE" as const,
      studentCount: 0,
      staffCount: 0,
    };
    SCHOOLS.push(school);
    createdSlugs.add(slug);

    return HttpResponse.json(school, { status: 201 });
  }),

  http.patch("/api/platform/schools/:slug", async ({ params, request }) => {
    const { status } = (await request.json()) as { status: "ACTIVE" | "SUSPENDED" };
    const school = SCHOOLS.find((item) => item.slug === params.slug);

    if (!school) return notFound("That school");

    // Suspending never deletes data — the tenant stays readable, just read-only.
    school.status = status;
    return HttpResponse.json(school);
  }),
];

/* ------------------------------------------------------------------ *
 * Assignments
 * ------------------------------------------------------------------ */

/** Whole days until the due date — negative once it has gone. */
function daysUntil(dueDate: string): number {
  const due = new Date(`${dueDate}T00:00:00`).getTime();
  const today = new Date(`${dateKey(TODAY)}T00:00:00`).getTime();
  return Math.round((due - today) / 86_400_000);
}

function summariseSubmissions(submissions: AssignmentSubmission[]): AssignmentStats {
  const count = (status: SubmissionStatus) => submissions.filter((row) => row.status === status).length;
  const graded = submissions.filter((row) => row.marksObtained !== null);

  return {
    total: submissions.length,
    notStarted: count("NOT_STARTED"),
    inProgress: count("IN_PROGRESS"),
    submitted: count("SUBMITTED"),
    late: count("LATE"),
    graded: count("GRADED"),
    onTimeRate:
      submissions.length === 0
        ? 0
        : Math.round(
            ((count("GRADED") + count("SUBMITTED")) / submissions.length) * 100,
          ),
    averageMarks:
      graded.length === 0
        ? null
        : Math.round((graded.reduce((sum, row) => sum + (row.marksObtained ?? 0), 0) / graded.length) * 10) / 10,
  };
}

/** The names a list needs, plus how the class as a whole is doing. */
function toAssignmentRow(
  slug: string,
  assignment: Assignment,
  viewerStudentId: string | null,
): AssignmentListRow {
  const submissions = (SUBMISSIONS[slug] ?? []).filter(
    (row) => row.assignmentId === assignment.id,
  );

  return {
    ...assignment,
    className: CLASS_BY_ID.get(assignment.classId)?.name ?? assignment.classId,
    subjectName: SUBJECT_BY_ID.get(assignment.subjectId)?.name ?? assignment.subjectId,
    subjectCode: SUBJECT_BY_ID.get(assignment.subjectId)?.code ?? "",
    teacherName: TEACHER_BY_ID.get(assignment.teacherId)?.name ?? assignment.teacherId,
    daysLeft: daysUntil(assignment.dueDate),
    stats: summariseSubmissions(submissions),
    mine: viewerStudentId
      ? submissions.find((row) => row.studentId === viewerStudentId) ?? null
      : null,
  };
}

/** Strips the list-only extras so the detail payload matches AssignmentDetail. */
function detailOf(row: AssignmentListRow): AssignmentDetail["assignment"] {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    classId: row.classId,
    subjectId: row.subjectId,
    teacherId: row.teacherId,
    assignedOn: row.assignedOn,
    dueDate: row.dueDate,
    maxMarks: row.maxMarks,
    status: row.status,
    attachments: row.attachments,
    className: row.className,
    subjectName: row.subjectName,
    teacherName: row.teacherName,
    daysLeft: row.daysLeft,
  };
}

/* ------------------------------------------------------------------ *
 * Attendance — shared by the school-wide day sheet and a single register
 * ------------------------------------------------------------------ */

function tally(records: AttendanceRecord[]): Omit<AttendanceSummary, "classId" | "className" | "date" | "percentage"> {
  const count = (status: AttendanceStatus) => records.filter((r) => r.status === status).length;
  const present = count("PRESENT");
  const late = count("LATE");

  return {
    total: records.length,
    present: present + late,
    absent: count("ABSENT"),
    late,
    excused: count("EXCUSED"),
  };
}

function summarise(records: AttendanceRecord[], classId: string, date: string): AttendanceSummary {
  const counts = tally(records);

  return {
    classId,
    className: CLASS_BY_ID.get(classId)?.name ?? classId,
    date,
    ...counts,
    percentage: counts.total === 0 ? 0 : Math.round((counts.present / counts.total) * 100),
  };
}

/* ------------------------------------------------------------------ *
 * Exams and grades
 * ------------------------------------------------------------------ */

function gradeFor(percentage: number): Grade {
  const bands: readonly { grade: Grade; min: number }[] = [
    { grade: "A+", min: 90 },
    { grade: "A", min: 80 },
    { grade: "B+", min: 70 },
    { grade: "B", min: 60 },
    { grade: "C", min: 50 },
    { grade: "D", min: 40 },
    { grade: "E", min: 0 },
  ];
  return bands.find((band) => percentage >= band.min)?.grade ?? "E";
}

/** Every published exam for one student in one term, plus their ranking in it. */
function buildReportCard(slug: string, student: Student, term: string): ReportCard {
  const exams = (EXAMS[slug] ?? [])
    .filter(
      (exam) =>
        exam.classId === student.classId &&
        exam.term === term &&
        exam.status !== "SCHEDULED" &&
        exam.publishedAt !== null,
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  const examIds = new Set(exams.map((exam) => exam.id));
  const mine = (RESULTS[slug] ?? []).filter((result) => examIds.has(result.examId));

  const rows = exams.map((exam) => {
    const result = mine.find((item) => item.examId === exam.id && item.studentId === student.id);

    return {
      examId: exam.id,
      subjectId: exam.subjectId,
      subjectName: SUBJECT_BY_ID.get(exam.subjectId)?.name ?? exam.subjectId,
      examName: exam.name,
      date: exam.date,
      maxMarks: exam.maxMarks,
      marksObtained: result?.marksObtained ?? null,
      grade: result?.grade ?? null,
    };
  });

  const marked = rows.filter((row) => row.marksObtained !== null);
  const totalMarks = marked.reduce((sum, row) => sum + (row.marksObtained ?? 0), 0);
  const maxTotal = marked.reduce((sum, row) => sum + row.maxMarks, 0);
  const percentage = maxTotal === 0 ? 0 : Math.round((totalMarks / maxTotal) * 100);

  const attendance = (ATTENDANCE[slug] ?? []).filter((record) => record.studentId === student.id);
  const classmates = (STUDENTS[slug] ?? []).filter((peer) => peer.classId === student.classId);

  return {
    studentId: student.id,
    studentName: student.name,
    admissionNo: student.admissionNo,
    className: student.className,
    term,
    rows,
    totalMarks,
    maxTotal,
    percentage,
    overallGrade: marked.length === 0 ? null : gradeFor(percentage),
    attendancePercentage:
      attendance.length === 0
        ? 0
        : Math.round(
            (attendance.filter((r) => r.status === "PRESENT" || r.status === "LATE").length /
              attendance.length) *
              100,
          ),
    rank: rankAmong(slug, schoolwideScope(slug), student.id, term),
    classRank: rankAmong(slug, classmates.map((peer) => peer.id), student.id, term),
    totalStudents: classmates.length,
  };
}

/** Everyone in the school — a rank is only meaningful against the whole cohort. */
function schoolwideScope(slug: string): string[] {
  return (STUDENTS[slug] ?? []).map((student) => student.id);
}

/** 1-based position on the term, or null when nothing has been marked. */
function rankAmong(
  slug: string,
  studentIds: string[],
  studentId: string,
  term: string,
): number | null {
  const standings = studentIds
    .map((id) => ({ id, value: termTotal(slug, id, term) }))
    .filter((row): row is { id: string; value: number } => row.value !== null)
    .sort((a, b) => b.value - a.value);

  const position = standings.findIndex((row) => row.id === studentId) + 1;
  return position === 0 ? null : position;
}

/** Percentage across a student's published exams in a term, or null if unmarked. */
function termTotal(slug: string, studentId: string, term: string): number | null {
  const exams = (EXAMS[slug] ?? []).filter(
    (exam) =>
      exam.term === term &&
      exam.status !== "SCHEDULED" &&
      exam.publishedAt !== null &&
      STUDENT_BY_ID.get(studentId)?.classId === exam.classId,
  );
  if (exams.length === 0) return null;

  const results = (RESULTS[slug] ?? []).filter(
    (result) => result.studentId === studentId && exams.some((exam) => exam.id === result.examId),
  );
  const marked = results.filter((result) => result.marksObtained !== null);
  if (marked.length === 0) return null;

  const gained = marked.reduce((sum, result) => sum + (result.marksObtained ?? 0), 0);
  const possible = marked.reduce(
    (sum, result) => sum + (exams.find((exam) => exam.id === result.examId)?.maxMarks ?? 0),
    0,
  );

  return possible === 0 ? null : (gained / possible) * 100;
}

/* ------------------------------------------------------------------ *
 * School handlers
 * ------------------------------------------------------------------ */

/**
 * Which students a caller may read fee records for, or null when they may read
 * every invoice.
 *
 * A school admin reads the whole ledger. A guardian reads only their children and
 * a student only themselves — `SCHOOL_AREAS.fees` opens the screen to both, so the
 * scoping has to happen here rather than in the nav.
 */
function feeScope(email: string | undefined): Set<string> | null {
  const account = email ? ACCOUNTS[email] : undefined;
  if (!account) return new Set<string>();

  if (account.schools.some((school) => school.role === "SCHOOL_ADMIN")) return null;

  if (account.person.parentId) {
    return new Set(childrenOf(account.person.parentId).map((child) => child.id));
  }

  if (account.person.studentId) return new Set([account.person.studentId]);

  return new Set<string>();
}

/** Recomputes the summary from the invoices the caller can actually see. */
function summaryOf(invoices: FeeInvoice[]): FeeSummary {
  const totalBilled = invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const totalCollected = invoices.reduce((sum, invoice) => sum + invoice.amountPaid, 0);
  const overdue = invoices.filter((invoice) => invoice.status === "OVERDUE");

  return {
    totalBilled,
    totalCollected,
    outstanding: totalBilled - totalCollected,
    overdueAmount: overdue.reduce(
      (sum, invoice) => sum + invoice.amount - invoice.amountPaid,
      0,
    ),
    overdueCount: overdue.length,
    collectionRate: totalBilled === 0 ? 0 : Math.round((totalCollected / totalBilled) * 100),
  };
}

function schoolHandlers(slug: string) {
  /** 404s for an unknown tenant, mirroring how the real API would behave. */
  const known = () => SCHOOLS.some((school) => school.slug === slug);

  return [
    /* --- Students --- */

    http.get(`/api/t/${slug}/students`, ({ request }) => {
      if (!known()) return notFound("That school");

      const url = new URL(request.url);
      const classId = filterParam(url, "classId");
      const status = filterParam(url, "status");
      const search = filterParam(url, "search") ?? "";

      const rows = (STUDENTS[slug] ?? []).filter(
        (student) =>
          (!classId || student.classId === classId) &&
          (!status || student.status === status) &&
          matches(student, search, [
            "name",
            "className",
            "admissionNo",
            "email",
          ]),
      );

      return HttpResponse.json(pageOf(rows, url));
    }),

    http.get(`/api/t/${slug}/students/:id`, ({ params }) => {
      const student = STUDENT_BY_ID.get(params.id as string);

      if (!student || STUDENTS[slug]?.some((row) => row.id === student.id) === false) {
        return notFound("That student");
      }

      const guardian = student.parentId ? PARENT_BY_ID.get(student.parentId) : null;

      return HttpResponse.json({
        student,
        guardian,
        class: CLASS_BY_ID.get(student.classId) ?? null,
        homeroomTeacher: student.classId
          ? TEACHER_BY_ID.get(CLASS_BY_ID.get(student.classId)?.homeroomTeacherId ?? "") ?? null
          : null,
      });
    }),

    http.get(`/api/t/${slug}/students/:id/attendance`, ({ params, request }) => {
      const student = STUDENT_BY_ID.get(params.id as string);
      if (!student) return notFound("That student");

      const url = new URL(request.url);
      const days = Number(url.searchParams.get("days") ?? ATTENDANCE_DAYS);
      const allowed = new Set(recentSchoolDays(TODAY, days));

      const records = (ATTENDANCE[slug] ?? [])
        .filter((record) => record.studentId === student.id && allowed.has(record.date))
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((record) => ({
          ...record,
          studentName: student.name,
          className: CLASS_BY_ID.get(record.classId)?.name ?? record.classId,
        }));

      const counts = tally(records);
      const attendance: StudentAttendance = {
        studentId: student.id,
        records,
        summary: {
          ...counts,
          percentage: counts.total === 0 ? 0 : Math.round((counts.present / counts.total) * 100),
        },
      };

      return HttpResponse.json(attendance);
    }),

    http.get(`/api/t/${slug}/students/:id/report-card`, ({ params, request }) => {
      const url = new URL(request.url);
      const term = url.searchParams.get("term") ?? "Term 1";
      const email = url.searchParams.get("email") ?? undefined;

      // The client passes "me" when asking for the signed-in student's own card.
      // Resolve it to a real student id from the session account.
      let studentId = params.id as string;
      if (studentId === "me" && email) {
        const account = ACCOUNTS[email];
        studentId = account?.person.studentId ?? "";
      }

      const student = studentId ? STUDENT_BY_ID.get(studentId) : null;
      if (!student) return notFound("That student");

      // A student may only view their own report card. Staff may view any
      // student's card. The signed-in account is identified by ?email= so the
      // id in the URL can never be used to reach another student's record.
      if (email) {
        const account = ACCOUNTS[email];
        const accountStudentId = account?.person.studentId;
        if (accountStudentId && accountStudentId !== student.id) {
          return notFound("That student");
        }
      }

      return HttpResponse.json(buildReportCard(slug, student, term));
    }),

    /* --- Staff and guardians --- */

    http.get(`/api/t/${slug}/teachers`, ({ request }) => {
      if (!known()) return notFound("That school");

      const url = new URL(request.url);
      const search = filterParam(url, "search") ?? "";

      const rows = (TEACHERS[slug] ?? []).filter((teacher) =>
        matches(teacher, search, [
          "name",
          "email",
          "subject",
          "designation",
        ]),
      );

      return HttpResponse.json(rows);
    }),

    http.get(`/api/t/${slug}/parents`, ({ request }) => {
      if (!known()) return notFound("That school");

      const url = new URL(request.url);
      const search = filterParam(url, "search") ?? "";

      const rows = (PARENTS[slug] ?? []).filter((parent: Parent) =>
        matches(parent, search, ["name", "email", "occupation"]),
      );

      return HttpResponse.json(pageOf(rows, url));
    }),

    http.get(`/api/t/${slug}/parents/:id/children`, ({ params }) => {
      const parent = PARENT_BY_ID.get(params.id as string);
      if (!parent) return notFound("That parent");

      return HttpResponse.json(childrenOf(parent.id));
    }),

    /* --- Academic structure --- */

    http.get(`/api/t/${slug}/subjects`, () => HttpResponse.json(SUBJECTS[slug] ?? [])),

    http.get(`/api/t/${slug}/classes`, ({ request }) => {
      if (!known()) return notFound("That school");

      const url = new URL(request.url);
      const grade = filterParam(url, "grade");
      const search = filterParam(url, "search") ?? "";

      const rows = (CLASSES[slug] ?? []).filter(
        (schoolClass: SchoolClass) =>
          (!grade || schoolClass.grade === grade) &&
          matches(schoolClass, search, ["name", "room"]),
      );

      return HttpResponse.json(rows);
    }),

    http.get(`/api/t/${slug}/classes/:id/timetable`, ({ params }) => {
      const slots = (TIMETABLE[slug] ?? []).filter((slot) => slot.classId === params.id);

      if (slots.length === 0 && !CLASS_BY_ID.has(params.id as string)) {
        return notFound("That class");
      }

      return HttpResponse.json(slots);
    }),

    /* --- Attendance --- */

    http.get(`/api/t/${slug}/attendance`, ({ request }) => {
      if (!known()) return notFound("That school");

      const url = new URL(request.url);
      const date = filterParam(url, "date") ?? dateKey(TODAY);
      const classId = filterParam(url, "classId");

      const summaries = (CLASSES[slug] ?? [])
        .filter((schoolClass: SchoolClass) => !classId || schoolClass.id === classId)
        .map((schoolClass: SchoolClass) =>
          summarise(
            (ATTENDANCE[slug] ?? []).filter(
              (record) => record.classId === schoolClass.id && record.date === date,
            ),
            schoolClass.id,
            date,
          ),
        );

      return HttpResponse.json(summaries);
    }),

    http.get(`/api/t/${slug}/attendance/register`, ({ request }) => {
      const url = new URL(request.url);
      const classId = filterParam(url, "classId") ?? "";
      const date = filterParam(url, "date") ?? dateKey(TODAY);
      const schoolClass = CLASS_BY_ID.get(classId);

      if (!schoolClass) return notFound("That class");

      return HttpResponse.json({
        date,
        class: schoolClass,
        // The roster comes from the students, not the records, so every name is
        // there even on a day nobody has marked yet.
        students: (STUDENTS[slug] ?? []).filter(
          (student) => student.classId === classId && student.status === "ACTIVE",
        ),
        records: (ATTENDANCE[slug] ?? []).filter(
          (record) => record.classId === classId && record.date === date,
        ),
      });
    }),

    // Marking a register rewrites that class-day in place, so the day sheet and
    // the trend both move when a teacher saves.
    http.post(`/api/t/${slug}/attendance`, async ({ request }) => {
      const body = (await request.json()) as {
        date: string;
        classId: string;
        records: { studentId: string; status: AttendanceStatus }[];
      };

      const schoolClass = CLASS_BY_ID.get(body.classId);
      if (!schoolClass) return notFound("That class");

      const store = ATTENDANCE[slug];
      if (!store) return notFound("That school");

      const saved: AttendanceRecord[] = body.records.map((entry) => {
        const existing = store.find(
          (record) =>
            record.classId === body.classId &&
            record.date === body.date &&
            record.studentId === entry.studentId,
        );

        return {
          id: existing?.id ?? `${body.date}_${entry.studentId}`,
          date: body.date,
          classId: body.classId,
          studentId: entry.studentId,
          status: entry.status,
          markedByTeacherId: existing?.markedByTeacherId ?? schoolClass.homeroomTeacherId,
          markedAt: new Date().toISOString(),
        };
      });

      for (const record of saved) {
        const index = store.findIndex((row) => row.id === record.id);
        if (index === -1) store.push(record);
        else store[index] = record;
      }

      return HttpResponse.json({ records: saved });
    }),

    http.get(`/api/t/${slug}/attendance/trend`, ({ request }) => {
      if (!known()) return notFound("That school");

      const url = new URL(request.url);
      const days = Number(url.searchParams.get("days") ?? 14);
      const schoolDayList = recentSchoolDays(TODAY, days);

      const trend: AttendanceTrendPoint[] = schoolDayList.map((date) => {
        const records = (ATTENDANCE[slug] ?? []).filter((record) => record.date === date);
        const counts = tally(records);

        return {
          date,
          percentage: counts.total === 0 ? 0 : Math.round((counts.present / counts.total) * 100),
          marked: counts.total,
        };
      });

      return HttpResponse.json(trend);
    }),

    /* --- Exams --- */

    http.get(`/api/t/${slug}/exams`, ({ request }) => {
      if (!known()) return notFound("That school");

      const url = new URL(request.url);
      const term = filterParam(url, "term");
      const status = filterParam(url, "status");
      const classId = filterParam(url, "classId");
      const search = filterParam(url, "search") ?? "";
      const mine = url.searchParams.get("mine") === "true";
      const email = url.searchParams.get("email") ?? undefined;

      let rows = (EXAMS[slug] ?? [])
        .filter(
          (exam: Exam) =>
            (!term || exam.term === term) &&
            (!status || exam.status === status) &&
            (!classId || exam.classId === classId),
        )
        .map((exam) => ({
          ...exam,
          subjectName: SUBJECT_BY_ID.get(exam.subjectId)?.name ?? exam.subjectId,
          className: CLASS_BY_ID.get(exam.classId)?.name ?? exam.classId,
          teacherName: TEACHER_BY_ID.get(exam.teacherId)?.name ?? exam.teacherId,
        }))
        .filter((exam) =>
          matches(exam, search, ["name", "subjectName", "term"]),
        )
        .sort((a, b) => b.date.localeCompare(a.date));

      // A student signing in with ?mine=true sees only their own published
      // exams for their class. Staff see everything.
      if (mine && email) {
        const account = ACCOUNTS[email];
        const studentId = account?.person.studentId;
        const student = studentId ? STUDENT_BY_ID.get(studentId) : null;
        if (student) {
          rows = rows.filter(
            (exam) => exam.status === "PUBLISHED" && exam.classId === student.classId,
          );
        } else {
          rows = [];
        }
      }

      return HttpResponse.json(pageOf(rows, url));
    }),

    http.get(`/api/t/${slug}/exams/:id/results`, ({ params }) => {
      const exam = EXAM_BY_ID.get(params.id as string);
      if (!exam) return notFound("That exam");

      const results = (RESULTS[slug] ?? [])
        .filter((result: ExamResult) => result.examId === exam.id)
        .map((result) => ({
          ...result,
          studentName: STUDENT_BY_ID.get(result.studentId)?.name ?? result.studentId,
          admissionNo: STUDENT_BY_ID.get(result.studentId)?.admissionNo ?? "",
          className: CLASS_BY_ID.get(exam.classId)?.name ?? exam.classId,
        }));

      return HttpResponse.json({ exam, results });
    }),

    http.post(`/api/t/${slug}/exams/:id/publish`, ({ params }) => {
      const exam = EXAM_BY_ID.get(params.id as string);
      if (!exam) return notFound("That exam");

      exam.status = "PUBLISHED";
      exam.publishedAt = new Date().toISOString();

      // Publishing marks anything left open, which is what the button means.
      for (const result of RESULTS[slug] ?? []) {
        if (result.examId === exam.id && result.marksObtained === null) {
          result.marksObtained = Math.round(exam.maxMarks * 0.5);
          result.grade = gradeFor(50);
          result.remarks = "Marked on publication";
        }
      }

      return HttpResponse.json(exam);
    }),

    http.get(`/api/t/${slug}/report-cards`, ({ request }) => {
      const url = new URL(request.url);
      const classId = filterParam(url, "classId") ?? "";
      const term = filterParam(url, "term") ?? "Term 1";

      const schoolClass = CLASS_BY_ID.get(classId);
      if (!schoolClass) return notFound("That class");

      const cards: ReportCard[] = (STUDENTS[slug] ?? [])
        .filter((student) => student.classId === classId)
        .map((student) => buildReportCard(slug, student, term));

      return HttpResponse.json(cards);
    }),

    /* --- Assignments --- */

    http.get(`/api/t/${slug}/assignments`, ({ request }) => {
      if (!known()) return notFound("That school");

      const url = new URL(request.url);
      const status = filterParam(url, "status");
      const classId = filterParam(url, "classId");
      const subjectId = filterParam(url, "subjectId");
      const search = filterParam(url, "search") ?? "";
      const email = url.searchParams.get("email");
      const viewer = identityOf(email);
      const mineRequested = url.searchParams.get("mine") === "true";
      const scope = mineRequested ? mineScope(email) : null;

      const rows = (ASSIGNMENTS[slug] ?? [])
        .filter(
          (assignment) =>
            (!status || assignment.status === status) &&
            (!classId || assignment.classId === classId) &&
            (!subjectId || assignment.subjectId === subjectId),
        )
        // ?mine=true is what a student, a parent and a teacher each see as
        // "mine". Asking for it with no recognised identity returns nothing.
        .filter((assignment) => !mineRequested || (scope?.(assignment) ?? false))
        .map((assignment) => toAssignmentRow(slug, assignment, viewer))
        .filter((assignment) =>
          matches(assignment, search, ["title", "subjectName", "className", "teacherName"]),
        )
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

      return HttpResponse.json(pageOf(rows, url));
    }),

    http.get(`/api/t/${slug}/assignments/:id`, ({ params }) => {
      const assignment = ASSIGNMENTS[slug]?.find((row) => row.id === params.id);
      if (!assignment) return notFound("That assignment");

      const submissions = (SUBMISSIONS[slug] ?? [])
        .filter((row) => row.assignmentId === assignment.id)
        .map((row) => ({
          ...row,
          studentName: STUDENT_BY_ID.get(row.studentId)?.name ?? row.studentId,
          admissionNo: STUDENT_BY_ID.get(row.studentId)?.admissionNo ?? "",
        }))
        .sort((a, b) => a.studentName.localeCompare(b.studentName));

      return HttpResponse.json({
        assignment: detailOf(toAssignmentRow(slug, assignment, null)),
        submissions,
        stats: summariseSubmissions(submissions),
      } satisfies AssignmentDetail);
    }),

    http.post(`/api/t/${slug}/assignments`, async ({ request }) => {
      const body = (await request.json()) as {
        title: string;
        description: string;
        classId: string;
        subjectId: string;
        dueDate: string;
        maxMarks: number;
      };

      const fields: Record<string, string> = {};
      if (!body.title?.trim()) fields.title = "Give it a title";
      if (!CLASS_BY_ID.has(body.classId)) fields.classId = "Pick a class";
      if (!body.dueDate) fields.dueDate = "Set a due date";

      if (Object.keys(fields).length > 0) {
        return HttpResponse.json(
          { message: "Check the form", fields },
          { status: 422 },
        );
      }

      const store = ASSIGNMENTS[slug];
      if (!store) return notFound("That school");

      const created = toAssignmentRow(
        slug,
        {
          id: `${body.classId}_asg_custom_${Date.now()}`,
          title: body.title,
          description: body.description ?? "",
          classId: body.classId,
          subjectId: body.subjectId,
          teacherId: CLASS_BY_ID.get(body.classId)?.homeroomTeacherId ?? "",
          assignedOn: dateKey(TODAY),
          dueDate: body.dueDate,
          maxMarks: body.maxMarks || 20,
          status: daysUntil(body.dueDate) > 0 ? "OPEN" : "CLOSED",
          attachments: [],
        },
        null,
      );

      store.push(detailOf(created));
      return HttpResponse.json(created, { status: 201 });
    }),

    http.post(`/api/t/${slug}/assignments/:id/submissions`, async ({ request, params }) => {
      const body = (await request.json()) as { studentId: string; status: SubmissionStatus };
      const store = SUBMISSIONS[slug];
      if (!store) return notFound("That school");

      const existing = store.find(
        (row) => row.assignmentId === params.id && row.studentId === body.studentId,
      );

      const saved: AssignmentSubmission = {
        id: existing?.id ?? `${params.id}_sub_${body.studentId}`,
        assignmentId: String(params.id),
        studentId: body.studentId,
        status: body.status,
        submittedAt: new Date().toISOString(),
        // Handing work in clears any mark it already had.
        marksObtained: null,
        feedback: null,
      };

      if (existing) store[store.indexOf(existing)] = saved;
      else store.push(saved);

      return HttpResponse.json(saved);
    }),

    http.post(`/api/t/${slug}/assignments/:id/grade`, async ({ request, params }) => {
      const body = (await request.json()) as {
        studentId: string;
        marksObtained: number;
        feedback?: string;
      };
      const assignment = ASSIGNMENTS[slug]?.find((row) => row.id === params.id);
      if (!assignment) return notFound("That assignment");

      if (body.marksObtained > assignment.maxMarks) {
        return HttpResponse.json(
          { message: "Check the form", fields: { marksObtained: `Out of ${assignment.maxMarks}` } },
          { status: 422 },
        );
      }

      const store = SUBMISSIONS[slug];
      const existing = store?.find(
        (row) => row.assignmentId === assignment.id && row.studentId === body.studentId,
      );

      if (!store) return notFound("That school");

      const saved: AssignmentSubmission = {
        id: existing?.id ?? `${assignment.id}_sub_${body.studentId}`,
        assignmentId: assignment.id,
        studentId: body.studentId,
        status: "GRADED",
        submittedAt: existing?.submittedAt ?? new Date().toISOString(),
        marksObtained: body.marksObtained,
        feedback: body.feedback ?? null,
      };

      if (existing) store[store.indexOf(existing)] = saved;
      else store.push(saved);

      return HttpResponse.json(saved);
    }),

    /* --- Who am I --- */

    http.get(`/api/t/${slug}/me`, ({ request }) => {
      if (!known()) return notFound("That school");

      const email = new URL(request.url).searchParams.get("email") ?? "";
      const account = ACCOUNTS[email];
      if (!account) return notFound("That account");

      const membershipHere = account.schools.find((entry) => entry.schoolSlug === slug);
      if (!membershipHere) return notFound("That account");

      const student = account.person.studentId
        ? (STUDENT_BY_ID.get(account.person.studentId) ?? null)
        : null;
      const children = account.person.parentId ? childrenOf(account.person.parentId) : [];

      return HttpResponse.json({
        role: membershipHere.role,
        // A guardian looking at the screen acts on behalf of their first child.
        student: student ?? children[0] ?? null,
        children,
        teacher: account.person.teacherId
          ? (TEACHER_BY_ID.get(account.person.teacherId) ?? null)
          : null,
      } satisfies SchoolIdentity);
    }),

    /* --- Announcements --- */

    http.get(`/api/t/${slug}/announcements`, ({ request }) => {
      if (!known()) return notFound("That school");

      const url = new URL(request.url);
      const priority = filterParam(url, "priority");
      const audience = filterParam(url, "audience");
      const search = filterParam(url, "search") ?? "";

      const rows = (ANNOUNCEMENTS[slug] ?? [])
        .filter(
          (item: Announcement) =>
            (!priority || item.priority === priority) &&
            (!audience || item.audience.includes(audience as never)),
        )
        .filter((item) =>
          matches(item, search, ["title", "body", "authorName"]),
        )
        .sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return b.publishedAt.localeCompare(a.publishedAt);
        });

      return HttpResponse.json(pageOf(rows, url));
    }),

    http.post(`/api/t/${slug}/announcements`, async ({ request }) => {
      const body = (await request.json()) as Pick<
        Announcement,
        "title" | "body" | "audience" | "priority"
      > & { pinned?: boolean };

      if (!body.title?.trim()) {
        return HttpResponse.json(
          { message: "Check the form", fields: { title: "Give it a title" } },
          { status: 422 },
        );
      }

      const store = ANNOUNCEMENTS[slug];
      if (!store) return notFound("That school");

      const created: Announcement = {
        id: `${slug}_ann_${Date.now()}`,
        title: body.title,
        body: body.body,
        audience: body.audience,
        priority: body.priority,
        pinned: body.pinned ?? false,
        authorId: `${slug}_staff`,
        authorName: "You",
        authorRole: "SCHOOL_ADMIN",
        publishedAt: new Date().toISOString(),
        eventDate: null,
        attachments: [],
        readCount: 0,
      };

      store.unshift(created);
      return HttpResponse.json(created, { status: 201 });
    }),

    /* --- Fees --- */

    http.get(`/api/t/${slug}/fees`, ({ request }) => {
      if (!known()) return notFound("That school");

      const url = new URL(request.url);
      const status = filterParam(url, "status");
      const term = filterParam(url, "term");
      const classId = filterParam(url, "classId");
      const search = filterParam(url, "search") ?? "";
      const scope = feeScope(filterParam(url, "email"));

      const classNameOf = new Map(
        (STUDENTS[slug] ?? []).map((student) => [student.id, student.classId]),
      );

      const rows = (FEES[slug] ?? [])
        .filter((invoice) => !scope || scope.has(invoice.studentId))
        .filter(
          (invoice) =>
            (!status || invoice.status === status) &&
            (!term || invoice.term === term) &&
            (!classId || classNameOf.get(invoice.studentId) === classId),
        )
        .filter((invoice) =>
          matches(invoice, search, [
            "studentName",
            "className",
            "admissionNo",
          ]),
        )
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

      return HttpResponse.json(pageOf(rows, url));
    }),

    http.get(`/api/t/${slug}/fees/summary`, ({ request }) => {
      if (!known()) return notFound("That school");

      const scope = feeScope(filterParam(new URL(request.url), "email"));

      // A school-wide caller gets the fixture roll-up; anyone narrower has it
      // recomputed from just the invoices they are allowed to read.
      if (scope === null) {
        return HttpResponse.json(FEE_SUMMARY[slug] ?? summaryOf(FEES[slug] ?? []));
      }

      const visible = (FEES[slug] ?? []).filter((invoice) => scope.has(invoice.studentId));
      return HttpResponse.json(summaryOf(visible));
    }),

    /* --- Dashboard --- */

    http.get(`/api/t/${slug}/dashboard`, () => {
      if (!known()) return notFound("That school");

      const today = dateKey(TODAY);
      const dayRecords = (ATTENDANCE[slug] ?? []).filter((record) => record.date === today);
      const todayTally = tally(dayRecords);
      const upcoming = (EXAMS[slug] ?? [])
        .filter((exam) => exam.status === "SCHEDULED")
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 5);
      const recent = (EXAMS[slug] ?? [])
        .filter((exam) => exam.status === "PUBLISHED")
        .sort((a, b) => b.publishedAt!.localeCompare(a.publishedAt!))
        .slice(0, 5);

      const dashboard: SchoolDashboard = {
        schoolSlug: slug,
        studentCount: (STUDENTS[slug] ?? []).length,
        teacherCount: (TEACHERS[slug] ?? []).length,
        classCount: (CLASSES[slug] ?? []).length,
        parentCount: (PARENTS[slug] ?? []).length,
        attendanceToday: {
          date: today,
          percentage: todayTally.total === 0 ? 0 : Math.round((todayTally.present / todayTally.total) * 100),
          marked: todayTally.total,
          total: (STUDENTS[slug] ?? []).length,
        },
        fees: FEE_SUMMARY[slug]!,
        upcomingExams: upcoming,
        recentExams: recent,
        latestAnnouncements: (ANNOUNCEMENTS[slug] ?? [])
          .slice()
          .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
          .slice(0, 5),
      };

      return HttpResponse.json(dashboard);
    }),
  ];
}

/**
 * Handlers for every tenant in the demo. Built at import time so adding a school
 * to the fixtures is the only step needed to make it reachable over HTTP.
 */
const schoolHandlerSets = SCHOOLS.map((school) => schoolHandlers(school.slug));

const EMPTY_PAGE = <T,>(): Paginated<T> => ({ data: [], total: 0, page: 1, pageSize: PAGE_SIZE });

/**
 * A school added through the platform endpoint mid-session has no fixtures behind
 * it, and its handlers cannot be created until the page reloads. These answer its
 * screens with empty shapes, so the new tenant shows the EmptyState it should —
 * while a slug that was never onboarded still gets a 404.
 */
const emptyTenantHandlers = [
  http.get("/api/t/:slug/students", ({ params }) =>
    unknownTenant(params.slug) ?? HttpResponse.json(EMPTY_PAGE()),
  ),
  http.get("/api/t/:slug/parents", ({ params }) =>
    unknownTenant(params.slug) ?? HttpResponse.json(EMPTY_PAGE()),
  ),
  http.get("/api/t/:slug/exams", ({ params }) =>
    unknownTenant(params.slug) ?? HttpResponse.json(EMPTY_PAGE()),
  ),
  http.get("/api/t/:slug/fees", ({ params }) =>
    unknownTenant(params.slug) ?? HttpResponse.json(EMPTY_PAGE()),
  ),
  http.get("/api/t/:slug/announcements", ({ params }) =>
    unknownTenant(params.slug) ?? HttpResponse.json(EMPTY_PAGE()),
  ),
  http.get("/api/t/:slug/teachers", ({ params }) =>
    unknownTenant(params.slug) ?? HttpResponse.json([]),
  ),
  http.get("/api/t/:slug/subjects", ({ params }) =>
    unknownTenant(params.slug) ?? HttpResponse.json([]),
  ),
  http.get("/api/t/:slug/classes", ({ params }) =>
    unknownTenant(params.slug) ?? HttpResponse.json([]),
  ),
  http.get("/api/t/:slug/attendance", ({ params }) =>
    unknownTenant(params.slug) ?? HttpResponse.json([]),
  ),
  http.get("/api/t/:slug/attendance/trend", ({ params }) =>
    unknownTenant(params.slug) ?? HttpResponse.json([]),
  ),
  http.get("/api/t/:slug/fees/summary", ({ params }) =>
    unknownTenant(params.slug) ??
    HttpResponse.json({
      totalBilled: 0,
      totalCollected: 0,
      outstanding: 0,
      overdueAmount: 0,
      overdueCount: 0,
      collectionRate: 0,
    }),
  ),
  http.get("/api/t/:slug/dashboard", ({ params }) => {
    const missing = unknownTenant(params.slug);
    if (missing) return missing;

    return HttpResponse.json({
      schoolSlug: params.slug,
      studentCount: 0,
      teacherCount: 0,
      classCount: 0,
      parentCount: 0,
      attendanceToday: { date: dateKey(TODAY), percentage: 0, marked: 0, total: 0 },
      fees: {
        totalBilled: 0,
        totalCollected: 0,
        outstanding: 0,
        overdueAmount: 0,
        overdueCount: 0,
        collectionRate: 0,
      },
      upcomingExams: [],
      recentExams: [],
      latestAnnouncements: [],
    });
  }),
];

export const handlers = [
  login,
  ...platformHandlers,
  ...schoolHandlerSets.flat(),
  ...emptyTenantHandlers,

  // Anything that is not /api/* is Next.js itself — let it through untouched.
  http.all("*", () => passthrough()),
];