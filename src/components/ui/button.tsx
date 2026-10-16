import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * `primary` is the forest anchor and is reserved for the one action a screen is
 * about. `accent` is the emerald creation button the design system calls for
 * direct-create actions, so a page with both reads clearly at a glance.
 */
const VARIANTS = {
  primary:
    "bg-primary text-on-primary hover:bg-primary-hover focus-visible:outline-primary",
  accent: "bg-secondary text-white hover:bg-secondary-strong focus-visible:outline-secondary",
  secondary:
    "bg-white text-primary ring-1 ring-inset ring-line hover:bg-page focus-visible:outline-secondary",
  ghost: "bg-transparent text-secondary hover:bg-brand-50 focus-visible:outline-secondary",
  danger: "bg-danger-600 text-white hover:bg-danger-600/90 focus-visible:outline-danger-600",
};

/* Heights hold a 44px touch target on the two sizes used most, so the buttons
 * stay comfortable on a touchscreen without inflating the desktop toolbar. */
const SIZES = {
  sm: "h-9 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-11 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-5 text-sm gap-2 rounded-xl",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  leftIcon,
  rightIcon,
  className,
  disabled,
  type = "button",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={cn(
        "inline-flex items-center justify-center font-semibold transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-60",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {isLoading ? <Spinner /> : leftIcon}
      {children}
      {rightIcon}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}