/**
 * Field-level validation shared by the forms.
 *
 * A validator returns the message to show under the input, or `null` when the
 * value is acceptable. Keeping the rules here means a phone number is judged
 * the same way on the roster, the profile and the invite form, and the messages
 * stay short enough to sit under a control.
 *
 * This is the first line of defence, not the only one: every endpoint validates
 * the same payload again with Zod, because a browser can be bypassed.
 */

/** Pragmatic email check: one @, no spaces, a dot in the domain. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Digits with optional +, spaces, dashes, dots and parentheses. */
export const PHONE_PATTERN = /^\+?[\d\s().-]{7,20}$/;

/** Lowercase alphanumerics, single dashes between words. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Admission and employee numbers: letters, digits, slash, dash, dot. */
export const REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9/._-]*$/;

export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function lengthError(value: string, label: string, min: number, max: number): string | null {
  const trimmed = value.trim();
  if (trimmed.length < min) {
    return `${label} must be at least ${min} character${min === 1 ? "" : "s"}.`;
  }
  if (trimmed.length > max) {
    return `${label} cannot be longer than ${max} characters.`;
  }
  return null;
}

/** A required text field with a sensible length window. */
export function textError(
  value: string,
  label: string,
  { min = 1, max = 100 }: { min?: number; max?: number } = {},
): string | null {
  return lengthError(value, label, min, max);
}

/** Optional text: blank is fine, otherwise the same length window applies. */
export function optionalTextError(
  value: string,
  label: string,
  { min = 1, max = 100 }: { min?: number; max?: number } = {},
): string | null {
  return value.trim() ? lengthError(value, label, min, max) : null;
}

/** Required email address. */
export function emailError(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Email is required.";
  if (!EMAIL_PATTERN.test(trimmed)) return "Enter a valid email address.";
  if (trimmed.length > 254) return "Email address is too long.";
  return null;
}

/** Optional email: blank is fine, otherwise it must parse. */
export function optionalEmailError(value: string): string | null {
  return value.trim() ? emailError(value) : null;
}

/** Optional phone number. */
export function phoneError(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!PHONE_PATTERN.test(trimmed)) {
    return "Use digits, with an optional +, spaces, dashes or brackets.";
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) {
    return "Enter a phone number with 7 to 15 digits.";
  }
  return null;
}

/** Workspace slug: what the URL will contain. */
export function slugError(value: string, { required = true }: { required?: boolean } = {}): string | null {
  const trimmed = value.trim();
  if (!trimmed) return required ? "Slug is required." : null;
  if (trimmed.length < 2) return "Use at least 2 characters.";
  if (trimmed.length > 100) return "Keep the slug to 100 characters or fewer.";
  if (!SLUG_PATTERN.test(trimmed)) {
    return "Use lowercase letters, numbers and single dashes.";
  }
  return null;
}

/** Admission / employee numbers. */
export function referenceError(
  value: string,
  label: string,
  { required = false, max = 50 }: { required?: boolean; max?: number } = {},
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return required ? `${label} is required.` : null;
  if (trimmed.length > max) return `${label} cannot be longer than ${max} characters.`;
  if (!REFERENCE_PATTERN.test(trimmed)) {
    return `${label} can use letters, numbers, /, -, . and _ only.`;
  }
  return null;
}

/** A date input in YYYY-MM-DD form, optionally not in the past. */
export function dateError(
  value: string,
  label: string,
  { required = true, notPast = false }: { required?: boolean; notPast?: boolean } = {},
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return required ? `${label} is required.` : null;
  if (!ISO_DATE_PATTERN.test(trimmed)) return `Use YYYY-MM-DD for the ${label.toLowerCase()}.`;

  const [year, month, day] = trimmed.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const valid =
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;
  if (!valid) return "That date does not exist.";

  if (notPast) {
    const now = new Date();
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    if (Date.UTC(year, month - 1, day) < today) {
      return `${label} cannot be in the past.`;
    }
  }

  return null;
}

/** A date of birth: a real date that is not in the future. */
export function birthDateError(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const base = dateError(value, "Date of birth");
  if (base) return base;
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (parsed.getTime() > Date.now()) return "Date of birth cannot be in the future.";
  if (parsed.getUTCFullYear() < 1900) return "Check the year of birth.";
  return null;
}

/** Whole numbers such as capacity, marks and thresholds. */
export function integerError(
  value: string | number,
  {
    label,
    min = 0,
    max = Number.MAX_SAFE_INTEGER,
    required = false,
  }: { label: string; min?: number; max?: number; required?: boolean },
): string | null {
  const raw = typeof value === "number" ? String(value) : value.trim();
  if (!raw) return required ? `${label} is required.` : null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return `${label} must be a whole number.`;
  }
  if (parsed < min) return `${label} cannot be less than ${min}.`;
  if (parsed > max) return `${label} cannot be more than ${max}.`;
  return null;
}

/** Money and marks: decimal allowed, bounded, at most two decimal places. */
export function amountError(
  value: string | number,
  {
    label = "Amount",
    min = 0,
    max = 10_000_000,
    required = false,
    decimals = 2,
  }: {
    label?: string;
    min?: number;
    max?: number;
    required?: boolean;
    decimals?: number;
  } = {},
): string | null {
  const raw = typeof value === "number" ? String(value) : value.trim();
  if (!raw) return required ? `${label} is required.` : null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return `${label} must be a number.`;
  if (parsed < min) return `${label} must be at least ${min}.`;
  if (parsed > max) return `${label} cannot be more than ${max}.`;
  const limit = 10 ** decimals;
  if (Math.abs(Math.round(parsed * limit) - parsed * limit) > 1e-9) {
    return `${label} can have at most ${decimals} decimal places.`;
  }
  return null;
}

/** True when a `Record<string, string | null>` has any message. */
export function hasErrors(errors: Record<string, string | null>): boolean {
  return Object.values(errors).some(Boolean);
}

/** Drop null entries so the record only carries real messages. */
export function compactErrors(errors: Record<string, string | null>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(errors).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}
