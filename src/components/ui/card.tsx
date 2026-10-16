import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The standard surface: flat white, 1px outline, generous rounding.
 *
 * Cards lean on outline precision rather than drop shadows — a dense admin table
 * turns clinical fast under heavy elevation. Only floating chrome lifts.
 */
export function Card({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("rounded-2xl border border-line bg-white", className)}>
      {children}
    </div>
  );
}

/**
 * A card header with an optional accent glyph, matching the icon-and-title pairs
 * the dashboard and directory screens use throughout.
 */
export function CardHeader({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {icon ? <span className="shrink-0 text-secondary">{icon}</span> : null}
        <div className="min-w-0">
          <h2 className="text-[17px] font-semibold leading-tight tracking-tight text-primary">
            {title}
          </h2>
          {description ? <p className="mt-0.5 text-[13px] text-body">{description}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}

const TONES = {
  default: "text-primary",
  positive: "text-secondary-strong",
  warning: "text-warn-600",
  negative: "text-danger-600",
};

/**
 * One number with a label, a tint chip and an optional micro-chart.
 *
 * Used across the dashboards and the platform overview. `spark` draws the trend
 * line inside the card rather than below it, which is what keeps a row of four
 * metrics scannable at a glance.
 */
export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  icon,
  chip,
  spark,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: keyof typeof TONES;
  icon?: ReactNode;
  /** Small tinted pill under the metric, e.g. "+2.4% vs last term". */
  chip?: ReactNode;
  spark?: ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        {icon ? (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary-container text-on-secondary-container">
            {icon}
          </span>
        ) : null}

        <div className="min-w-0">
          <p className="text-[13px] font-medium text-muted">{label}</p>
          <p
            className={cn(
              "mt-0.5 text-[28px] font-bold leading-tight tracking-tight",
              TONES[tone],
            )}
          >
            {value}
          </p>
        </div>
      </div>

      {chip || spark ? (
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2">
          <span className="min-w-0 truncate">{chip}</span>
          {spark}
        </div>
      ) : null}

      {hint ? <p className="mt-2 text-xs text-body">{hint}</p> : null}
    </Card>
  );
}