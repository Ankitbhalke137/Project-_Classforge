"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navForRole, schoolHref } from "@/lib/nav";
import { useRole, canPerform } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { HelpIcon, ShieldCheckIcon } from "@/components/ui/icons";

/**
 * The left rail: brand, the school switcher, then the screens this role is
 * allowed to open.
 *
 * Only role-permitted screens are listed, so a teacher never sees a Students
 * link and a student never sees Teachers. The same table guards the URLs, so a
 * hidden tab is also a blocked route.
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

  return (
    <div className="flex h-full flex-col justify-between gap-6 overflow-y-auto p-4">
      <nav aria-label="Main" className="flex flex-col">
        <p className="px-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          Main navigation
        </p>

        <ul className="mt-3 flex flex-col gap-0.5">
          {items.map((item) => {
            const href = schoolHref(schoolSlug, item);
            const isActive = pathname === href || pathname.startsWith(`${href}/`);
            const Icon = item.icon;

            return (
              <li key={item.area}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                    isActive
                      ? "bg-brand-50 font-semibold text-primary"
                      : "font-medium text-body hover:bg-brand-50/60 hover:text-primary",
                  )}
                >
                  <Icon
                    width={19}
                    height={19}
                    className={cn("shrink-0", isActive ? "text-secondary-strong" : "text-muted")}
                  />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.soon ? (
                    <span className="shrink-0 rounded-full bg-surface-low px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                      Soon
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>

        {items.length === 0 ? (
          <p className="px-3 py-2 text-xs text-body">
            No screens are open to this role yet.
          </p>
        ) : null}
      </nav>

      <div className="flex flex-col gap-3">
        {role === "TEACHER" || canPerform(role, "viewSchoolDashboard") ? (
          <p className="flex items-start gap-2 px-1 text-xs text-body">
            <ShieldCheckIcon width={16} height={16} className="mt-0.5 shrink-0 text-secondary" />
            Assigned-class access only
          </p>
        ) : null}

        <p className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-body">
          <HelpIcon width={19} height={19} className="shrink-0 text-muted" />
          Help &amp; Support
        </p>

        <div className="rounded-2xl bg-surface-low p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-secondary-strong">
            ClassForge mission
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-body">
            Better schools. Brighter futures.
          </p>
        </div>
      </div>
    </div>
  );
}