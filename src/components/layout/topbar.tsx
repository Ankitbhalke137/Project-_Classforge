"use client";

import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/badge";
import { Dropdown } from "@/components/ui/dropdown";
import { CheckIcon, ChevronDownIcon, SchoolsIcon } from "@/components/ui/icons";
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
        <span className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100">
          <SchoolsIcon width={18} height={18} className="shrink-0 text-slate-500" />
          <span className="hidden min-w-0 text-left sm:block">
            <span className="block truncate text-sm font-semibold text-slate-900">
              {current?.schoolName ?? "Select a school"}
            </span>
            <span className="block truncate text-xs text-slate-500">
              {current ? ROLE_LABELS[current.role] : ""}
            </span>
          </span>
          <ChevronDownIcon width={16} height={16} className="shrink-0 text-slate-400" />
        </span>
      }
      items={schools.map((school) => ({
        key: school.schoolId,
        label: school.schoolName,
        description: ROLE_LABELS[school.role],
        onSelect: () => router.push(`/${school.schoolSlug}/dashboard`),
        trailing:
          school.schoolId === current?.schoolId ? (
            <CheckIcon width={16} height={16} className="shrink-0 text-indigo-600" />
          ) : null,
      }))}
    />
  );
}

export function UserMenu() {
  const router = useRouter();
  const user = useAuth((state) => state.user);
  const logout = useAuth((state) => state.logout);

  if (!user) return null;

  return (
    <Dropdown
      label="Account menu"
      trigger={
        <span className="flex items-center gap-2 rounded-lg p-1 hover:bg-slate-100">
          <Avatar name={user.name} />
          <span className="hidden text-sm font-medium text-slate-700 sm:block">
            {user.name.split(" ")[0]}
          </span>
          <ChevronDownIcon width={16} height={16} className="text-slate-400" />
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
          icon: <span className="size-7" />,
          onSelect: () => {
            logout();
            router.replace("/login");
          },
        },
      ]}
    />
  );
}