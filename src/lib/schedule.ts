import { WEEKDAYS, type Weekday } from "@/types";

/*
 * Date and time helpers shared by the timetable and calendar screens.
 *
 * The calendar itself — the academic year, the terms and the bell times — is
 * not in here any more. It belongs to the school, so it is read from the
 * database through `/api/t/:tenantSlug/calendar`. See `school-calendar.ts`.
 */

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
 * Academic calendar — pure helpers over the data the API returns
 * ------------------------------------------------------------------ */

export interface TermWindow {
  label: string;
  startsOn: string;
  endsOn: string;
}

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

/**
 * The term containing `today`, else the next one to start.
 *
 * With no terms at all, there is no current term — the caller shows the
 * academic year on its own.
 */
export function currentTerm(today: Date, terms: TermWindow[]): CurrentTerm | null {
  if (terms.length === 0) return null;

  const now = today.getTime();
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
