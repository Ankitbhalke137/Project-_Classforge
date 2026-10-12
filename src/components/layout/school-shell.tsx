"use client";

import { AppShell } from "@/components/layout/app-shell";
import { useMembership } from "@/lib/hooks";

/**
 * Reads the school's real name out of the signed-in account's memberships.
 * Kept separate from AppShell so the layout file stays a plain server file.
 */
export function SchoolShell({
  schoolSlug,
  children,
}: {
  schoolSlug: string;
  children: React.ReactNode;
}) {
  const membership = useMembership();

  return (
    <AppShell schoolSlug={schoolSlug} schoolName={membership?.schoolName ?? schoolSlug}>
      {children}
    </AppShell>
  );
}