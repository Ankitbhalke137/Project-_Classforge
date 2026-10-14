"use client";

import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/badge";
import { Dropdown } from "@/components/ui/dropdown";
import { CheckIcon, ChevronDownIcon, LogoutIcon } from "@/components/ui/icons";
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
      trigger={
        <span className="flex items-center gap-2.5 rounded-xl border border-line py-1.5 pl-1.5 pr-2.5 transition-colors hover:bg-brand-50">
          <Avatar name={current?.schoolName ?? "—"} shape="square" />
          <span className="hidden min-w-0 text-left sm:block">
            <span className="block truncate text-sm font-semibold text-ink">
              {current?.schoolName ?? "Select a school"}
            </span>
            <span className="block truncate text-xs text-body">
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
            <CheckIcon width={16} height={16} className="shrink-0 text-brand-600" />
          ) : null,
      }))}
    />
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
        <span className="flex items-center gap-2.5 rounded-lg p-1 transition-colors hover:bg-brand-50">
          <Avatar name={user.name} />
          <span className="hidden text-left sm:block">
            <span className="block text-sm font-semibold text-ink">{user.name}</span>
            <span className="block text-xs text-body">
              {membership ? ROLE_LABELS[membership.role] : "Platform"}
            </span>
          </span>
          <ChevronDownIcon width={16} height={16} className="text-muted" />
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