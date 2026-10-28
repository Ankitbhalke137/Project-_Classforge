"use client";

import type { ComponentType, SVGProps } from "react";
import { PersonIcon, LockIcon } from "@/components/ui/icons";

export type PlatformSettingsTab = "account" | "security";

const TABS: {
  key: PlatformSettingsTab;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}[] = [
  { key: "account", label: "Account", icon: PersonIcon },
  { key: "security", label: "Security", icon: LockIcon },
];

interface PlatformSettingsTabsProps {
  activeTab: PlatformSettingsTab;
  onChange: (tab: PlatformSettingsTab) => void;
}

/**
 * The two things a Super Admin can change about their own account: who they
 * are on the platform, and the credentials they sign in with.
 */
export function PlatformSettingsTabs({ activeTab, onChange }: PlatformSettingsTabsProps) {
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
            className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
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
