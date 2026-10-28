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

/**
 * A `<select>` whose arrow is drawn by the design system instead of the browser.
 *
 * A native arrow is painted hard against the right border, so the control reads
 * as having no padding at all — especially the filters and the inline table
 * editors, which are not wrapped in `Field`. Drawing the chevron ourselves and
 * reserving room for it (`pr-*`) keeps it clearly inside the field.
 *
 * Sizes are a closed set rather than free-form classes: the padding that clears
 * the arrow has to change with it, and `cn` does not merge conflicting
 * utilities, so accepting both would let them fight.
 */
const SELECT_VARIANTS = {
  /** Standing filter bars and forms — matches a 48px `Input`. */
  field: {
    select: "rounded-xl px-3 py-2.5 pr-10 text-sm",
    chevron: "pr-3",
    iconPx: 16,
  },
  /** Inline editors inside a table cell. */
  compact: {
    select: "rounded-lg py-1.5 pl-2.5 pr-8 text-sm",
    chevron: "pr-2",
    iconPx: 14,
  },
  /** Dense grid cells, e.g. the timetable editor. */
  cell: {
    select: "rounded-md py-1.5 pl-1.5 pr-7 text-xs",
    chevron: "pr-1.5",
    iconPx: 12,
  },
} as const;

export function SelectControl({
  className,
  variant = "field",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { variant?: keyof typeof SELECT_VARIANTS }) {
  const layout = SELECT_VARIANTS[variant];

  return (
    <div className="relative">
      <select
        className={cn(
          "w-full appearance-none border border-line bg-white text-ink",
          "focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary-soft",
          "aria-[invalid=true]:border-danger-600 aria-[invalid=true]:ring-danger-200",
          "disabled:bg-page disabled:opacity-60",
          layout.select,
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <div
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 flex items-center",
          layout.chevron,
        )}
      >
        <ChevronDownIcon
          width={layout.iconPx}
          height={layout.iconPx}
          className="shrink-0 text-muted"
        />
      </div>
    </div>
  );
}

export function Select({ label, error, hint, options, className, id, ...props }: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <Field label={label} htmlFor={selectId} error={error} hint={hint} required={props.required}>
      <SelectControl
        id={selectId}
        aria-invalid={error ? true : undefined}
        className={className}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectControl>
    </Field>
  );
}
