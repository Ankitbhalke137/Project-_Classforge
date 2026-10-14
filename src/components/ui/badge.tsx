import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONES = {
  neutral: "bg-brand-50 text-body ring-brand-200",
  brand: "bg-brand-100 text-brand-700 ring-brand-200",
  green: "bg-brand-50 text-brand-700 ring-brand-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  red: "bg-danger-50 text-danger-600 ring-danger-200",
  /**
   * Deprecated alias for `brand`, kept so screens that have not been moved off
   * the old indigo naming still typecheck. Remove once none are left.
   */
  indigo: "bg-brand-100 text-brand-700 ring-brand-200",
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

const SIZES = { sm: "size-7 text-[11px]", md: "size-9 text-xs", lg: "size-10 text-sm" };

/** Initials tile. `shape="square"` matches the school switcher chip. */
export function Avatar({
  name,
  size = "md",
  shape = "circle",
}: {
  name: string;
  size?: keyof typeof SIZES;
  shape?: "circle" | "square";
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
        "inline-flex shrink-0 items-center justify-center bg-brand-100 font-semibold text-brand-700",
        SIZES[size],
        shape === "circle" ? "rounded-full" : "rounded-lg",
      )}
    >
      {initials}
    </span>
  );
}