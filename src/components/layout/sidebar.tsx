"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navForRole, schoolHref } from "@/lib/nav";
import { useRole } from "@/lib/hooks";
import { ACADEMIC_YEAR, currentTerm } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { ShieldCheckIcon } from "@/components/ui/icons";
import { ROLE_LABELS } from "@/types";

/**
 * The sidebar only lists the screens this role is allowed to open, so a
 * teacher never sees a Students link and a student never sees Teachers.
 */
export function Sidebar({
  schoolSlug,
  onNavigate,
}: {
  schoolSlug: string;
  /** Called after a link is followed, so the mobile drawer can close itself. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const role = useRole();
  const items = navForRole(role);

  const term = currentTerm(new Date());

  return (
    <div className="flex flex-col justify-between gap-6 p-4">
      <nav aria-label="Main" className="flex flex-col">
        <p className="px-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
          Workspace
        </p>
        <p className="mt-0.5 px-3 text-sm font-semibold text-ink">
          {role ? ROLE_LABELS[role] : "—"}
        </p>

        <ul className="mt-4 flex flex-col gap-1">
          {items.map((item) => {
            const href = schoolHref(schoolSlug, item.area);
            const isActive = pathname === href || pathname.startsWith(`${href}/`);
            const Icon = item.icon;

            return (
              <li key={item.area}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-brand-100 text-brand-700"
                      : "text-body hover:bg-brand-50 hover:text-ink",
                  )}
                >
                  <Icon width={18} height={18} className="shrink-0" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        {items.length === 0 ? (
          <p className="px-3 py-2 text-xs text-body">
            No screens are open to the {role ? ROLE_LABELS[role] : "current"} role yet.
          </p>
        ) : null}
      </nav>

      <div className="flex flex-col gap-4">
        <div className="rounded-xl bg-brand-50 p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-brand-600">
            Academic year {ACADEMIC_YEAR.label}
          </p>
          <p className="mt-2 text-sm font-semibold text-ink">
            {term.label} is {term.underway ? "underway" : "upcoming"}
          </p>
          <p className="mt-1 text-xs text-body">{term.range}</p>
        </div>

        {role === "TEACHER" ? (
          <p className="flex items-start gap-2 px-1 text-xs text-body">
            <ShieldCheckIcon width={16} height={16} className="mt-0.5 shrink-0 text-brand-600" />
            Assigned-class access only
          </p>
        ) : null}
      </div>
    </div>
  );
}