/**
 * Deterministic randomness.
 *
 * The fixtures have to look identical on every reload — a demo that reshuffles
 * itself each refresh is impossible to talk through, and screenshots in the
 * README would go stale. So nothing in `mocks/fixtures` calls `Math.random`:
 * every stream is seeded from a string and replays exactly the same sequence.
 */

/** FNV-1a. Turns "greenwood:students" into a starting number. */
export function hashSeed(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export type Random = () => number;

/** A named, replayable stream of numbers in [0, 1). */
export function createRandom(seed: string): Random {
  let state = hashSeed(seed);
  return () => {
    // mulberry32 — small, fast, and stable across engines.
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(random: Random, values: readonly T[]): T {
  return values[Math.floor(random() * values.length)];
}

/** Inclusive on both ends. */
export function randomInt(random: Random, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

/** True about `percent`% of the time. */
export function chance(random: Random, percent: number): boolean {
  return random() * 100 < percent;
}

/** The weighted choice used most often — e.g. attendance outcomes. */
export function weighted<T>(random: Random, entries: readonly (readonly [T, number])[]): T {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;

  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return value;
  }

  return entries[entries.length - 1][0];
}

/* ---------- Dates ---------- */

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function addMonths(date: Date, months: number): Date {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

/** "2026-10-13" — attendance keys on this, so it must not carry a timezone. */
export function dateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function dateTimeKey(date: Date, hour = 9, minute = 0): string {
  const copy = new Date(date);
  copy.setHours(hour, minute, 0, 0);
  return copy.toISOString();
}

/** Sundays are the only closed day in the school calendar. */
export function isSchoolDay(date: Date): boolean {
  return date.getDay() !== 0;
}

/**
 * The `count` school days ending on `end`, oldest first.
 *
 * Attendance keys on this, so "last 30 school days" rolls forward with the real
 * calendar instead of drifting into last month over time.
 */
export function recentSchoolDays(end: Date, count: number): string[] {
  const days: string[] = [];
  let cursor = startOfDay(end);

  while (days.length < count) {
    if (isSchoolDay(cursor)) days.unshift(dateKey(cursor));
    cursor = addDays(cursor, -1);
  }

  return days;
}

/** Used by every fixture so relative dates agree across modules. */
export const TODAY = startOfDay(new Date());