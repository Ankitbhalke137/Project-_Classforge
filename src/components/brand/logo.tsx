import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import { BookIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

type MarkProps = ComponentPropsWithoutRef<"span">;

/** The green tile with the open book. Used in the topbar and on the sign-in screen. */
export function BookMark({ className, ...props }: MarkProps) {
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-600",
        className,
      )}
      {...props}
    >
      <BookIcon width={22} height={22} className="text-white" strokeWidth={1.6} />
    </span>
  );
}

/** Mark + wordmark. Links home unless told otherwise. */
export function Logo({
  href = "/",
  size = "md",
  className,
}: {
  href?: string | null;
  /** `sm` shrinks the tile for the topbar. */
  size?: "sm" | "md";
  className?: string;
}) {
  const wordmark = (
    <span
      className={cn(
        "font-semibold tracking-tight text-ink",
        size === "sm" ? "text-lg" : "text-xl",
      )}
    >
      ClassForge
    </span>
  );

  const content = (
    <span className={cn("flex items-center gap-3", className)}>
      <BookMark className={size === "sm" ? "size-9 rounded-[9px]" : undefined} />
      {wordmark}
    </span>
  );

  if (!href) return content;

  return (
    <Link href={href} className="rounded-lg">
      {content}
    </Link>
  );
}