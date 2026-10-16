"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CloseIcon, MenuIcon } from "@/components/ui/icons";
import { Logo } from "@/components/brand/logo";
import { Sidebar } from "@/components/layout/sidebar";
import {
  GlobalSearch,
  NotificationsBell,
  SchoolSwitcher,
  UserMenu,
} from "@/components/layout/topbar";
import { currentTime } from "@/lib/schedule";

/**
 * The sidebar + topbar + footer that wrap every screen inside a school.
 *
 * The brand and the school switcher live in the rail rather than the topbar, so
 * the topbar carries only what applies across every screen: search, alerts and
 * the account.
 */
export function AppShell({
  schoolSlug,
  schoolName,
  children,
}: {
  schoolSlug: string;
  schoolName: string;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-page">
      <aside className="sticky top-0 hidden h-screen w-[280px] shrink-0 flex-col border-r border-line bg-white lg:flex">
        <div className="shrink-0 border-b border-line px-4 pb-4 pt-5">
          <Logo
            href={`/${schoolSlug}/dashboard`}
            subtitle="Admin Suite"
            version="v2.4"
          />
          <div className="mt-4">
            <SchoolSwitcher />
          </div>
        </div>

        <div className="min-h-0 flex-1">
          <Sidebar schoolSlug={schoolSlug} />
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
              <Logo href={`/${schoolSlug}/dashboard`} size="sm" subtitle="Admin Suite" />
              <Button
                variant="ghost"
                size="sm"
                aria-label="Close navigation"
                onClick={() => setMenuOpen(false)}
              >
                <CloseIcon />
              </Button>
            </div>

            <div className="border-b border-line px-4 pb-4">
              <SchoolSwitcher />
            </div>

            <div className="min-h-0 flex-1">
              <Sidebar schoolSlug={schoolSlug} onNavigate={() => setMenuOpen(false)} />
            </div>
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

          <GlobalSearch schoolSlug={schoolSlug} />

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3">
            <NotificationsBell />
            <span className="hidden h-8 w-px bg-line sm:block" aria-hidden="true" />
            <UserMenu />
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-white px-4 py-4 text-xs text-body sm:px-6 lg:px-8">
          <p>
            © {new Date().getFullYear()} ClassForge · {schoolName}
          </p>
          <p>All times in IST · Last synced at {currentTime(new Date())}</p>
        </footer>
      </div>
    </div>
  );
}