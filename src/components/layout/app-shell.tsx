"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CloseIcon, MenuIcon } from "@/components/ui/icons";
import { Sidebar } from "@/components/layout/sidebar";
import { SchoolSwitcher, UserMenu } from "@/components/layout/topbar";
import { useMembership } from "@/lib/hooks";
import { ROLE_LABELS } from "@/types";

/** The navbar + sidebar that wrap every screen inside a school. */
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

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
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

          <Link href={`/${schoolSlug}/dashboard`} className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-indigo-600 text-xs font-bold text-white">
              CF
            </span>
            <span className="hidden text-sm font-semibold text-slate-900 sm:block">
              ClassForge
            </span>
          </Link>

          <SchoolSwitcher />
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 md:block">
            {membership ? ROLE_LABELS[membership.role] : schoolName}
          </span>
          <UserMenu />
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white lg:block">
          <div className="sticky top-14">
            <Sidebar schoolSlug={schoolSlug} />
          </div>
        </aside>

        {menuOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-slate-900/50"
              onClick={() => setMenuOpen(false)}
              aria-hidden="true"
            />
            <div className="relative h-full w-72 max-w-[85%] bg-white shadow-xl">
              <div className="flex h-14 items-center justify-between border-b border-slate-200 px-3">
                <span className="text-sm font-semibold text-slate-900">Navigation</span>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Close navigation"
                  onClick={() => setMenuOpen(false)}
                >
                  <CloseIcon />
                </Button>
              </div>
              <Sidebar schoolSlug={schoolSlug} />
            </div>
          </div>
        ) : null}

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}