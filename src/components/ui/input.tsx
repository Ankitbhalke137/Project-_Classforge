"use client";

import { useId } from "react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const CONTROL =
  "w-full rounded-lg bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 ring-1 ring-slate-300 focus:outline-2 focus:outline-offset-1 focus:outline-indigo-600 disabled:bg-slate-50 aria-[invalid=true]:ring-red-500";

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
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
        {label}
        {required ? <span className="ml-0.5 text-red-600">*</span> : null}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, className, id, ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <Field label={label} htmlFor={inputId} error={error} hint={hint} required={props.required}>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        className={cn(CONTROL, className)}
        {...props}
      />
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
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        className={cn(CONTROL, className)}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}