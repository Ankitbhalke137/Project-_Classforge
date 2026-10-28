"use client";

import { useState } from "react";
import { RequireArea } from "@/components/auth/guards";
import { PageHeader } from "@/components/ui/states";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { SchoolProfileSection } from "@/components/settings/school-profile";
import { AcademicSettingsSection } from "@/components/settings/academic-settings";
import { UsersPermissionsSection } from "@/components/settings/users-permissions";
import { AttendanceSettingsSection } from "@/components/settings/attendance-settings";
import { NotificationsSection } from "@/components/settings/notifications";
import { AccountSecuritySection } from "@/components/settings/account-security";

export type SettingsTab =
  | "profile"
  | "academic"
  | "users"
  | "attendance"
  | "notifications"
  | "security";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  return (
    <RequireArea area="settings">
      <div className="space-y-6">
        <PageHeader
          eyebrow="School Admin / Settings"
          title="Settings"
          description="Manage your school's information, academic configuration, and preferences."
        />

        <SettingsTabs activeTab={activeTab} onChange={setActiveTab} />

        <div className="space-y-6">
          {activeTab === "profile" && <SchoolProfileSection />}
          {activeTab === "academic" && <AcademicSettingsSection />}
          {activeTab === "users" && <UsersPermissionsSection />}
          {activeTab === "attendance" && <AttendanceSettingsSection />}
          {activeTab === "notifications" && <NotificationsSection />}
          {activeTab === "security" && <AccountSecuritySection />}
        </div>
      </div>
    </RequireArea>
  );
}
