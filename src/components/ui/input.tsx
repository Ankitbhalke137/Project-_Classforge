"use client";

import { useId } from "react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { ChevronDownIcon } from "@/components/ui/icons";

/**
 * 48px control height, white fill, 1px `#e2e8f0` outline, rounded-xl. Focus moves
 * the border to emerald and adds a soft outer ring, so keyboard focus is obvious
 * on a long form without a heavy outline.
 */
const CONTROL =
  "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary-soft disabled:bg-page aria-[invalid=true]:border-danger-600 aria-[invalid=true]:ring-danger-200";

/** Label + control + error message. Shared by Input and Select. */
function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-primary">
        {label}
        {required ? <span className="ml-0.5 text-danger-600">*</span> : null}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-danger-600">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-body">{hint}</p>
      ) : null}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  /** Sits inside the control on the trailing edge, e.g. a show/hide toggle. */
  endAdornment?: ReactNode;
}

export function Input({
  label,
  error,
  hint,
  endAdornment,
  className,
  id,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <Field label={label} htmlFor={inputId} error={error} hint={hint} required={props.required}>
      <div className="relative">
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          className={cn(CONTROL, endAdornment ? "pr-11" : null, className)}
          {...props}
        />
        {endAdornment ? (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">{endAdornment}</div>
        ) : null}
      </div>
    </Field>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: string;
  options: readonly { value: string; label: string }[];
}

export function Select({ label, error, hint, options, className, id, ...props }: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <Field label={label} htmlFor={selectId} error={error} hint={hint} required={props.required}>
      <div className="relative">
        <select
          id={selectId}
          aria-invalid={error ? true : undefined}
          className={cn(
            CONTROL,
            "appearance-none bg-white pr-10",
            className,
          )}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <ChevronDownIcon width={16} height={16} className="text-muted" />
        </div>
      </div>
    </Field>
  );
}
