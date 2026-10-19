/**
 * The daily and financial side of a school: who turned up, what was announced,
 * and who still owes money.
 */

import { ANNOUNCEMENT_SEEDS, FEE_TYPES, TERMS, TUITION_BY_GRADE } from "@/mocks/fixtures/catalog";
import type { SchoolProfile } from "@/mocks/fixtures/profile";
import {
  TODAY,
  addDays,
  addMonths,
  chance,
  createRandom,
  dateKey,
  dateTimeKey,
  pick,
  randomInt,
  recentSchoolDays,
  weighted,
  type Random,
} from "@/mocks/fixtures/random";
import type {
  Announcement,
  AttendanceRecord,
  AttendanceStatus,
  FeeInvoice,
  FeeStatus,
  FeeSummary,
  Student,
  Teacher,
} from "@/types";

/** How many school days of history are generated. */
export const ATTENDANCE_DAYS = 30;

/* ---------- Attendance ---------- */

/**
 * Attendance for every student on every school day in the window.
 *
 * The weight shifts by weekday — busier on Monday morning, quieter on Friday —
 * and a student flagged INACTIVE is never marked, which is why the daily totals
 * are not exactly the class size.
 */
export function buildAttendance(
  profile: SchoolProfile,
  classes: { id: string; homeroomTeacherId: string | null }[],
  students: Student[],
): AttendanceRecord[] {
  const random = createRandom(`${profile.slug}:attendance`);
  const days = recentSchoolDays(TODAY, ATTENDANCE_DAYS);
  const records: AttendanceRecord[] = [];

  for (const date of days) {
    const day = new Date(`${date}T00:00:00`);
    const weights = weekdayWeights(day);

    for (const schoolClass of classes) {
      const roster = students.filter(
        (student) => student.classId === schoolClass.id && student.status === "ACTIVE",
      );

      for (const student of roster) {
        records.push({
          id: `${date}_${student.id}`,
          date,
          classId: schoolClass.id,
          studentId: student.id,
          status: weighted(random, weights),
          markedByTeacherId: schoolClass.homeroomTeacherId,
          // Friday's register is marked over lunch, the rest before the bell.
          markedAt: dateTimeKey(day, day.getDay() === 5 ? 13 : 8, randomInt(random, 0, 45)),
        });
      }
    }
  }

  return records;
}

/** Presence, absence and lateness all move a little with the day of the week. */
function weekdayWeights(day: Date): (readonly [AttendanceStatus, number])[] {
  switch (day.getDay()) {
    case 1: // Monday
      return [["PRESENT", 84], ["ABSENT", 8], ["LATE", 5], ["EXCUSED", 3]];
    case 6: // Saturday
      return [["PRESENT", 78], ["ABSENT", 11], ["LATE", 6], ["EXCUSED", 5]];
    case 5: // Friday
      return [["PRESENT", 87], ["ABSENT", 6], ["LATE", 5], ["EXCUSED", 2]];
    default:
      return [["PRESENT", 91], ["ABSENT", 4], ["LATE", 3], ["EXCUSED", 2]];
  }
}

/* ---------- Announcements ---------- */

export function buildAnnouncements(
  profile: SchoolProfile,
  principalName: string,
  teachers: Teacher[],
  /** Rough head count, used to scale how many people have read each notice. */
  readership: number,
): Announcement[] {
  const random = createRandom(`${profile.slug}:announcements`);

  return ANNOUNCEMENT_SEEDS.map((seed, index) => {
    const date = addDays(TODAY, seed.offset);
    // Staff-only notices are written by a teacher; the rest by the principal.
    const staffOnly = seed.audience.length === 1 && seed.audience[0] === "STAFF";
    const author = staffOnly ? pick(random, teachers) : undefined;

    return {
      id: `${profile.slug}_ann_${String(index + 1).padStart(3, "0")}`,
      title: seed.title,
      body: seed.body,
      audience: [...seed.audience],
      priority: seed.priority,
      pinned: seed.pinned ?? false,
      authorId: author?.id ?? `${profile.slug}_staff`,
      authorName: author?.name ?? principalName,
      authorRole: author ? ("TEACHER" as const) : ("SCHOOL_ADMIN" as const),
      publishedAt: dateTimeKey(date, seed.hour ?? 9),
      eventDate: seed.eventOffset === undefined ? null : dateKey(addDays(date, seed.eventOffset)),
      attachments: seed.attachment ? [seed.attachment] : [],
      readCount: randomInt(random, Math.floor(readership * 0.3), readership),
    };
  });
}

/* ---------- Fees ---------- */

export function buildFees(
  profile: SchoolProfile,
  students: Student[],
): { invoices: FeeInvoice[]; summary: FeeSummary } {
  const random = createRandom(`${profile.slug}:fees`);
  const invoices: FeeInvoice[] = [];

  for (const student of students) {
    if (student.status === "INACTIVE") continue;

    const tuition = student.grade ? TUITION_BY_GRADE[student.grade] ?? 20_000 : 20_000;

    for (const [termIndex, term] of TERMS.entries()) {
      const charges: { feeType: (typeof FEE_TYPES)[number]; amount: number }[] = [
        { feeType: "Tuition", amount: tuition },
      ];

      // Only some families pay for the extras, which is what makes totals differ.
      if (chance(random, 32)) charges.push({ feeType: "Transport", amount: 6_400 });
      if (chance(random, 55)) charges.push({ feeType: "Examination", amount: 2_200 });
      if (student.grade === "Grade 11" || student.grade === "Grade 12") {
        charges.push({ feeType: "Lab", amount: 4_500 });
      }

      for (const charge of charges) {
        const dueDate = addMonths(TODAY, termIndex - 1);
        // Term 3 has not started, so those invoices are issued but not yet due.
        const status = statusFor(random, termIndex === 2);

        invoices.push({
          id: `${student.id}_fee_${termIndex}_${charge.feeType.toLowerCase()}`,
          studentId: student.id,
          studentName: student.name,
          className: student.className,
          term,
          feeType: charge.feeType,
          amount: charge.amount,
          amountPaid: paidAmount(status, charge.amount, random),
          dueDate: dateKey(dueDate),
          status,
          paidAt: status === "PAID" ? dateKey(addDays(dueDate, -randomInt(random, 1, 25))) : null,
        });
      }
    }
  }

  return { invoices, summary: summariseFees(invoices) };
}

function statusFor(random: Random, isFuture: boolean): FeeStatus {
  if (isFuture) return "PENDING";
  return weighted(random, [
    ["PAID", 64],
    ["PENDING", 17],
    ["OVERDUE", 13],
    ["PARTIAL", 6],
  ]);
}

/** A part payment is a rounded percentage of the invoice, which is what a portal does. */
function paidAmount(status: FeeStatus, amount: number, random: Random): number {
  if (status === "PAID") return amount;
  if (status === "PARTIAL") return Math.round((amount * randomInt(random, 30, 70)) / 100);
  return 0;
}

export function summariseFees(invoices: FeeInvoice[]): FeeSummary {
  const totalBilled = invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const totalCollected = invoices.reduce((sum, invoice) => sum + invoice.amountPaid, 0);
  const overdue = invoices.filter((invoice) => invoice.status === "OVERDUE");

  return {
    totalBilled,
    totalCollected,
    outstanding: totalBilled - totalCollected,
    overdueAmount: overdue.reduce((sum, invoice) => sum + (invoice.amount - invoice.amountPaid), 0),
    overdueCount: overdue.length,
    collectionRate: totalBilled === 0 ? 0 : Math.round((totalCollected / totalBilled) * 100),
  };
}