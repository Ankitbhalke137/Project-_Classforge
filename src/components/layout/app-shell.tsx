"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CloseIcon, MenuIcon, BellIcon } from "@/components/ui/icons";
import { Logo } from "@/components/brand/logo";
import { Sidebar } from "@/components/layout/sidebar";
import { SchoolSwitcher, UserMenu } from "@/components/layout/topbar";
import { useMembership } from "@/lib/hooks";
import { currentTime } from "@/lib/schedule";
import { ROLE_LABELS } from "@/types";

/** The navbar + sidebar + footer that wrap every screen inside a school. */
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
  const membership = useMembership();
  const roleLabel = membership ? ROLE_LABELS[membership.role] : "";

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line bg-white px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3 sm:gap-6">
          {/* Hamburger shows the sidebar on small screens only. */}
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            aria-label="Open navigation"
            onClick={() => setMenuOpen(true)}
          >
            <MenuIcon />
          </Button>

          <Logo href={`/${schoolSlug}/dashboard`} size="sm" className="hidden sm:flex" />

          <SchoolSwitcher />
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {roleLabel ? (
            <span className="hidden rounded-full bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 md:block">
              {roleLabel} workspace
            </span>
          ) : null}

          <NotificationsBell />

          <span className="hidden h-8 w-px bg-line sm:block" aria-hidden="true" />

          <UserMenu />
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-64 shrink-0 border-r border-line bg-white lg:block">
          <div className="sticky top-16">
            <Sidebar schoolSlug={schoolSlug} />
          </div>
        </aside>

        {menuOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-ink/50"
              onClick={() => setMenuOpen(false)}
              aria-hidden="true"
            />
            <div className="relative h-full w-72 max-w-[85%] overflow-y-auto bg-white shadow-xl">
              <div className="flex h-16 items-center justify-between border-b border-line px-3">
                <span className="text-sm font-semibold text-ink">Navigation</span>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Close navigation"
                  onClick={() => setMenuOpen(false)}
                >
                  <CloseIcon />
                </Button>
              </div>
              <Sidebar schoolSlug={schoolSlug} onNavigate={() => setMenuOpen(false)} />
            </div>
          </div>
        ) : null}

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-4 text-xs text-body sm:px-6 lg:px-8">
        <p>
          © {new Date().getFullYear()} ClassForge · {schoolName}
        </p>
        <p>All times in IST · Last synced at {currentTime(new Date())}</p>
      </footer>
    </div>
  );
}

/** Bell with an unread dot. The panel itself is out of scope for this screen. */
function NotificationsBell() {
  return (
    <span className="relative flex size-9 items-center justify-center rounded-lg text-body">
      <BellIcon width={20} height={20} />
      <span
        aria-label="Unread notifications"
        className="absolute right-2 top-2 size-1.5 rounded-full bg-brand-600 ring-2 ring-white"
      />
    </span>
  );
}