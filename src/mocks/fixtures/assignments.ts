/**
 * Homework set by a teacher, and what each student did with it.
 *
 * The submission mix is driven by the due date: a task that closed weeks ago is
 * mostly graded, one closing today is still being worked on, and one closing next
 * week has barely been opened. That makes the three statuses fall out of the
 * calendar rather than being picked at random.
 */

import type { SchoolProfile } from "@/mocks/fixtures/profile";
import {
  TODAY,
  addDays,
  chance,
  createRandom,
  dateKey,
  dateTimeKey,
  hashSeed,
  pick,
  randomInt,
  weighted,
  type Random,
} from "@/mocks/fixtures/random";
import type {
  Assignment,
  AssignmentStatus,
  AssignmentSubmission,
  SchoolClass,
  Student,
  Subject,
  SubmissionStatus,
  Teacher,
} from "@/types";

/** Task wording, loosely keyed to the subject so it reads plausibly. */
const TASK_POOL: Record<string, string[]> = {
  English: [
    "Read chapters 4 to 6 and write a paragraph on how the protagonist changes",
    "Rewrite the opening of the novel in the present tense",
    "Learn the list of twenty words for Friday's dictation",
  ],
  Mathematics: [
    "Exercise 7.2, questions 1 to 12, showing full working",
    "Ten mixed problems on simultaneous equations",
    "Complete the graph of the quadratic and label the turning point",
  ],
  Physics: [
    "Numericals on refraction: six questions, with diagrams",
    "Draw a ray diagram for each lens in the handout",
    "Write up the pendulum experiment, including the sources of error",
  ],
  Chemistry: [
    "Balance the equations in the worksheet and name each product",
    "Draw the structures of the four alkanes listed",
    "Answer the titration questions from classwork",
  ],
  Biology: [
    "Label the diagram of the heart from memory",
    "Write the functions of each organelle in a table",
    "Answer questions 1 to 8 on the circulation worksheet",
  ],
  History: [
    "Write a paragraph on the causes of the 1857 revolt",
    "Read pages 40 to 52 and note five turning points",
    "Prepare a two-minute account of the treaty you were given",
  ],
  Geography: [
    "Map the rivers of the western ghats and label four",
    "Answer the climate questions in the workbook",
    "Draw a cross-section through the area marked on the handout",
  ],
  "Computer Science": [
    "Write a function that reverses a string without using slicing",
    "Build the login form from the screenshot",
    "Debug the three programs in the shared folder",
  ],
  Economics: [
    "Explain how supply responds to a price rise, with a diagram",
    "Answer the supply and demand questions, 1 to 6",
    "Collect three recent examples of inflation from the news",
  ],
  "Physical Education": [
    "Keep a training log for the week",
    "Practise the free throw routine ten times a day",
    "Write down what you ate and what you trained on each day",
  ],
};

const GENERIC_TASKS = [
  "Complete the worksheet and bring it to class",
  "Revise the notes from last week",
  "Finish the reading and answer the questions at the end",
  "Group work: prepare a short presentation for the class",
];

/** How many tasks each subject sets per class. */
const TASKS_PER_SUBJECT = 3;

export function buildAssignments(
  profile: SchoolProfile,
  classes: SchoolClass[],
  subjects: Subject[],
  teachers: Teacher[],
): Assignment[] {
  const random = createRandom(`${profile.slug}:assignments`);
  const byId = new Map(subjects.map((subject) => [subject.id, subject]));
  const assignments: Assignment[] = [];

  for (const schoolClass of classes) {
    for (const subjectId of schoolClass.subjectIds) {
      const subject = byId.get(subjectId)!;
      const pool = TASK_POOL[subject.name] ?? GENERIC_TASKS;
      const teacher = teacherFor(subjectId, teachers, random);

      for (let index = 0; index < TASKS_PER_SUBJECT; index += 1) {
        // Spread the term: one closed long ago, one closing now, one ahead.
        const assignedOffset = [-24, -8, 3][index] + randomInt(random, -2, 2);
        const assignedOn = addDays(TODAY, assignedOffset);
        const dueDate = addDays(assignedOn, randomInt(random, 4, 10));
        const status = statusFor(dueDate);

        assignments.push({
          id: `${schoolClass.id}_asg_${subject.code.toLowerCase()}_${index + 1}`,
          title: pool[index % pool.length],
          description: pick(random, GENERIC_TASKS),
          classId: schoolClass.id,
          subjectId,
          teacherId: teacher.id,
          assignedOn: dateKey(assignedOn),
          dueDate: dateKey(dueDate),
          maxMarks: pick(random, [10, 15, 20, 25]),
          status,
          attachments: chance(random, 18)
            ? [{ name: `${subject.code.toLowerCase()}-worksheet.pdf`, sizeKb: randomInt(random, 60, 400) }]
            : [],
        });
      }
    }
  }

  return assignments;
}

/** OPEN while the due date is still ahead, CLOSED once it has passed. */
function statusFor(dueDate: Date): AssignmentStatus {
  const daysLeft = Math.round((dueDate.getTime() - TODAY.getTime()) / 86_400_000);
  if (daysLeft > 14) return "DRAFT";
  return daysLeft > 0 ? "OPEN" : "CLOSED";
}

function teacherFor(subjectId: string, teachers: Teacher[], random: Random): Teacher {
  const eligible = teachers.filter((teacher) => teacher.subjectIds.includes(subjectId));
  return pick(random, eligible.length > 0 ? eligible : teachers);
}

/**
 * One submission per student per assignment.
 *
 * A student's own diligence — a stable hash of their id — decides how much of a
 * task they get through, so the same student is usually at the front of the
 * marking table and one is always the straggler.
 */
export function buildSubmissions(
  assignments: Assignment[],
  students: Student[],
): AssignmentSubmission[] {
  const random = createRandom(`${assignments[0]?.classId ?? "none"}:submissions`);
  const submissions: AssignmentSubmission[] = [];

  for (const assignment of assignments) {
    if (assignment.status === "DRAFT") continue;

    const dueDate = new Date(`${assignment.dueDate}T23:59:00`);
    const closed = dueDate.getTime() < TODAY.getTime();
    const roster = students.filter(
      (student) => student.classId === assignment.classId && student.status === "ACTIVE",
    );

    for (const student of roster) {
      const diligence = hashSeed(`${student.id}:work`) / 0xffffffff;
      const status = submissionStatus(random, closed, diligence);
      const onTime = status === "SUBMITTED" || status === "GRADED";

      submissions.push({
        id: `${assignment.id}_sub_${student.id}`,
        assignmentId: assignment.id,
        studentId: student.id,
        status,
        submittedAt: onTime
          ? dateTimeKey(addDays(dueDate, -randomInt(random, 0, 3)), 20)
          : status === "LATE"
            ? dateTimeKey(addDays(dueDate, randomInt(random, 1, 4)), 21)
            : null,
        marksObtained:
          status === "GRADED"
            ? Math.min(
                assignment.maxMarks,
                Math.round(assignment.maxMarks * (0.35 + diligence * 0.6)),
              )
            : null,
        feedback: status === "GRADED" && diligence < 0.3 ? "Could you show the working?" : null,
      });
    }
  }

  return submissions;
}

function submissionStatus(random: Random, closed: boolean, diligence: number): SubmissionStatus {
  if (!closed) {
    // Still open: most have not started, a few are part-way, some handed it in early.
    return weighted(random, [
      ["NOT_STARTED", 68 - diligence * 30],
      ["IN_PROGRESS", 20],
      ["SUBMITTED", 12],
    ]);
  }

  return weighted(random, [
    ["GRADED", 55 + diligence * 25],
    ["SUBMITTED", 14],
    ["LATE", 14 - diligence * 8],
    ["NOT_STARTED", 9],
    ["IN_PROGRESS", 8],
  ]);
}