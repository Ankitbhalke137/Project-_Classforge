"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { NotificationsBell, UserMenu } from "@/components/layout/topbar";
import { SchoolsIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

/**
 * The Super Admin's workspace.
 *
 * It sits outside every school, so there is no school switcher and no tenant
 * context in the rail — just the platform's own screens.
 */
export function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const links = [{ label: "Schools & tenants", href: "/platform/schools", icon: SchoolsIcon }];

  return (
    <div className="flex min-h-screen bg-page">
      <aside className="sticky top-0 hidden h-screen w-[280px] shrink-0 flex-col border-r border-line bg-white lg:flex">
        <div className="shrink-0 border-b border-line px-4 pb-4 pt-5">
          <Logo href="/platform" subtitle="Platform console" version="v2.4" />
        </div>

        <nav aria-label="Platform" className="flex flex-col p-4">
          <p className="px-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Platform
          </p>
          <ul className="mt-3 flex flex-col gap-0.5">
            {links.map((link) => {
              const isActive = pathname === link.href;
              const Icon = link.icon;

              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
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
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-auto p-4">
          <div className="rounded-2xl bg-surface-low p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-secondary-strong">
              ClassForge mission
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-body">
              Better schools. Brighter futures.
            </p>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-line bg-white px-4 sm:px-6">
          <div className="lg:hidden">
            <Logo href="/platform" size="sm" />
          </div>

          {/* No school-wide search here: the Super Admin sits outside every
              tenant, so the roster search has nothing to search. */}
          <p className="hidden text-sm font-medium text-muted lg:block">
            Cross-tenant control plane
          </p>

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3">
            <NotificationsBell />
            <span className="hidden h-8 w-px bg-line sm:block" aria-hidden="true" />
            <UserMenu />
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}