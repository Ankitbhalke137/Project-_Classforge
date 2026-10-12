import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONES = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: keyof typeof TONES;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const SIZES = { sm: "size-7 text-[11px]", md: "size-9 text-xs", lg: "size-12 text-sm" };

/** Circular initials. Falls back to "?" for an empty name. */
export function Avatar({
  name,
  size = "md",
}: {
  name: string;
  size?: keyof typeof SIZES;
}) {
  const initials =
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?";

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-indigo-100 font-semibold text-indigo-700",
        SIZES[size],
      )}
    >
      {initials}
    </span>
  );
}