"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserMenu } from "@/components/layout/topbar";
import { SchoolsIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

/** The simpler navbar + sidebar used by the Super Admin area. */
export function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const links = [{ label: "Schools", href: "/platform/schools", icon: SchoolsIcon }];

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line bg-white px-4">
        <Link href="/platform" className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-ink text-xs font-bold text-white">
            CF
          </span>
          <span className="text-sm font-semibold text-ink">ClassForge Platform</span>
        </Link>
        <UserMenu />
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-56 shrink-0 border-r border-line bg-white sm:block">
          <nav aria-label="Platform" className="flex flex-col gap-1 p-3">
            {links.map((link) => {
              const isActive = pathname === link.href;
              const Icon = link.icon;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
                    isActive
                      ? "bg-ink text-white"
                      : "text-body hover:bg-brand-50 hover:text-ink",
                  )}
                >
                  <Icon width={18} height={18} />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}