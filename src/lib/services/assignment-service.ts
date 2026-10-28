import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import type {
  Assignment,
  AssignmentDetail,
  AssignmentListRow,
  AssignmentStats,
  AssignmentSubmission,
  AssignmentSubmissionRow,
  SubmissionStatus,
} from "@/types";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "assignments.json");

interface StoredData {
  assignments: Record<string, Assignment[]>;
  submissions: Record<string, AssignmentSubmission[]>;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch {
      // directory might already exist
    }
  }
}

function loadData(): StoredData {
  ensureDataDir();
  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      return JSON.parse(raw);
    } catch {
      // ignore
    }
  }
  return { assignments: {}, submissions: {} };
}

function saveData(data: StoredData) {
  ensureDataDir();
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to persist assignments data:", err);
  }
}

const memoryStore: StoredData = loadData();

function getStore(): StoredData {
  return memoryStore;
}

function updateStore(fn: (data: StoredData) => void) {
  fn(memoryStore);
  saveData(memoryStore);
}

/** Computes days remaining until the due date (negative if past) */
export function calculateDaysLeft(dueDateString: string): number {
  const due = new Date(`${dueDateString}T23:59:59`);
  const now = new Date();
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/** Calculates summary statistics for a set of submissions */
export function calculateStats(submissions: AssignmentSubmission[]): AssignmentStats {
  const total = submissions.length;
  let notStarted = 0;
  let inProgress = 0;
  let submitted = 0;
  let late = 0;
  let graded = 0;
  let totalScore = 0;
  let scoredCount = 0;

  for (const sub of submissions) {
    switch (sub.status) {
      case "NOT_STARTED":
        notStarted++;
        break;
      case "IN_PROGRESS":
        inProgress++;
        break;
      case "SUBMITTED":
        submitted++;
        break;
      case "LATE":
        late++;
        break;
      case "GRADED":
        graded++;
        if (sub.marksObtained !== null && sub.marksObtained !== undefined) {
          totalScore += sub.marksObtained;
          scoredCount++;
        }
        break;
    }
  }

  const onTimeCount = submitted + graded;
  const onTimeRate = total > 0 ? Math.round((onTimeCount / total) * 100) : 0;
  const averageMarks = scoredCount > 0 ? Math.round((totalScore / scoredCount) * 10) / 10 : null;

  return {
    total,
    notStarted,
    inProgress,
    submitted,
    late,
    graded,
    onTimeRate,
    averageMarks,
  };
}

export interface ListAssignmentsQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  classId?: string;
  subjectId?: string;
  mine?: boolean;
  email?: string;
}

/** Lists assignments with filtering, stats, and student-specific status */
export async function listAssignments(
  tenantSlug: string,
  tenantId: string | undefined,
  query: ListAssignmentsQuery = {},
) {
  const store = getStore();
  const assignments = store.assignments[tenantSlug] ?? [];
  const submissions = store.submissions[tenantSlug] ?? [];

  let classesMap: Record<string, string> = {};
  let subjectsMap: Record<string, { name: string; code: string }> = {};
  let teachersMap: Record<string, string> = {};
  let studentByEmail: { id: string } | null = null;

  if (tenantId) {
    try {
      const [dbClasses, dbSubjects, dbTeachers] = await Promise.all([
        prisma.schoolClass.findMany({ where: { tenantId }, select: { id: true, name: true } }),
        prisma.subject.findMany({ where: { tenantId }, select: { id: true, name: true, code: true } }),
        prisma.teacher.findMany({ where: { tenantId }, select: { id: true, firstName: true, lastName: true } }),
      ]);
      classesMap = Object.fromEntries(dbClasses.map((c) => [c.id, c.name]));
      subjectsMap = Object.fromEntries(
        dbSubjects.map((s) => [s.id, { name: s.name, code: s.code || "SUB" }]),
      );
      teachersMap = Object.fromEntries(dbTeachers.map((t) => [t.id, `${t.firstName} ${t.lastName}`]));

      if (query.email) {
        studentByEmail = await prisma.student.findFirst({
          where: { tenantId, user: { email: query.email.toLowerCase() } },
          select: { id: true },
        });
      }
    } catch {
      // DB access fallback
    }
  }

  const s = query.search?.toLowerCase().trim();
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.max(1, Number(query.pageSize) || 10);

  const rows: AssignmentListRow[] = assignments
    .map((asg) => {
      const className = classesMap[asg.classId] || "";
      const subject = subjectsMap[asg.subjectId] || { name: "", code: "" };
      const teacherName = teachersMap[asg.teacherId] || "";
      const daysLeft = calculateDaysLeft(asg.dueDate);

      const asgSubmissions = submissions.filter((sub) => sub.assignmentId === asg.id);
      const stats = calculateStats(asgSubmissions);

      const mySubmission = studentByEmail
        ? asgSubmissions.find((sub) => sub.studentId === studentByEmail!.id) ?? null
        : null;

      return {
        ...asg,
        className,
        subjectName: subject.name,
        subjectCode: subject.code,
        teacherName,
        daysLeft,
        stats,
        mine: mySubmission,
      };
    })
    .filter((row) => {
      if (s && !row.title.toLowerCase().includes(s) && !row.subjectName.toLowerCase().includes(s)) {
        return false;
      }
      if (query.status && row.status !== query.status) {
        return false;
      }
      if (query.classId && row.classId !== query.classId) {
        return false;
      }
      if (query.subjectId && row.subjectId !== query.subjectId) {
        return false;
      }
      return true;
    });

  const total = rows.length;
  const skip = (page - 1) * pageSize;
  const paginated = rows.slice(skip, skip + pageSize);

  return {
    data: paginated,
    total,
    page,
    pageSize,
  };
}

/** Get assignment details with submission list */
export async function getAssignment(
  tenantSlug: string,
  tenantId: string | undefined,
  assignmentId: string,
): Promise<AssignmentDetail | null> {
  const store = getStore();
  const asg = (store.assignments[tenantSlug] ?? []).find((a) => a.id === assignmentId);
  if (!asg) return null;

  const submissions = (store.submissions[tenantSlug] ?? []).filter((s) => s.assignmentId === assignmentId);
  const stats = calculateStats(submissions);

  let className = "";
  let subjectName = "";
  let teacherName = "";
  let studentsMap: Record<string, { name: string; admissionNo: string }> = {};

  if (tenantId) {
    try {
      const [cls, subj, tch, studs] = await Promise.all([
        prisma.schoolClass.findFirst({ where: { id: asg.classId, tenantId }, select: { name: true } }),
        prisma.subject.findFirst({ where: { id: asg.subjectId, tenantId }, select: { name: true } }),
        prisma.teacher.findFirst({ where: { id: asg.teacherId, tenantId }, select: { firstName: true, lastName: true } }),
        prisma.student.findMany({ where: { tenantId }, select: { id: true, firstName: true, lastName: true, admissionNo: true } }),
      ]);
      if (cls) className = cls.name;
      if (subj) subjectName = subj.name;
      if (tch) teacherName = `${tch.firstName} ${tch.lastName}`;
      studentsMap = Object.fromEntries(
        studs.map((s) => [s.id, { name: `${s.firstName} ${s.lastName}`, admissionNo: s.admissionNo }]),
      );
    } catch {
      // DB fallback
    }
  }

  const submissionRows: AssignmentSubmissionRow[] = submissions.map((sub) => {
    const info = studentsMap[sub.studentId] || { name: "", admissionNo: "" };
    return {
      ...sub,
      studentName: info.name,
      admissionNo: info.admissionNo,
    };
  });

  return {
    assignment: {
      ...asg,
      className,
      subjectName,
      teacherName,
      daysLeft: calculateDaysLeft(asg.dueDate),
    },
    submissions: submissionRows,
    stats,
  };
}

export interface CreateAssignmentInput {
  title: string;
  description: string;
  classId: string;
  subjectId: string;
  dueDate: string;
  maxMarks: number;
}

/** Create a new assignment */
export async function createAssignment(
  tenantSlug: string,
  tenantId: string | undefined,
  input: CreateAssignmentInput,
  authorTeacherId?: string,
): Promise<AssignmentListRow> {
  const id = `${tenantSlug}_asg_${Date.now()}`;
  const now = new Date();
  const assignedOn = now.toISOString().split("T")[0];

  const daysLeft = calculateDaysLeft(input.dueDate);
  const status = daysLeft < 0 ? "CLOSED" : "OPEN";

  const newAssignment: Assignment = {
    id,
    title: input.title.trim(),
    description: input.description.trim(),
    classId: input.classId,
    subjectId: input.subjectId,
    teacherId: authorTeacherId || "",
    assignedOn,
    dueDate: input.dueDate,
    maxMarks: Number(input.maxMarks) || 20,
    status,
    attachments: [],
  };

  const newSubmissions: AssignmentSubmission[] = [];
  if (tenantId) {
    try {
      const students = await prisma.student.findMany({
        where: { tenantId },
        select: { id: true },
      });
      for (const st of students) {
        newSubmissions.push({
          id: `${id}_sub_${st.id}`,
          assignmentId: id,
          studentId: st.id,
          status: "NOT_STARTED",
          submittedAt: null,
          marksObtained: null,
          feedback: null,
        });
      }
    } catch {
      // DB fallback
    }
  }

  updateStore((data) => {
    if (!data.assignments[tenantSlug]) data.assignments[tenantSlug] = [];
    if (!data.submissions[tenantSlug]) data.submissions[tenantSlug] = [];
    data.assignments[tenantSlug].unshift(newAssignment);
    data.submissions[tenantSlug].push(...newSubmissions);
  });

  let className = "";
  let subjectName = "";
  let subjectCode = "";
  let teacherName = "";

  if (tenantId) {
    try {
      const [cls, subj, tch] = await Promise.all([
        prisma.schoolClass.findFirst({ where: { id: input.classId, tenantId }, select: { name: true } }),
        prisma.subject.findFirst({ where: { id: input.subjectId, tenantId }, select: { name: true, code: true } }),
        authorTeacherId
          ? prisma.teacher.findFirst({ where: { id: authorTeacherId, tenantId }, select: { firstName: true, lastName: true } })
          : null,
      ]);
      if (cls) className = cls.name;
      if (subj) {
        subjectName = subj.name;
        subjectCode = subj.code || "SUB";
      }
      if (tch) teacherName = `${tch.firstName} ${tch.lastName}`;
    } catch {
      // DB fallback
    }
  }

  return {
    ...newAssignment,
    className,
    subjectName,
    subjectCode,
    teacherName,
    daysLeft,
    stats: calculateStats(newSubmissions),
    mine: null,
  };
}

/** Record or update submission from student */
export async function submitAssignment(
  tenantSlug: string,
  assignmentId: string,
  studentId: string,
  status: SubmissionStatus = "SUBMITTED",
): Promise<AssignmentSubmission> {
  const store = getStore();
  const submissions = store.submissions[tenantSlug] ?? [];
  let sub = submissions.find((s) => s.assignmentId === assignmentId && s.studentId === studentId);

  const nowIso = new Date().toISOString();

  if (sub) {
    sub.status = status;
    sub.submittedAt = nowIso;
  } else {
    sub = {
      id: `${assignmentId}_sub_${studentId}`,
      assignmentId,
      studentId,
      status,
      submittedAt: nowIso,
      marksObtained: null,
      feedback: null,
    };
    submissions.push(sub);
  }

  updateStore((data) => {
    data.submissions[tenantSlug] = submissions;
  });

  return sub;
}

/** Grade an assignment submission */
export async function gradeSubmission(
  tenantSlug: string,
  assignmentId: string,
  studentId: string,
  marksObtained: number,
  feedback?: string,
): Promise<AssignmentSubmission> {
  const store = getStore();
  const submissions = store.submissions[tenantSlug] ?? [];
  let sub = submissions.find((s) => s.assignmentId === assignmentId && s.studentId === studentId);

  if (!sub) {
    sub = {
      id: `${assignmentId}_sub_${studentId}`,
      assignmentId,
      studentId,
      status: "GRADED",
      submittedAt: new Date().toISOString(),
      marksObtained,
      feedback: feedback || null,
    };
    submissions.push(sub);
  } else {
    sub.status = "GRADED";
    sub.marksObtained = marksObtained;
    if (feedback !== undefined) sub.feedback = feedback;
  }

  updateStore((data) => {
    data.submissions[tenantSlug] = submissions;
  });

  return sub;
}
