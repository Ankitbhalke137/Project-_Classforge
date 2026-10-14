import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertIcon, EmptyIcon, LockIcon } from "@/components/ui/icons";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        {description ? <p className="mt-1 text-sm text-body">{description}</p> : null}
      </div>
      {action}
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
      <span className="flex size-11 items-center justify-center rounded-full bg-brand-50 text-body">
        <EmptyIcon />
      </span>
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
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
      <span className="flex size-11 items-center justify-center rounded-full bg-red-50 text-red-600">
        <LockIcon />
      </span>
      <div>
        <p className="text-sm font-semibold text-ink">You cannot access this school</p>
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
      <span className="flex size-11 items-center justify-center rounded-full bg-red-50 text-red-600">
        <AlertIcon />
      </span>
      <div>
        <p className="text-sm font-semibold text-ink">This screen failed to load</p>
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
      <span className="size-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      <p className="text-sm text-body">{label}</p>
    </div>
  );
}