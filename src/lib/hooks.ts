"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { schoolApi } from "@/lib/api";
import {
  canAccessArea,
  canPerform,
  type Action,
  type SchoolArea,
} from "@/lib/roles";
import { useAuth } from "@/store/auth";
import type { Membership, Role, School, SchoolCalendar, SchoolIdentity } from "@/types";

/**
 * The school in the URL. Read from the pathname rather than from a layout prop,
 * because a layout is not re-rendered when only the path changes.
 */
export function useSchoolSlug(): string | null {
  const [firstSegment] = usePathname().split("/").filter(Boolean);
  return firstSegment ?? null;
}

/** This account's membership in the school in the URL, if there is one.
 *
 * When the user holds multiple roles in the same school (e.g. TEACHER and
 * SCHOOL_ADMIN), returns the membership matching their chosen active role.
 */
export function useMembership(): Membership | null {
  const slug = useSchoolSlug();
  const schools = useAuth((state) => state.schools);
  const activeSchoolSlug = useAuth((state) => state.activeSchoolSlug);
  const activeRole = useAuth((state) => state.activeRole);

  // If the user has chosen an active context for this school, prefer it.
  if (slug && activeSchoolSlug === slug && activeRole) {
    const chosen = schools.find((s) => s.schoolSlug === slug && s.role === activeRole);
    if (chosen) return chosen;
  }

  return schools.find((school) => school.schoolSlug === slug) ?? null;
}

/** The role this account holds in the school in the URL. */
export function useRole(): Role | null {
  const user = useAuth((state) => state.user);
  const membership = useMembership();
  const activeSchoolSlug = useAuth((state) => state.activeSchoolSlug);
  const activeRole = useAuth((state) => state.activeRole);
  const slug = useSchoolSlug();

  if (user?.isSuperAdmin) return "SUPER_ADMIN";

  // If the user has chosen an active role for the current school, use it.
  if (slug && activeSchoolSlug === slug && activeRole) {
    return activeRole;
  }

  return membership?.role ?? null;
}

/** The currently chosen school and role context (set at login or via the school switcher). */
export function useActiveContext(): { schoolSlug: string | null; role: Role | null } {
  const activeSchoolSlug = useAuth((state) => state.activeSchoolSlug);
  const activeRole = useAuth((state) => state.activeRole);
  return { schoolSlug: activeSchoolSlug, role: activeRole };
}

/** All (school, role) combinations this account can sign in as. */
export function useAvailableContexts(): { schoolSlug: string; schoolName: string; role: Role; status: School["status"] }[] {
  const schools = useAuth((state) => state.schools);
  return schools.map((s) => ({
    schoolSlug: s.schoolSlug,
    schoolName: s.schoolName,
    role: s.role,
    status: s.status,
  }));
}

/** Lets a component hide a button without asking the backend first. */
export function useCan(area: SchoolArea): boolean {
  return canAccessArea(useRole(), area);
}

/** The same, for an action rather than a screen. */
export function useCanPerform(action: Action): boolean {
  return canPerform(useRole(), action);
}

/** Checks if a role can perform an action (alias for useCanPerform). */
export { canPerform };

/**
 * A suspended school can be read but not written to. Screens combine this with
 * the role's own permissions, and the backend refuses the write either way.
 */
export function useIsReadOnly(): boolean {
  return useMembership()?.status === "SUSPENDED";
}

/**
 * The value, but only after it stops changing for `delay` ms.
 *
 * Search boxes feed straight into a request, so without this every keystroke
 * costs a round trip. The box stays bound to the live value, which keeps typing
 * responsive, and only the request waits.
 */
export function useDebounced<T>(value: T, delay = 300): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return settled;
}

/**
 * Who the signed-in account is inside the school in the URL — their student
 * record, their children, their teacher record.
 *
 * Attendance and assignments both need this, because the same screen shows staff
 * a register and a parent their child's record.
 */
export function useIdentity(): { identity: SchoolIdentity | null; loading: boolean } {
  const email = useAuth((state) => state.user?.email);
  const schoolSlug = useSchoolSlug();

  const { data, loading } = useApi(
    () => schoolApi.getIdentity(schoolSlug ?? "", email ?? ""),
    [schoolSlug, email],
  );

  return { identity: data, loading };
}

/**
 * The school's own academic calendar — its year, its terms and its timetable.
 *
 * Every school keeps its own, so the calendar is read per school rather than
 * assumed. A school with no calendar set up yet gets empty arrays, not
 * invented dates.
 */
export function useSchoolCalendar(): {
  calendar: SchoolCalendar | null;
  loading: boolean;
} {
  const schoolSlug = useSchoolSlug();

  const { data, loading } = useApi(
    () => schoolApi.getCalendar(schoolSlug ?? ""),
    [schoolSlug],
  );

  return { calendar: data, loading };
}

/**
 * Fetch once and expose loading/error. Intentionally tiny — no cache library.
 * Every screen re-reads on mount, which is fine at this size.
 */
export function useApi<T>(
  run: () => Promise<T>,
  deps: unknown[],
): { data: T | null; loading: boolean; error: boolean; reload: () => void } {
  const [result, setResult] = useState<{ data: T | null; error: boolean }>({
    data: null,
    error: false,
  });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;

    run()
      .then((data) => {
        if (!cancelled) setResult({ data, error: false });
      })
      .catch(() => {
        if (!cancelled) setResult({ data: null, error: true });
      });

    return () => {
      cancelled = true;
    };
    // `version` lets reload() re-run this without changing the caller's deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  // Still loading simply means nothing has come back yet.
  return {
    data: result.data,
    error: result.error,
    loading: result.data === null && !result.error,
    reload: () => setVersion((value) => value + 1),
  };
}