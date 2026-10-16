import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertIcon, EmptyIcon, LockIcon } from "@/components/ui/icons";

/**
 * The page masthead: an optional eyebrow of context, the headline, a supporting
 * line, and the screen's actions on the right.
 */
export function PageHeader({
  title,
  description,
  action,
  eyebrow,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  /** Small uppercase context line, e.g. the module and the active term. */
  eyebrow?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-secondary-strong">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-[26px] font-bold leading-tight tracking-tight text-primary sm:text-[32px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-body">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-surface-low text-body">
        <EmptyIcon />
      </span>
      <div>
        <p className="text-sm font-semibold text-primary">{title}</p>
        {description ? <p className="mt-1 max-w-sm text-sm text-body">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** Shown when someone opens a school their account does not belong to. */
export function ForbiddenState({ schoolName }: { schoolName?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-danger-50 text-danger-600">
        <LockIcon />
      </span>
      <div>
        <p className="text-sm font-semibold text-primary">You cannot access this school</p>
        <p className="mt-1 max-w-md text-sm text-body">
          {schoolName
            ? `Your account is not a member of ${schoolName}.`
            : "Your account is not a member of this school."}
        </p>
      </div>
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-danger-50 text-danger-600">
        <AlertIcon />
      </span>
      <div>
        <p className="text-sm font-semibold text-primary">This screen failed to load</p>
        <p className="mt-1 max-w-md text-sm text-body">
          The request did not go through. Check your connection and try again.
        </p>
      </div>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/** Blocking spinner for guards, while the session is being resolved. */
export function FullPageLoader({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-page">
      <span className="size-6 animate-spin rounded-full border-2 border-secondary border-t-transparent" />
      <p className="text-sm text-body">{label}</p>
    </div>
  );
}