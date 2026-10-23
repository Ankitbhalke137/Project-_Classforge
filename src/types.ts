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
  /**
   * A suspended school stays readable and turns read-only, so the shell can say
   * so and hide every write control. Resolved when the session is issued.
   */
  status: School["status"];
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

/** Cross-tenant counters for the platform area. Counts never touch school data. */
export interface PlatformStats {
  schoolCount: number;
  activeSchoolCount: number;
  suspendedSchoolCount: number;
  totalStudents: number;
  totalTeachers: number;
  /** Seats on the current plan. */
  tenantLimit: number;
}

/**
 * What one person wants to hear about, inside one school.
 */
export interface NotificationPreferences {
  inAppNotifications: boolean;
  emailNotifications: boolean;
  classAnnouncements: boolean;
}

/**
 * A school's own academic calendar — the year, its terms and its timetable.
 * Each school keeps its own, so nothing here is assumed.
 */
export interface SchoolCalendar {
  academicYear: {
    name: string;
    startDate: string;
    endDate: string;
    status: string;
  } | null;
  terms: {
    label: string;
    startDate: string;
    endDate: string;
    position: number;
  }[];
  periods: {
    period: number;
    startTime: string;
    endTime: string;
    label: string;
  }[];
  /** The gaps between the periods, worked out from the times. */
  breaks: string;
}

/* ---------- Platform access ---------- */

/** The staff roles a Super Admin can assign. Students come from a roster. */
export const STAFF_ROLES = ["SCHOOL_ADMIN", "TEACHER"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/** One person's staff access to one school. A membership is this pair. */
export interface PlatformAdmin {
  userId: string;
  tenantId: string;
  name: string;
  email: string;
  role: StaffRole;
  status: "ACTIVE" | "INACTIVE";
  schoolId: string;
  schoolName: string;
  schoolSlug: string;
}

/** The create response, with the one-time password when the account is new. */
export interface CreatedPlatformAdmin extends PlatformAdmin {
  temporaryPassword: string | null;
  /** True when the invite email with the temporary password went out. */
  emailSent: boolean;
  /** Why the email did not go out. Null when it did, or when there was none to send. */
  emailError?: string | null;
}

/* ---------- People inside a school ---------- */

export const GENDERS = ["FEMALE", "MALE", "OTHER"] as const;
export type Gender = (typeof GENDERS)[number];

export interface Student {
  id: string;
  name: string;
  email: string;
  admissionNo: string;
  className: string;
  status: "ACTIVE" | "INACTIVE";
  // CRUD/API fields
  firstName?: string;
  lastName?: string;
  classId?: string | null;
  sectionId?: string | null;
  sectionName?: string | null;
  academicYearId?: string | null;
  dateOfBirth?: string | null;
  createdAt?: string;
  enrolmentStatus?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;

  // Fields the API may not have a column behind yet — they come back empty
  // rather than being invented.
  grade?: string;
  section?: string;
  gender?: Gender;
  phone?: string | null;
  address?: string;
  bloodGroup?: string;
  parentId?: string | null;
  admittedOn?: string;
}

export interface Teacher {
  id: string;
  name: string;
  email: string;
  /** Primary subject, for compact table cells. subjectIds is the full list. */
  subject: string;
  employeeNo: string;
  phone: string;
  qualification: string;
  designation: string;
  joinedOn: string;
  subjectIds: string[];
  /** Classes this teacher teaches or is homeroom of. */
  classIds: string[];
  /** Membership state in this school. A deactivated teacher keeps their row. */
  status: "ACTIVE" | "INACTIVE";
  userId?: string | null;
}

export interface Parent {
  id: string;
  name: string;
  email: string;
  phone: string;
  occupation: string;
  /** A parent with two children in the school has two entries here. */
  studentIds: string[];
}

/* ---------- Academic structure ---------- */

export interface Subject {
  id: string;
  name: string;
  /** Short code used in timetables and report cards, e.g. "PHY". */
  code: string;
  classId: string;
  className: string;
  teacherCount: number;
}

export interface AcademicTerm {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  position: number;
}

export interface AcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "UPCOMING" | "ACTIVE" | "COMPLETED";
  classCount: number;
  studentCount: number;
  terms: AcademicTerm[];
}

export interface TimetablePeriod {
  id: string;
  period: number;
  startTime: string;
  endTime: string;
  label: string | null;
}

/** A teacher being responsible for one subject in one section. */
export interface TeachingAssignment {
  id: string;
  teacherId: string;
  teacherName: string;
  sectionId: string;
  classId: string;
  sectionName: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
}

/** A section of a grade — "Grade 10 · A" is one class, not the whole grade. */
export interface SchoolClass {
  /** The section id (or the class id when the class has no sections yet). */
  id: string;
  /** The parent class, for filters that span all of its sections. */
  classId?: string;
  name: string;
  grade: string;
  section: string;
  room: string;
  /** The teacher responsible for this class. Null while the post is vacant. */
  homeroomTeacherId: string | null;
  homeroomTeacherName?: string | null;
  subjectIds: string[];
  studentCount: number;
  capacity: number;
  academicYearId?: string;
  academicYear?: { id: string; name: string; status: string };
  sectionCount?: number;
}

export const WEEKDAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const PERIODS = 6;

export interface TimetableSlot {
  id: string;
  classId: string;
  day: Weekday;
  /** 1-based period within the day. */
  period: number;
  subjectId: string;
  teacherId: string;
}

/* ---------- Attendance ---------- */

export const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export interface AttendanceRecord {
  id: string;
  /** ISO date, no time — attendance is per school day. */
  date: string;
  classId: string;
  studentId: string;
  status: AttendanceStatus;
  markedByTeacherId: string | null;
  markedAt: string | null;
}

/** One class on one day. */
export interface AttendanceSummary {
  classId: string;
  className: string;
  date: string;
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  /** 0-100. Late counts as attended. */
  percentage: number;
}

/** An attendance record joined with the names a table needs. */
export interface AttendanceRecordRow extends AttendanceRecord {
  studentName: string;
  className: string;
}

/** One student's own history, used on their profile and by their parent. */
export interface StudentAttendance {
  studentId: string;
  records: AttendanceRecordRow[];
  summary: {
    total: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    percentage: number;
  };
}

/** One point per school day, for the dashboard chart. */
export interface AttendanceTrendPoint {
  date: string;
  percentage: number;
  marked: number;
}

/* ---------- Exams & grades ---------- */

export const EXAM_STATUSES = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export type ExamStatus = (typeof EXAM_STATUSES)[number];

export interface Exam {
  id: string;
  name: string;
  term: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  date: string;
  maxMarks: number;
  passMarks: number;
  status: ExamStatus;
  /** Set once results are released. */
  publishedAt: string | null;
  subjectName?: string;
  sectionId?: string;
  sectionName?: string;
  className?: string;
  /** How many students already have a mark. */
  markedCount?: number;
  studentCount?: number;
}

/** Percentage at or above which a grade is awarded. Ordered high to low. */
export const GRADE_BANDS = [
  { grade: "A+", min: 90, points: 5 },
  { grade: "A", min: 80, points: 4.5 },
  { grade: "B+", min: 70, points: 4 },
  { grade: "B", min: 60, points: 3.5 },
  { grade: "C", min: 50, points: 3 },
  { grade: "D", min: 40, points: 2 },
  { grade: "E", min: 0, points: 1 },
] as const;

export type Grade = (typeof GRADE_BANDS)[number]["grade"];

export interface ExamResult {
  id: string;
  examId: string;
  studentId: string;
  /** Null while the paper is still being marked. */
  marksObtained: number | null;
  grade: Grade | null;
  remarks: string | null;
  studentName?: string;
  admissionNo?: string;
}

/** One published exam in a student's own results list. */
export interface MyExamResult {
  examId: string;
  examName: string;
  subjectId: string;
  subjectName: string;
  className: string;
  term: string;
  date: string;
  maxMarks: number;
  passMarks: number;
  marksObtained: number | null;
  percentage: number | null;
  grade: Grade | null;
  remarks: string | null;
  publishedAt: string | null;
}

export interface MyResults {
  student: { id: string; name: string; admissionNo: string } | null;
  results: MyExamResult[];
}

export interface ReportCardRow {
  examId: string;
  subjectId: string;
  subjectName: string;
  examName: string;
  date: string;
  maxMarks: number;
  marksObtained: number | null;
  grade: Grade | null;
}

/** Everything one parent sees when they open their child's report. */
export interface ReportCard {
  studentId: string;
  studentName: string;
  admissionNo: string;
  className: string;
  term: string;
  rows: ReportCardRow[];
  totalMarks: number;
  maxTotal: number;
  percentage: number;
  overallGrade: Grade | null;
  attendancePercentage: number;
  /** Position in the whole school and in the class, for the published term. */
  rank: number | null;
  classRank: number | null;
  totalStudents: number;
}

/* ---------- Announcements ---------- */

export const ANNOUNCEMENT_AUDIENCES = [
  "EVERYONE",
  "STAFF",
  "TEACHERS",
  "STUDENTS",
  "PARENTS",
] as const;
export type AnnouncementAudience = (typeof ANNOUNCEMENT_AUDIENCES)[number];

export const ANNOUNCEMENT_PRIORITIES = ["NORMAL", "IMPORTANT", "URGENT"] as const;
export type AnnouncementPriority = (typeof ANNOUNCEMENT_PRIORITIES)[number];

export interface AnnouncementAttachment {
  name: string;
  sizeKb: number;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: AnnouncementAudience[];
  priority: AnnouncementPriority;
  pinned: boolean;
  authorId: string;
  authorName: string;
  authorRole: Role;
  publishedAt: string;
  /** Set for notices about a dated event, e.g. the sports day. */
  eventDate: string | null;
  attachments: AnnouncementAttachment[];
  readCount: number;
}

/* ---------- Fees ---------- */

export const FEE_STATUSES = ["PAID", "PARTIAL", "PENDING", "OVERDUE"] as const;
export type FeeStatus = (typeof FEE_STATUSES)[number];

export const FEE_TYPES = ["Tuition", "Transport", "Examination", "Lab", "Library"] as const;
export type FeeType = (typeof FEE_TYPES)[number];

export interface FeeInvoice {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  term: string;
  feeType: FeeType;
  amount: number;
  amountPaid: number;
  dueDate: string;
  status: FeeStatus;
  paidAt: string | null;
}

export interface FeeSummary {
  totalBilled: number;
  totalCollected: number;
  outstanding: number;
  overdueAmount: number;
  overdueCount: number;
  /** Collected / billed, 0-100. */
  collectionRate: number;
}

/* ---------- Who am I inside this school ---------- */

/**
 * Resolves a signed-in account against one tenant. The real backend derives this
 * from the session cookie; the screens use it to decide whose records to show.
 */
export interface SchoolIdentity {
  role: Role;
  /** Set when the account signs in as a student. */
  student: Student | null;
  /** Set when the account signs in as a guardian — one entry per child. */
  children: Student[];
  /** Set when the account signs in as a teacher. */
  teacher: Teacher | null;
}

/* ---------- Dashboard roll-up ---------- */

export interface SchoolDashboard {
  schoolSlug: string;
  studentCount: number;
  teacherCount: number;
  classCount: number;
  parentCount: number;
  attendanceToday: { date: string; percentage: number; marked: number; total: number };
  fees: FeeSummary;
  upcomingExams: Exam[];
  latestAnnouncements: Announcement[];
  recentExams: Exam[];
}

/* ---------- Assignments ---------- */

export const ASSIGNMENT_STATUSES = ["DRAFT", "OPEN", "CLOSED"] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const SUBMISSION_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "SUBMITTED",
  "LATE",
  "GRADED",
] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export interface Assignment {
  id: string;
  title: string;
  description: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  /** ISO date the task was set. */
  assignedOn: string;
  dueDate: string;
  maxMarks: number;
  status: AssignmentStatus;
  attachments: AnnouncementAttachment[];
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  status: SubmissionStatus;
  submittedAt: string | null;
  marksObtained: number | null;
  feedback: string | null;
}

/** A submission joined to the student it belongs to, for the marking table. */
export interface AssignmentSubmissionRow extends AssignmentSubmission {
  studentName: string;
  admissionNo: string;
}

export interface AssignmentStats {
  total: number;
  notStarted: number;
  inProgress: number;
  submitted: number;
  late: number;
  graded: number;
  /** Handed in on or before the due date, out of everyone expected to submit. */
  onTimeRate: number;
  /** Mean of the graded submissions as a percentage, or null if none graded. */
  averageMarks: number | null;
}

/** One assignment with everything the detail view needs. */
export interface AssignmentDetail {
  assignment: Assignment & {
    className: string;
    subjectName: string;
    teacherName: string;
    /** Days left, negative once it has passed. */
    daysLeft: number;
  };
  submissions: AssignmentSubmissionRow[];
  stats: AssignmentStats;
}

/**
 * An assignment as a list row: the names a table needs, how far the deadline is,
 * how the class as a whole is doing, and the caller's own state of it.
 */
export interface AssignmentListRow extends Assignment {
  className: string;
  subjectName: string;
  subjectCode: string;
  teacherName: string;
  /** Days left, negative once the due date has passed. */
  daysLeft: number;
  stats: AssignmentStats;
  /** The signed-in student's own submission, or null if they have none. */
  mine: AssignmentSubmission | null;
}

/* ---------- Shared list response ---------- */

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}