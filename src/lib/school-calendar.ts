import { prisma } from "@/lib/prisma";

/**
 * The academic calendar and the timetable of a school.
 *
 * Both used to be one hardcoded constant in the code, which meant every school
 * on the platform was forced onto the same year and the same bell times. They
 * now live in the database, one set per school:
 *
 *   academic_years  — the year, e.g. "2026-27"
 *   academic_terms  — Term 1, Term 2, Term 3 and their dates
 *   timetable_periods — the wall-clock times of each teaching period
 *
 * A newly provisioned school gets sensible defaults, which the school can then
 * change. The breaks between periods are not stored: they are the gaps between
 * the periods, so they are worked out when the timetable is read.
 */

export interface CalendarTerm {
  label: string;
  startDate: string;
  endDate: string;
  position: number;
}

export interface CalendarPeriod {
  period: number;
  startTime: string;
  endTime: string;
  label: string;
}

export interface SchoolCalendar {
  academicYear: {
    name: string;
    startDate: string;
    endDate: string;
    status: string;
  } | null;
  terms: CalendarTerm[];
  periods: CalendarPeriod[];
}

/** ISO date (yyyy-mm-dd) for a Date, in UTC so it never shifts a day. */
function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The academic year that contains `from`. A school year runs April to March. */
export function defaultAcademicYear(from: Date): {
  name: string;
  startDate: string;
  endDate: string;
} {
  const year = from.getUTCFullYear();
  const startsInYear = from.getUTCMonth() >= 3; // April onwards
  const startYear = startsInYear ? year : year - 1;
  const endYear = startYear + 1;

  return {
    name: `${startYear}-${String(endYear).slice(2)}`,
    startDate: iso(new Date(Date.UTC(startYear, 3, 1))),
    endDate: iso(new Date(Date.UTC(endYear, 2, 31))),
  };
}

/** Three terms across an academic year, in the order they run. */
export function defaultTerms(academicYear: {
  startDate: string;
  endDate: string;
}): CalendarTerm[] {
  const start = new Date(`${academicYear.startDate}T00:00:00Z`);
  const end = new Date(`${academicYear.endDate}T00:00:00Z`);
  const startYear = start.getUTCFullYear();

  return [
    {
      label: "Term 1",
      startDate: iso(start),
      endDate: iso(new Date(Date.UTC(startYear, 7, 31))),
      position: 1,
    },
    {
      label: "Term 2",
      startDate: iso(new Date(Date.UTC(startYear, 8, 1))),
      endDate: iso(new Date(Date.UTC(startYear, 11, 31))),
      position: 2,
    },
    {
      label: "Term 3",
      startDate: iso(new Date(Date.UTC(startYear + 1, 0, 1))),
      endDate: iso(end),
      position: 3,
    },
  ];
}

/** The six-period day a new school starts with. */
export function defaultPeriods(): CalendarPeriod[] {
  return [
    { period: 1, startTime: "08:30", endTime: "09:15", label: "08:30–09:15" },
    { period: 2, startTime: "09:30", endTime: "10:15", label: "09:30–10:15" },
    { period: 3, startTime: "10:30", endTime: "11:15", label: "10:30–11:15" },
    { period: 4, startTime: "11:30", endTime: "12:15", label: "11:30–12:15" },
    { period: 5, startTime: "13:00", endTime: "13:45", label: "13:00–13:45" },
    { period: 6, startTime: "14:00", endTime: "14:45", label: "14:00–14:45" },
  ];
}

/**
 * Gives a school its own academic year, terms and timetable. Called once, when
 * the school is provisioned.
 */
export async function provisionSchoolCalendar(
  tenantId: string,
  from: Date = new Date(),
): Promise<void> {
  const academicYear = defaultAcademicYear(from);
  const terms = defaultTerms(academicYear);
  const periods = defaultPeriods();

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      academicYears: {
        create: {
          name: academicYear.name,
          startDate: new Date(`${academicYear.startDate}T00:00:00Z`),
          endDate: new Date(`${academicYear.endDate}T00:00:00Z`),
          status: "ACTIVE",
        },
      },
      timetablePeriods: {
        create: periods.map((period) => ({
          period: period.period,
          startTime: period.startTime,
          endTime: period.endTime,
          label: period.label,
        })),
      },
    },
  });

  // Terms point at the academic year, which only has an id once it is created.
  const created = await prisma.academicYear.findFirst({
    where: { tenantId, name: academicYear.name },
    select: { id: true },
  });
  if (!created) return;

  await prisma.academicTerm.createMany({
    data: terms.map((term) => ({
      tenantId,
      academicYearId: created.id,
      label: term.label,
      startDate: new Date(`${term.startDate}T00:00:00Z`),
      endDate: new Date(`${term.endDate}T00:00:00Z`),
      position: term.position,
    })),
  });
}

/** Reads a school's calendar: its active year, its terms and its timetable. */
export async function readSchoolCalendar(tenantId: string): Promise<SchoolCalendar> {
  const [academicYear, terms, periods] = await Promise.all([
    prisma.academicYear.findFirst({
      where: { tenantId, status: "ACTIVE" },
      orderBy: { startDate: "desc" },
    }),
    prisma.academicTerm.findMany({
      where: { tenantId },
      orderBy: [{ position: "asc" }, { startDate: "asc" }],
    }),
    prisma.timetablePeriod.findMany({
      where: { tenantId },
      orderBy: { period: "asc" },
    }),
  ]);

  const termRows = terms.filter(
    (term) => !academicYear || term.academicYearId === academicYear.id,
  );

  return {
    academicYear: academicYear
      ? {
          name: academicYear.name,
          startDate: iso(academicYear.startDate),
          endDate: iso(academicYear.endDate),
          status: academicYear.status,
        }
      : null,
    terms: termRows.map((term) => ({
      label: term.label,
      startDate: iso(term.startDate),
      endDate: iso(term.endDate),
      position: term.position,
    })),
    periods: periods.map((period) => ({
      period: period.period,
      startTime: period.startTime,
      endTime: period.endTime,
      label: period.label ?? `${period.startTime}–${period.endTime}`,
    })),
  };
}

/**
 * The gaps between the periods, as "Break 10:15–10:30 · Lunch 12:00–13:00".
 * These are not stored — they are whatever is left between two periods.
 */
export function breaksBetweenPeriods(periods: CalendarPeriod[]): string {
  const toMinutes = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };

  const gaps: string[] = [];
  for (let i = 0; i < periods.length - 1; i += 1) {
    const current = periods[i];
    const next = periods[i + 1];
    const gap = toMinutes(next.startTime) - toMinutes(current.endTime);
    if (gap <= 0) continue;

    const hours = Math.floor(gap / 60);
    const minutes = gap % 60;
    const length = hours > 0 ? `${hours}h ${minutes}m` : `${minutes} min`;
    gaps.push(`${current.endTime}–${next.startTime} (${length})`);
  }

  return gaps.length > 0 ? `Breaks: ${gaps.join(" · ")}` : "";
}
