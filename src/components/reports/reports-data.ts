/**
 * Strongly-typed data models and mock records for School Admin Reports.
 * Designed for effortless future backend API integration.
 */

export interface ExamScheduleItem {
  id: string;
  dateBadge: string;
  datePillColor?: string;
  statusBadge: string;
  statusTone: "green" | "blue" | "neutral" | "amber";
  title: string;
  subtitle: string;
  timeRange: string;
  enrolledCount: number;
}

export interface GradeDistributionItem {
  grade: string;
  percentage: number;
  studentCount: number;
  barColor: string;
}

export interface DeansDigestData {
  title: string;
  subtitle: string;
  content: string;
  boardPassForecast: number;
  interventionCaseload: number;
}

export interface StudentLedgerRecord {
  id: string;
  name: string;
  rollNo: string;
  studentId: string;
  avatarInitials: string;
  avatarBgColor: string;
  className: string;
  grade: string;
  section: string;
  term1Final: number;
  t2MidTerm: number;
  labProject: string; // e.g. "24.5/25"
  totalScore: number;
  letterGrade: "A+" | "A" | "B+" | "B" | "C" | "D";
  attendance: number;
  reportCardStatus: "GENERATED" | "PENDING_REVIEW" | "NEEDS_SIGNOFF";
}

export interface ReportsSummaryMetrics {
  activeCycle: {
    term: string;
    kickoffText: string;
    scheduledDays: number;
  };
  ledgerSubmission: {
    completedSections: number;
    totalSections: number;
    percentComplete: number;
    pendingCount: number;
  };
  schoolAverage: {
    cumulativeScore: number;
    trendDelta: number;
    trendLabel: string;
  };
  honorCohort: {
    title: string;
    subtitle: string;
    score: number;
    scholarsCount: number;
  };
}

/* ------------------------------------------------------------------ *
 * Default Mock Data 
 * ------------------------------------------------------------------ */

export const INITIAL_SUMMARY_METRICS: ReportsSummaryMetrics = {
  activeCycle: {
    term: "Term 2",
    kickoffText: "Mid-Term Assessments kick off 26 Oct 2026",
    scheduledDays: 14,
  },
  ledgerSubmission: {
    completedSections: 28,
    totalSections: 42,
    percentComplete: 66.7,
    pendingCount: 14,
  },
  schoolAverage: {
    cumulativeScore: 84.6,
    trendDelta: 3.1,
    trendLabel: "+3.1% vs Term 1 ledger",
  },
  honorCohort: {
    title: "Grade 6 Overall",
    subtitle: "Top performing standard this cycle",
    score: 88.2,
    scholarsCount: 312,
  },
};

export const INITIAL_EXAM_SCHEDULE: ExamScheduleItem[] = [
  {
    id: "exam-1",
    dateBadge: "26 OCT 2026",
    datePillColor: "bg-slate-900 text-white",
    statusBadge: "Hall Ready",
    statusTone: "green",
    title: "Mathematics",
    subtitle: "Grades 6–10 • Papers I & II",
    timeRange: "09:00 AM – 11:30 AM",
    enrolledCount: 420,
  },
  {
    id: "exam-2",
    dateBadge: "28 OCT 2026",
    datePillColor: "bg-sky-950 text-white",
    statusBadge: "Lab Booked",
    statusTone: "green",
    title: "Science & Lab Practical",
    subtitle: "Grades 6–10 • Physics / Bio Wet Lab",
    timeRange: "09:00 AM – 11:30 AM",
    enrolledCount: 388,
  },
  {
    id: "exam-3",
    dateBadge: "30 OCT 2026",
    datePillColor: "bg-indigo-950 text-white",
    statusBadge: "Invigilation Set",
    statusTone: "blue",
    title: "English Literature",
    subtitle: "Language, Essay & Applied Reading",
    timeRange: "09:00 AM – 11:30 AM",
    enrolledCount: 435,
  },
  {
    id: "exam-4",
    dateBadge: "02 NOV 2026",
    datePillColor: "bg-slate-800 text-white",
    statusBadge: "Standard Format",
    statusTone: "neutral",
    title: "Social Sciences & Civics",
    subtitle: "History, World Geography & Polity",
    timeRange: "09:00 AM – 11:30 AM",
    enrolledCount: 410,
  },
];

export const INITIAL_GRADE_DISTRIBUTION: GradeDistributionItem[] = [
  {
    grade: "A+",
    percentage: 24,
    studentCount: 202,
    barColor: "bg-[#0f382c]", // Deep forest
  },
  {
    grade: "A",
    percentage: 38,
    studentCount: 319,
    barColor: "bg-[#047857]", // Emerald strong
  },
  {
    grade: "B+",
    percentage: 22,
    studentCount: 185,
    barColor: "bg-[#059669]", // Emerald accent
  },
  {
    grade: "B",
    percentage: 12,
    studentCount: 101,
    barColor: "bg-[#94a3b8]", // Slate light
  },
  {
    grade: "C",
    percentage: 4,
    studentCount: 33,
    barColor: "bg-[#fb923c]", // Muted orange
  },
];

export const INITIAL_DEANS_DIGEST: DeansDigestData = {
  title: "DEAN'S ACADEMIC DIGEST",
  subtitle: "Strong STEM Uptick",
  content:
    "Mathematics and Physics practicals recorded the lowest variance across all 8 class sections. Grade 6 Section A attained a flawless 98.4% lab notebook submission benchmark before the cut-off date.",
  boardPassForecast: 99.2,
  interventionCaseload: 12,
};

export const INITIAL_STUDENTS_LEDGER: StudentLedgerRecord[] = [
  {
    id: "std-1",
    name: "Aarav Sharma",
    rollNo: "06-A-01",
    studentId: "GPS-8821",
    avatarInitials: "AS",
    avatarBgColor: "bg-teal-100 text-teal-800",
    className: "6 - A",
    grade: "Grade 6",
    section: "Section A (Emerald)",
    term1Final: 94.0,
    t2MidTerm: 96.5,
    labProject: "24.5/25",
    totalScore: 95.8,
    letterGrade: "A+",
    attendance: 98.5,
    reportCardStatus: "GENERATED",
  },
  {
    id: "std-2",
    name: "Ananya Patel",
    rollNo: "06-A-02",
    studentId: "GPS-8822",
    avatarInitials: "AP",
    avatarBgColor: "bg-sky-100 text-sky-800",
    className: "6 - A",
    grade: "Grade 6",
    section: "Section A (Emerald)",
    term1Final: 88.5,
    t2MidTerm: 91.0,
    labProject: "23.0/25",
    totalScore: 89.8,
    letterGrade: "A",
    attendance: 96.0,
    reportCardStatus: "GENERATED",
  },
  {
    id: "std-3",
    name: "Devansh Lodhi",
    rollNo: "06-A-03",
    studentId: "GPS-8823",
    avatarInitials: "DL",
    avatarBgColor: "bg-indigo-100 text-indigo-800",
    className: "6 - A",
    grade: "Grade 6",
    section: "Section A (Emerald)",
    term1Final: 76.0,
    t2MidTerm: 82.5,
    labProject: "20.5/25",
    totalScore: 79.2,
    letterGrade: "B+",
    attendance: 91.2,
    reportCardStatus: "PENDING_REVIEW",
  },
  {
    id: "std-4",
    name: "Meera Chowdhury",
    rollNo: "06-A-04",
    studentId: "GPS-8824",
    avatarInitials: "MC",
    avatarBgColor: "bg-emerald-100 text-emerald-800",
    className: "6 - A",
    grade: "Grade 6",
    section: "Section A (Emerald)",
    term1Final: 92.0,
    t2MidTerm: 95.0,
    labProject: "24.0/25",
    totalScore: 93.5,
    letterGrade: "A+",
    attendance: 99.0,
    reportCardStatus: "GENERATED",
  },
  {
    id: "std-5",
    name: "Rohan Roy",
    rollNo: "06-A-05",
    studentId: "GPS-8825",
    avatarInitials: "RR",
    avatarBgColor: "bg-slate-200 text-slate-800",
    className: "6 - A",
    grade: "Grade 6",
    section: "Section A (Emerald)",
    term1Final: 68.0,
    t2MidTerm: 71.0,
    labProject: "18.0/25",
    totalScore: 69.5,
    letterGrade: "B",
    attendance: 88.0,
    reportCardStatus: "NEEDS_SIGNOFF",
  },
  {
    id: "std-6",
    name: "Kavya Nair",
    rollNo: "06-A-06",
    studentId: "GPS-8826",
    avatarInitials: "KN",
    avatarBgColor: "bg-purple-100 text-purple-800",
    className: "6 - A",
    grade: "Grade 6",
    section: "Section A (Emerald)",
    term1Final: 91.5,
    t2MidTerm: 93.0,
    labProject: "23.5/25",
    totalScore: 92.4,
    letterGrade: "A+",
    attendance: 97.5,
    reportCardStatus: "GENERATED",
  },
  {
    id: "std-7",
    name: "Ishaan Gupta",
    rollNo: "06-A-07",
    studentId: "GPS-8827",
    avatarInitials: "IG",
    avatarBgColor: "bg-amber-100 text-amber-800",
    className: "6 - A",
    grade: "Grade 6",
    section: "Section A (Emerald)",
    term1Final: 84.0,
    t2MidTerm: 87.5,
    labProject: "21.5/25",
    totalScore: 85.8,
    letterGrade: "A",
    attendance: 94.0,
    reportCardStatus: "GENERATED",
  },
];

export const GRADE_FILTER_OPTIONS = [
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
];

export const SECTION_FILTER_OPTIONS = [
  "Section A (Emerald)",
  "Section B (Sapphire)",
  "Section C (Ruby)",
  "Section D (Diamond)",
];

export const SUBJECT_FILTER_OPTIONS = [
  "All Subjects (Composite Ledger)",
  "Mathematics",
  "Science & Lab Practical",
  "English Literature",
  "Social Sciences & Civics",
  "Second Language",
];
