/** Joins class names and drops falsy entries. */
export function cn(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}