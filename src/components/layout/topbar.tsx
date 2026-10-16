"use client";

import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/badge";
import { Dropdown } from "@/components/ui/dropdown";
import {
  BellIcon,
  CheckIcon,
  ChevronDownIcon,
  LogoutIcon,
  SchoolsIcon,
  SearchIcon,
} from "@/components/ui/icons";
import { useMembership } from "@/lib/hooks";
import { useAuth } from "@/store/auth";
import { ROLE_LABELS } from "@/types";

/**
 * Lets one account move between the schools it belongs to. Switching is just
 * a navigation — the URL carries the school, so nothing needs to be reset.
 */
export function SchoolSwitcher() {
  const router = useRouter();
  const schools = useAuth((state) => state.schools);
  const current = useMembership();

  if (schools.length === 0) return null;

  return (
    <Dropdown
      label="Switch school"
      align="left"
      block
      trigger={
        <span className="flex w-full items-center gap-2.5 rounded-xl bg-surface-low px-3 py-2.5 text-left transition-colors hover:bg-surface-mid">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-primary">
            <SchoolsIcon width={17} height={17} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-primary">
              {current?.schoolName ?? "Select a school"}
            </span>
            <span className="block truncate text-[11px] font-medium text-body">
              {current ? ROLE_LABELS[current.role] : ""}
            </span>
          </span>
          <ChevronDownIcon width={16} height={16} className="shrink-0 text-muted" />
        </span>
      }
      items={schools.map((school) => ({
        key: school.schoolId,
        label: school.schoolName,
        description: ROLE_LABELS[school.role],
        onSelect: () => router.push(`/${school.schoolSlug}/dashboard`),
        trailing:
          school.schoolId === current?.schoolId ? (
            <CheckIcon width={16} height={16} className="shrink-0 text-secondary" />
          ) : null,
      }))}
    />
  );
}

/**
 * The school-wide search box.
 *
 * A plain GET form rather than a JS-driven index: it submits to the students
 * roster with the query in the URL, so the result is linkable and works without
 * JavaScript. Widening it to teachers and classes needs a search endpoint that
 * does not exist yet, so it is scoped to the roster for now.
 */
export function GlobalSearch({ schoolSlug }: { schoolSlug: string }) {
  return (
    <form
      action={`/${schoolSlug}/students`}
      method="get"
      role="search"
      className="relative w-full max-w-md"
    >
      <label htmlFor="global-search" className="sr-only">
        Search students
      </label>
      <SearchIcon
        width={18}
        height={18}
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
      />
      <input
        id="global-search"
        name="search"
        type="search"
        placeholder="Search students, teachers, classes…"
        className="h-11 w-full rounded-full border border-transparent bg-surface-low pl-11 pr-4 text-sm text-ink placeholder:text-muted focus:border-secondary focus:bg-white focus:outline-none focus:ring-2 focus:ring-secondary-soft"
      />
    </form>
  );
}

export function UserMenu() {
  const router = useRouter();
  const user = useAuth((state) => state.user);
  const logout = useAuth((state) => state.logout);
  const membership = useMembership();

  if (!user) return null;

  return (
    <Dropdown
      label="Account menu"
      trigger={
        <span className="flex items-center gap-2.5 rounded-xl p-1 transition-colors hover:bg-brand-50">
          <Avatar name={user.name} />
          <span className="hidden text-left sm:block">
            <span className="block text-[13px] font-semibold text-primary">{user.name}</span>
            <span className="block text-[11px] font-medium text-body">
              {membership ? ROLE_LABELS[membership.role] : "Platform"}
            </span>
          </span>
        </span>
      }
      items={[
        {
          key: "account",
          label: user.name,
          description: user.email,
          icon: <Avatar name={user.name} size="sm" />,
          onSelect: () => router.push("/profile"),
        },
        {
          key: "signout",
          label: "Sign out",
          description: "End this session",
          icon: (
            <span className="flex size-7 items-center justify-center text-body">
              <LogoutIcon width={16} height={16} />
            </span>
          ),
          onSelect: () => {
            logout();
            router.replace("/login");
          },
        },
      ]}
    />
  );
}

/** Bell with an unread dot. The panel itself is out of scope for this screen. */
export function NotificationsBell() {
  return (
    <span className="relative flex size-10 items-center justify-center rounded-xl text-body">
      <BellIcon width={20} height={20} />
      <span
        aria-label="Unread notifications"
        className="absolute right-2 top-2 size-2 rounded-full bg-danger-600 ring-2 ring-white"
      />
    </span>
  );
}