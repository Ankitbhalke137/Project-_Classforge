"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { NotificationsBell, UserMenu } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import {
  CloseIcon,
  DashboardIcon,
  MenuIcon,
  SettingsIcon,
  ShieldCheckIcon,
  SchoolsIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";

const LINKS = [
  { label: "Overview", href: "/platform", icon: DashboardIcon },
  { label: "Schools & tenants", href: "/platform/schools", icon: SchoolsIcon },
  { label: "School admins", href: "/platform/admins", icon: ShieldCheckIcon },
  { label: "Platform account", href: "/platform/settings", icon: SettingsIcon },
];

function isActive(pathname: string, href: string) {
  // "/platform" must not light up for every child screen.
  if (href === "/platform") return pathname === "/platform";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function PlatformNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Platform" className="flex flex-col p-4">
      <p className="px-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
        Platform
      </p>
      <ul className="mt-3 flex flex-col gap-0.5">
        {LINKS.map((link) => {
          const active = isActive(pathname, link.href);
          const Icon = link.icon;

          return (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-brand-50 font-semibold text-primary"
                    : "font-medium text-body hover:bg-brand-50/60 hover:text-primary",
                )}
              >
                <Icon
                  width={19}
                  height={19}
                  className={cn("shrink-0", active ? "text-secondary-strong" : "text-muted")}
                />
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * The Super Admin's workspace.
 *
 * It sits outside every school, so there is no school switcher and no tenant
 * context in the rail — just the platform's own screens.
 */
export function PlatformShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-page">
      <aside className="sticky top-0 hidden h-screen w-[280px] shrink-0 flex-col border-r border-line bg-white lg:flex">
        <div className="shrink-0 border-b border-line px-4 pb-4 pt-5">
          <Logo href="/platform" subtitle="Platform console" version="v2.4" />
        </div>

        <PlatformNav />

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

      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-primary/40"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="relative flex h-full w-80 max-w-[88%] flex-col bg-white shadow-sheet">
            <div className="flex items-center justify-between border-b border-line px-4 py-4">
              <Logo href="/platform" size="sm" subtitle="Platform console" />
              <Button
                variant="ghost"
                size="sm"
                aria-label="Close navigation"
                onClick={() => setMenuOpen(false)}
              >
                <CloseIcon />
              </Button>
            </div>
            <PlatformNav onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-line bg-white px-4 sm:px-6">
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            aria-label="Open navigation"
            onClick={() => setMenuOpen(true)}
          >
            <MenuIcon />
          </Button>

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

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-white px-4 py-4 text-xs text-body sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} ClassForge · Platform console</p>
          <p>Global scope · No school data is read from here</p>
        </footer>
      </div>
    </div>
  );
}
