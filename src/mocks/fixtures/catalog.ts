/**
 * The raw material every fixture is built from.
 *
 * Keeping the pools separate from the builders means a fixture reads as "pick a
 * name, pick a street" rather than as a wall of literals, and it keeps the
 * generated data varied without making it unreadable.
 */

import type { AnnouncementAudience, AnnouncementPriority, FeeType, Weekday } from "@/types";

/* ---------- People ---------- */

export const FIRST_NAMES = [
  "Sara", "Ravi", "Anya", "Kabir", "Meera", "Jon", "Priya", "Omar", "Lena", "Dev",
  "Zoya", "Kim", "Aisha", "Rohan", "Neha", "Imran", "Fatima", "Arjun", "Ishita", "Vihaan",
  "Tanvi", "Aditya", "Sana", "Karan", "Riya", "Nikhil", "Pooja", "Rahul", "Sneha", "Vikram",
  "Anjali", "Kunal", "Divya", "Sameer", "Trisha", "Manav", "Kavya", "Rohit", "Nisha", "Abhay",
  "Leena", "Harsh", "Amrita", "Yash", "Neel", "Shruti", "Farhan", "Meenal",
] as const;

export const LAST_NAMES = [
  "Khan", "Menon", "Dsouza", "Shah", "Iyer", "Bell", "Nair", "Farid", "Ortiz", "Patel",
  "Ali", "Nakamura", "Rao", "Joshi", "Chowdhury", "Fernandes", "Gupta", "Malhotra", "Banerjee", "Pillai",
  "Hegde", "Sinha", "Bhatt", "Varma", "Reddy", "Deshmukh", "Kamath", "Bhandari", "Yadav", "Mathew",
  "Qureshi", "Sobti", "Naik", "Prasad", "Kaur", "Sen", "Dutta", "Chauhan", "Talwar", "Mistry",
  "Zhao", "Lindqvist", "Okafor", "Kowalski", "Rossi", "Haddad", "Balogun", "Watanabe",
] as const;

/**
 * Names the demo accounts depend on. Pinned into the first class of Greenwood so
 * that `student@greenwood.edu` really is the student you see in the roster.
 */
export const RESERVED_STUDENT_NAMES = [
  "Sara Khan", "Ravi Menon", "Anya Dsouza", "Kabir Shah", "Meera Iyer",
  "Jon Bell", "Priya Nair", "Omar Farid", "Lena Ortiz",
] as const;

export const RESERVED_TEACHER_NAMES = [
  "Tom Iyer", "Grace Lee", "Nadia Roy",
] as const;

export const QUALIFICATIONS = [
  "M.Sc", "B.Sc", "M.Ed", "B.Ed", "Ph.D", "M.A", "B.Tech", "M.Com",
] as const;

export const DESIGNATIONS = [
  "Head of Department", "Senior Teacher", "Post Graduate Teacher", "Trained Graduate Teacher",
] as const;

export const OCCUPATIONS = [
  "Engineer", "Doctor", "Accountant", "Architect", "Business owner",
  "Teacher", "Lawyer", "Consultant", "Bank officer", "Designer",
] as const;

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"] as const;

export const AREAS = [
  "Bandra West", "Andheri East", "Powai", "Chembur", "Koramangala",
  "Salt Lake", "Vashi", "Whitefield", "Juhu", "Malad",
] as const;

export const STREETS = [
  "MG Road", "Lake View Road", "Park Street", "Hill Road",
  "Residency Road", "Station Road", "Nehru Nagar",
] as const;

/* ---------- Academics ---------- */

interface SubjectSeed {
  name: string;
  code: string;
  /** Empty means every grade. */
  grades: readonly string[];
  maxMarks: number;
}

export const SUBJECT_CATALOGUE: readonly SubjectSeed[] = [
  { name: "English", code: "ENG", grades: [], maxMarks: 80 },
  { name: "Mathematics", code: "MAT", grades: [], maxMarks: 80 },
  { name: "Physics", code: "PHY", grades: ["Grade 11", "Grade 12"], maxMarks: 70 },
  { name: "Chemistry", code: "CHE", grades: ["Grade 11", "Grade 12"], maxMarks: 70 },
  { name: "Biology", code: "BIO", grades: ["Grade 11", "Grade 12"], maxMarks: 70 },
  { name: "History", code: "HIS", grades: [], maxMarks: 80 },
  { name: "Geography", code: "GEO", grades: [], maxMarks: 80 },
  { name: "Computer Science", code: "CSP", grades: ["Grade 10", "Grade 11", "Grade 12"], maxMarks: 60 },
  { name: "Economics", code: "ECO", grades: ["Grade 11", "Grade 12"], maxMarks: 80 },
  { name: "Physical Education", code: "PE", grades: [], maxMarks: 40 },
];

/** Subjects offered to a grade, in a stable order. */
export function subjectsForGrade(grade: string): SubjectSeed[] {
  return SUBJECT_CATALOGUE.filter((subject) => subject.grades.length === 0 || subject.grades.includes(grade));
}

export const ROOMS = [
  "A-101", "A-102", "A-103", "B-201", "B-202", "B-203", "C-301", "C-302",
  "Lab 1", "Lab 2", "Sports Hall",
] as const;

/**
 * Exam sessions, positioned relative to today so the demo always shows a mix of
 * published results, an exam just finished, and ones still to come.
 */
export interface ExamSession {
  name: string;
  term: string;
  /** Days from today. Negative is in the past. */
  offset: number;
  status: "SCHEDULED" | "IN_PROGRESS" | "PUBLISHED";
}

export const EXAM_SESSIONS: readonly ExamSession[] = [
  { name: "Unit Test 1", term: "Term 1", offset: -150, status: "PUBLISHED" },
  { name: "Mid-Term Examination", term: "Term 1", offset: -95, status: "PUBLISHED" },
  { name: "Unit Test 2", term: "Term 2", offset: -45, status: "PUBLISHED" },
  { name: "Mid-Term Examination", term: "Term 2", offset: -14, status: "PUBLISHED" },
  // Sits today, so its results are half marked — the "not graded yet" state.
  { name: "Practical Assessment", term: "Term 2", offset: 0, status: "IN_PROGRESS" },
  { name: "Pre-Board Examination", term: "Term 2", offset: 30, status: "SCHEDULED" },
  { name: "Final Examination", term: "Term 3", offset: 75, status: "SCHEDULED" },
];

export const TERMS = ["Term 1", "Term 2", "Term 3"] as const;

export const SCHOOL_DAYS: readonly Weekday[] = [
  "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY",
];

/* ---------- Money ---------- */

export const FEE_TYPES: readonly FeeType[] = ["Tuition", "Transport", "Examination", "Lab", "Library"];

export const TUITION_BY_GRADE: Record<string, number> = {
  "Grade 8": 18_000,
  "Grade 9": 20_000,
  "Grade 10": 22_000,
  "Grade 11": 26_000,
  "Grade 12": 28_000,
};

/* ---------- Announcements ---------- */

export interface AnnouncementSeed {
  title: string;
  body: string;
  audience: readonly AnnouncementAudience[];
  priority: AnnouncementPriority;
  pinned?: boolean;
  /** Days from today. */
  offset: number;
  hour?: number;
  eventOffset?: number;
  attachment?: { name: string; sizeKb: number };
}

export const ANNOUNCEMENT_SEEDS: readonly AnnouncementSeed[] = [
  {
    title: "Annual Sports Day — 12 November",
    body:
      "House trials run through the morning break for the rest of this week. Parents are welcome from 9am at the Sports Hall; children should bring their house colours and a water bottle.",
    audience: ["EVERYONE"],
    priority: "IMPORTANT",
    pinned: true,
    offset: -1,
    hour: 8,
    eventOffset: 30,
    attachment: { name: "sports-day-schedule.pdf", sizeKb: 184 },
  },
  {
    title: "Term 2 fee reminders",
    body:
      "Term 2 invoices were issued on Monday. The last date to pay without a late charge is the end of the month. Please get in touch with the accounts office if you need an instalment plan.",
    audience: ["PARENTS"],
    priority: "URGENT",
    pinned: true,
    offset: -2,
    hour: 17,
  },
  {
    title: "Science fair registrations close Friday",
    body:
      "Grade 9 to 12 teams should submit their topic and a one-paragraph abstract to their homeroom teacher. Working in teams of up to three is fine; marks are for the science, not the glue.",
    audience: ["STUDENTS", "PARENTS"],
    priority: "NORMAL",
    offset: -3,
    hour: 10,
    eventOffset: 7,
  },
  {
    title: "Staff meeting — new reporting format",
    body:
      "Half an hour on the updated report card layout in the main hall. Attendance marking moves to the tablet in the register room; please do not keep paper registers this term.",
    audience: ["STAFF"],
    priority: "NORMAL",
    offset: -4,
    hour: 16,
    eventOffset: 2,
  },
  {
    title: "Library week: extended hours",
    body:
      "The library stays open until 6pm all week. Two new shelves arrived on fiction and one on exam preparation.",
    audience: ["STUDENTS", "PARENTS"],
    priority: "NORMAL",
    offset: -6,
    hour: 12,
  },
  {
    title: "Mid-Term examination schedule published",
    body:
      "The date sheet is on the notice board and in your child's section. Examinations run for six working days starting on the date shown. Hall tickets go home the Friday before.",
    audience: ["STUDENTS", "PARENTS"],
    priority: "IMPORTANT",
    offset: -9,
    hour: 9,
    eventOffset: 5,
    attachment: { name: "term-2-date-sheet.pdf", sizeKb: 96 },
  },
  {
    title: "Bus route 4 change — north loop",
    body:
      "From Monday the north loop picks up three streets earlier so that students reach school before the first bell. The pickup times are printed on the buses.",
    audience: ["PARENTS", "STAFF"],
    priority: "NORMAL",
    offset: -12,
    hour: 15,
  },
  {
    title: "Inter-house chess results",
    body:
      "Chess finished with Health narrowly ahead of Knowledge. Full standings are on the sports board; thanks to everyone who came to watch.",
    audience: ["EVERYONE"],
    priority: "NORMAL",
    offset: -15,
    hour: 11,
  },
  {
    title: "Reminder: medical forms for the sports day",
    body:
      "Anyone taking part in the trials must have the medical form signed at home and returned to their homeroom teacher. It is a two-minute form and it is genuinely required.",
    audience: ["PARENTS"],
    priority: "URGENT",
    offset: -17,
    hour: 17,
  },
  {
    title: "New attendance policy from next term",
    body:
      "A student marked absent for more than five days in a term will be asked for an explanation from a parent or guardian. Absences recorded as excused do not count towards this.",
    audience: ["EVERYONE"],
    priority: "IMPORTANT",
    offset: -21,
    hour: 10,
  },
  {
    title: "Robotics club recruitment",
    body:
      "We are running the regional qualifier again this year. No prior experience needed — the first six weeks are all building. Sign up in the maker space at lunch.",
    audience: ["STUDENTS"],
    priority: "NORMAL",
    offset: -24,
    hour: 13,
    eventOffset: 10,
  },
  {
    title: "Parent–teacher meetings: booking opens",
    body:
      "Ten minute slots, booked through the portal. If the times on offer do not suit, email the class teacher and we will find something.",
    audience: ["PARENTS"],
    priority: "NORMAL",
    offset: -28,
    hour: 9,
  },
  {
    title: "Water supply interruption, east wing",
    body:
      "The east wing will have no water between 10am and 1pm. Please refill before the first break; the ground floor fountains will stay on.",
    audience: ["STAFF", "STUDENTS"],
    priority: "IMPORTANT",
    offset: -31,
    hour: 8,
  },
  {
    title: "Term 1 results are now available",
    body:
      "Term 1 results and the class rank lists have been released. Students can see their own result on the portal; parents should use the link in the message we sent.",
    audience: ["EVERYONE"],
    priority: "IMPORTANT",
    offset: -38,
    hour: 14,
    attachment: { name: "term-1-result-summary.pdf", sizeKb: 241 },
  },
];