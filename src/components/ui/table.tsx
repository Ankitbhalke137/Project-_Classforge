import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
      {children}
    </thead>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-slate-100">{children}</tbody>;
}

export function TR({ children }: { children: ReactNode }) {
  return <tr className="hover:bg-slate-50">{children}</tr>;
}

export function TH({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th scope="col" className={cn("px-4 py-3 font-medium whitespace-nowrap", className)}>
      {children}
    </th>
  );
}

export function TD({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 text-slate-700", className)}>{children}</td>;
}

/** Placeholder rows while a table's data is loading. */
export function TableSkeleton({ rows = 6, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex items-center gap-4 px-4 py-3">
          {Array.from({ length: columns }, (_, column) => (
            <div key={column} className="h-4 flex-1 animate-pulse rounded bg-slate-200" />
          ))}
        </div>
      ))}
    </div>
  );
}