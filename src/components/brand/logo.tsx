import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import { CapIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

type MarkProps = ComponentPropsWithoutRef<"span">;

/** The emerald tile with the graduation cap. Used in the sidebar and on sign-in. */
export function BookMark({ className, ...props }: MarkProps) {
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary",
        className,
      )}
      {...props}
    >
      <CapIcon width={22} height={22} className="text-white" strokeWidth={1.7} />
    </span>
  );
}

/**
 * Mark, wordmark and — when the shell has room — the product line beneath it.
 *
 * The version pill is deliberately part of the wordmark rather than a separate
 * component: it reads as "which build am I looking at", which is only meaningful
 * sitting next to the name.
 */
export function Logo({
  href = "/",
  size = "md",
  subtitle,
  version,
  className,
}: {
  href?: string | null;
  /** `sm` shrinks the tile for the mobile drawer. */
  size?: "sm" | "md";
  subtitle?: string;
  version?: string;
  className?: string;
}) {
  const compact = size === "sm";

  const content = (
    <span className={cn("flex items-center gap-2.5", className)}>
      <BookMark className={compact ? "size-8 rounded-[10px]" : undefined} />

      <span className="flex min-w-0 flex-col leading-none">
        <span
          className={cn(
            "flex items-center gap-2 font-bold tracking-tight text-primary",
            compact ? "text-base" : "text-lg",
          )}
        >
          <span className="truncate">ClassForge</span>
          {version ? (
            <span className="rounded-full bg-surface-low px-1.5 py-0.5 text-[10px] font-semibold text-body">
              {version}
            </span>
          ) : null}
        </span>

        {subtitle ? (
          <span className="mt-0.5 truncate text-[11px] font-medium text-muted">
            {subtitle}
          </span>
        ) : null}
      </span>
    </span>
  );

  if (!href) return content;

  return (
    <Link href={href} className="rounded-xl">
      {content}
    </Link>
  );
}