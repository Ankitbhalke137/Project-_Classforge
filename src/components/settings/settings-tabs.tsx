"use client";

import type { ComponentType, SVGProps } from "react";
import { SettingsTab } from "@/app/[school]/settings/page";
import {
  SchoolIcon,
  CalendarIcon,
  PersonIcon,
  AttendanceIcon,
  MegaphoneIcon,
  LockIcon,
} from "@/components/ui/icons";

const TABS: {
  key: SettingsTab;
  label: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}[] = [
  {
    key: "profile",
    label: "School Profile",
    description: "School information and branding",
    icon: SchoolIcon,
  },
  {
    key: "academic",
    label: "Academic Settings",
    description: "Classes, subjects and academic year",
    icon: CalendarIcon,
  },
  {
    key: "users",
    label: "Users & Permissions",
    description: "Staff, teachers and roles",
    icon: PersonIcon,
  },
  {
    key: "attendance",
    label: "Attendance Settings",
    description: "Attendance statuses and policy",
    icon: AttendanceIcon,
  },
  {
    key: "notifications",
    label: "Notifications",
    description: "Announcements and alerts",
    icon: MegaphoneIcon,
  },
  {
    key: "security",
    label: "Account & Security",
    description: "Password and admin profile",
    icon: LockIcon,
  },
];

interface SettingsTabsProps {
  activeTab: SettingsTab;
  onChange: (tab: SettingsTab) => void;
}

export function SettingsTabs({ activeTab, onChange }: SettingsTabsProps) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-line pb-4 sm:pb-6">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            aria-pressed={isActive}
            className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium rounded-xl transition-colors ${
              isActive
                ? "bg-primary text-on-primary"
                : "text-body hover:bg-brand-50 hover:text-secondary-strong"
            }`}
          >
            <tab.icon className="size-4" />
            <span className="truncate max-w-[140px]">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
