import { WEEKDAYS, type Weekday } from "@/types";

/*
 * Timetable and calendar shapes that the data model does not carry.
 *
 * `TimetableSlot` stores a day and a 1-based period; the wall-clock times and
 * the academic calendar live here so every screen renders them the same way.
 * Both are seeded to match the mocked school year — swap them for the backend's
 * timetable template and calendar endpoints when those land.
 */

export interface PeriodTime {
  /** 24-hour start, as shown on the timetable. */
  start: string;
  end: string;
  label: string;
}

/** Six 45-minute periods. The gaps between them are the breaks. */
export const PERIOD_TIMES: readonly PeriodTime[] = [
  { start: "08:30", end: "09:15", label: "08:30–09:15" },
  { start: "09:30", end: "10:15", label: "09:30–10:15" },
  { start: "10:30", end: "11:15", label: "10:30–11:15" },
  { start: "11:30", end: "12:15", label: "11:30–12:15" },
  { start: "13:00", end: "13:45", label: "13:00–13:45" },
  { start: "14:00", end: "14:45", label: "14:00–14:45" },
];

/** Printed under the timetable so a reader can account for every gap. */
export const DAY_BREAKS = "Break 10:15–10:30 · Lunch 12:00–13:00";

export function periodTime(period: number): PeriodTime | undefined {
  return PERIOD_TIMES[period - 1];
}

/** Every slot is 45 minutes; kept in one place so the copy cannot drift. */
export const PERIOD_DURATION = "45 minutes";

/** JS `Date#getDay()` is Sunday-first; the model counts the week from Monday. */
export function weekdayOf(date: Date): Weekday | null {
  const names = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  const name = names[date.getDay()];
  return WEEKDAYS.includes(name as Weekday) ? (name as Weekday) : null;
}

/** ISO date (no time) in the school's own day, matching the attendance model. */
export function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function currentTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ *
 * Academic calendar
 * ------------------------------------------------------------------ */

export interface TermWindow {
  label: string;
  startsOn: string;
  endsOn: string;
}

export const ACADEMIC_YEAR = {
  label: "2026–27",
  terms: [
    { label: "Term 1", startsOn: "2026-04-06", endsOn: "2026-08-28" },
    { label: "Term 2", startsOn: "2026-10-12", endsOn: "2026-12-18" },
    { label: "Term 3", startsOn: "2027-01-05", endsOn: "2027-03-26" },
  ] as readonly TermWindow[],
};

export interface CurrentTerm extends TermWindow {
  /** True between the first and last day of the term. */
  underway: boolean;
  /** e.g. "12 Oct – 18 Dec 2026" */
  range: string;
}

const RANGE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const RANGE_WITH_YEAR = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function parse(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

/** The term containing `today`, else the next one to start. */
export function currentTerm(today: Date): CurrentTerm {
  const now = today.getTime();
  const terms = ACADEMIC_YEAR.terms;
  const match = terms.find(
    (term) => now >= parse(term.startsOn).getTime() && now <= parse(term.endsOn).getTime(),
  );
  const term = match ?? terms.find((candidate) => parse(candidate.startsOn).getTime() > now) ?? terms[0];

  const starts = parse(term.startsOn);
  const ends = parse(term.endsOn);
  const underway = now >= starts.getTime() && now <= ends.getTime();

  return {
    ...term,
    underway,
    range: `${RANGE.format(starts)} – ${RANGE_WITH_YEAR.format(ends)}`,
  };
}