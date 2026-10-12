"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { ForbiddenState, FullPageLoader } from "@/components/ui/states";
import { useCan, useMembership, useSchoolSlug } from "@/lib/hooks";
import type { SchoolArea } from "@/lib/roles";
import { useAuth } from "@/store/auth";

/**
 * Protected routes.
 *
 * These run on the client because while the mock API is on, the session lives
 * in sessionStorage rather than a cookie. Once the real backend sets an
 * HTTP-only cookie, `proxy.ts` can do this redirect before any page renders.
 * Either way the backend re-checks every request — these only hide UI.
 */

/** Anyone signed in may open this. */
export function RequireUser({ children }: { children: ReactNode }) {
  const router = useRouter();
  const ready = useAuth((state) => state.ready);
  const user = useAuth((state) => state.user);

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  if (!ready || !user) return <FullPageLoader label="Checking your session…" />;
  return <>{children}</>;
}

/** Only the Super Admin may open the platform area. */
export function RequireSuperAdmin({ children }: { children: ReactNode }) {
  const user = useAuth((state) => state.user);
  const ready = useAuth((state) => state.ready);

  if (!ready) return <FullPageLoader label="Checking your session…" />;

  if (!user?.isSuperAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <Card className="mx-auto max-w-lg">
          <ForbiddenState />
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Refuses a single screen to a role that may not open it.
 *
 * Hiding the sidebar link is not enough on its own — anyone can type the URL
 * — so every screen inside a school is wrapped in this as well.
 */
export function RequireArea({
  area,
  children,
}: {
  area: SchoolArea;
  children: ReactNode;
}) {
  if (useCan(area)) return <>{children}</>;

  return (
    <Card className="mx-auto max-w-lg">
      <ForbiddenState />
    </Card>
  );
}

/**
 * Only members of the school in the URL may open it. Everyone else is told
 * plainly — the same message whether or not the school exists, so the
 * screen never reveals which schools are real.
 */
export function RequireSchoolMember({ children }: { children: ReactNode }) {
  const schoolSlug = useSchoolSlug();
  const membership = useMembership();

  if (!membership) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <Card className="mx-auto max-w-lg">
          <ForbiddenState schoolName={schoolSlug ?? undefined} />
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}