import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-xl bg-white ring-1 ring-line shadow-sm", className)}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div>
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-body">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}

const TONES = {
  default: "text-ink",
  positive: "text-brand-600",
  warning: "text-amber-600",
  negative: "text-danger-600",
};

/** One number with a label. Used on the dashboard and the platform overview. */
export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: keyof typeof TONES;
  /** Optional glyph in the top-right corner. */
  icon?: ReactNode;
}) {
  return (
    <Card className="px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-body">{label}</p>
        {icon ? <span className="shrink-0 text-brand-600">{icon}</span> : null}
      </div>
      <p className={cn("mt-1.5 text-3xl font-semibold tracking-tight", TONES[tone])}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-body">{hint}</p> : null}
    </Card>
  );
}