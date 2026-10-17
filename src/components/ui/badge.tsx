import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Status pills: tinted fill, matching label, fully rounded, no border.
 *
 * `brand` and `green` are deliberately the same — they were two names for the
 * affirmative state before the design system named it. `indigo` stays as an
 * alias so screens not yet moved off it keep typechecking.
 */
const TONES = {
  neutral: "bg-surface-low text-body",
  brand: "bg-brand-50 text-secondary-strong",
  green: "bg-brand-50 text-secondary-strong",
  amber: "bg-warn-50 text-warn-600",
  warning: "bg-warn-50 text-warn-600",
  red: "bg-danger-50 text-danger-600",
  negative: "bg-danger-50 text-danger-600",
  positive: "bg-brand-50 text-secondary-strong",
  indigo: "bg-brand-50 text-secondary-strong",
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
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1",
        "text-[11px] font-semibold uppercase tracking-[0.03em]",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const SIZES = { sm: "size-7 text-[11px]", md: "size-9 text-xs", lg: "size-11 text-sm" };

/** Initials tile. `shape="square"` matches the school switcher chip. */
export function Avatar({
  name,
  size = "md",
  shape = "circle",
  className,
}: {
  name: string;
  size?: keyof typeof SIZES;
  shape?: "circle" | "square";
  className?: string;
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
        "inline-flex shrink-0 items-center justify-center bg-primary font-bold text-white",
        SIZES[size],
        shape === "circle" ? "rounded-full" : "rounded-xl",
        className,
      )}
    >
      {initials}
    </span>
  );
}