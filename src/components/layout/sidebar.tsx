"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navForRole, schoolHref } from "@/lib/nav";
import { useRole } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/types";

/**
 * The sidebar only lists the screens this role is allowed to open, so a
 * teacher never sees a Students link and a student never sees Teachers.
 */
export function Sidebar({ schoolSlug }: { schoolSlug: string }) {
  const pathname = usePathname();
  const role = useRole();
  const items = navForRole(role);

  return (
    <nav aria-label="Main" className="flex flex-col gap-1 p-3">
      {items.map((item) => {
        const href = schoolHref(schoolSlug, item.area);
        const isActive = pathname === href;
        const Icon = item.icon;

        return (
          <Link
            key={item.area}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            )}
          >
            <Icon width={18} height={18} className="shrink-0" />
            {item.label}
          </Link>
        );
      })}

      {items.length === 0 ? (
        <p className="px-3 py-2 text-xs text-slate-500">
          No screens are open to the {role ? ROLE_LABELS[role] : "current"} role yet.
        </p>
      ) : null}
    </nav>
  );
}