"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/badge";
import { Dropdown, type DropdownItem } from "@/components/ui/dropdown";
import {
  BellIcon,
  CheckIcon,
  ChevronDownIcon,
  LogoutIcon,
  SchoolsIcon,
  SearchIcon,
} from "@/components/ui/icons";
import { schoolApi } from "@/lib/api";
import { useApi, useMembership } from "@/lib/hooks";
import { useAuth } from "@/store/auth";
import { type Announcement, ROLE_LABELS } from "@/types";

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

/** Where a notice sits in the panel's second line. */
const PRIORITY_LABEL: Record<Announcement["priority"], string> = {
  NORMAL: "Notice",
  IMPORTANT: "Important",
  URGENT: "Urgent",
};

/**
 * Last-seen timestamps live in localStorage, namespaced by school: localStorage,
 * not sessionStorage, so "you have read this" survives a reload, and one
 * school's read state cannot borrow another school's count.
 */
const SEEN_KEY_PREFIX = "classforge.notices.seen.";

function readSeen(key: string): number {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    // A browser with storage blocked still gets the panel; it just never
    // clears the dot until this session ends.
    return 0;
  }
}

/**
 * The bell, and the panel behind it.
 *
 * The panel lists this school's latest notices and links to the full feed.
 * "Unread" is the notices published after the last time the panel was opened —
 * there is no per-user read table, so the timestamp is the honest version of
 * that number.
 *
 * Without a school in the URL there is nothing to notify about (the platform
 * console sits outside every tenant), so that case says so instead of showing
 * a dot nobody can clear.
 */
export function NotificationsBell({ schoolSlug }: { schoolSlug?: string }) {
  const router = useRouter();
  const storageKey = schoolSlug ? `${SEEN_KEY_PREFIX}${schoolSlug}` : null;

  const [seenAt, setSeenAt] = useState<number | null>(() =>
    // Lazy on purpose: storage exists only in the browser, so the server render
    // gets null and the client's first render — which is the hydration pass —
    // still paints the same markup, because no notices have arrived yet at that
    // point. The dot can only appear once the data lands, after hydration.
    typeof window === "undefined" || !storageKey ? null : readSeen(storageKey),
  );

  const notices = useApi(
    () =>
      schoolSlug
        ? schoolApi.listAnnouncements(schoolSlug, { page: 1 })
        : Promise.resolve({ data: [], total: 0, page: 1, pageSize: 10 }),
    [schoolSlug],
  );

  const all = notices.data?.data ?? [];
  const rows = all.slice(0, 5);
  const isUnread = (notice: Announcement) =>
    seenAt !== null && Date.parse(notice.publishedAt) > seenAt;
  const unread = storageKey && seenAt !== null ? all.filter(isUnread).length : 0;

  // Opening the panel is what marks the notices as seen.
  function handleOpenChange(isOpen: boolean) {
    if (!isOpen || !storageKey) return;
    const now = Date.now();
    try {
      window.localStorage.setItem(storageKey, String(now));
    } catch {
      // Storage blocked: the dot stays for this load, the panel still works.
    }
    setSeenAt(now);
  }

  const items: DropdownItem[] = [];

  if (!schoolSlug) {
    items.push({
      key: "platform",
      label: "No platform notifications",
      description: "Notices are posted inside each school.",
      onSelect: () => {},
    });
  } else if (notices.loading) {
    items.push({
      key: "loading",
      label: "Loading notifications…",
      description: "Fetching this school's notices",
      onSelect: () => {},
    });
  } else if (notices.error) {
    items.push({
      key: "error",
      label: "Couldn't load notifications",
      description: "Try again in a moment.",
      onSelect: () => {},
    });
  } else if (rows.length === 0) {
    items.push({
      key: "empty",
      label: "No notifications yet",
      description: "Nothing has been posted to this school.",
      onSelect: () => {},
    });
  } else {
    for (const notice of rows) {
      items.push({
        key: notice.id,
        label: notice.title,
        description: `${PRIORITY_LABEL[notice.priority]} · ${notice.publishedAt.slice(0, 10)}`,
        trailing: isUnread(notice) ? (
          <span className="size-1.5 shrink-0 rounded-full bg-danger-600" aria-hidden="true" />
        ) : null,
        onSelect: () => router.push(`/${schoolSlug}/announcements`),
      });
    }
  }

  if (schoolSlug) {
    items.push({
      key: "all",
      label: "View all announcements",
      description: "Open the full feed",
      onSelect: () => router.push(`/${schoolSlug}/announcements`),
    });
  }

  return (
    <Dropdown
      label="Notifications"
      items={items}
      onOpenChange={handleOpenChange}
      panelClassName="w-80 max-w-[calc(100vw-2rem)]"
      trigger={
        <span className="relative flex size-10 items-center justify-center rounded-xl text-body transition-colors hover:bg-brand-50">
          <BellIcon width={20} height={20} />
          {unread > 0 ? (
            <span
              className="absolute right-2 top-2 size-2 rounded-full bg-danger-600 ring-2 ring-white"
              aria-hidden="true"
            />
          ) : null}
          <span className="sr-only">
            Notifications{unread > 0 ? `, ${unread} unread` : ""}
          </span>
        </span>
      }
    />
  );
}