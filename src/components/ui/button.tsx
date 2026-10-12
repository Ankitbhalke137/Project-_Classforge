import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

const VARIANTS = {
  primary: "bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:outline-indigo-600",
  secondary: "bg-white text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50 focus-visible:outline-slate-500",
  ghost: "bg-transparent text-slate-700 hover:bg-slate-100 focus-visible:outline-slate-500",
  danger: "bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600",
};

const SIZES = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-base gap-2",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  isLoading?: boolean;
  leftIcon?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  leftIcon,
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
        "inline-flex items-center justify-center rounded-lg font-medium transition-colors",
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