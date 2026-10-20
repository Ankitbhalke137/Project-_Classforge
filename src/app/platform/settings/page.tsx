"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ArrowRightIcon, LockIcon, ShieldCheckIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/states";
import {
  PlatformSettingsTabs,
  type PlatformSettingsTab,
} from "@/components/platform/platform-settings-tabs";
import { PlatformSecuritySection } from "@/components/platform/platform-security-section";
import { useAuth } from "@/store/auth";

const CAPABILITIES = [
  { label: "Create a school", allowed: true },
  { label: "Edit a school's name or URL slug", allowed: true },
  { label: "Suspend or reactivate a school", allowed: true },
  { label: "Assign the first School Admin", allowed: true },
  { label: "Change a school's staff roles", allowed: true },
  { label: "See counts across the fleet", allowed: true },
  { label: "Read a school's students or attendance", allowed: false },
  { label: "Enter marks or post announcements in a school", allowed: false },
];

function AccountSection() {
  const user = useAuth((state) => state.user);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Identity" description="One platform role, outside every tenant." />
        <CardBody>
          <div className="flex flex-wrap items-center gap-4">
            <Avatar name={user.name} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
              <p className="truncate text-sm text-body">{user.email}</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <Badge tone="brand">Super Admin</Badge>
                <Badge tone="neutral">No school membership</Badge>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Role boundaries"
            description="From the product requirements, section 5."
            icon={<ShieldCheckIcon />}
          />
          <CardBody>
            <ul className="divide-y divide-line">
              {CAPABILITIES.map((capability) => (
                <li
                  key={capability.label}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <span className="text-sm text-ink">{capability.label}</span>
                  <Badge tone={capability.allowed ? "green" : "neutral"}>
                    {capability.allowed ? "Allowed" : "Not allowed"}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Where this account can go" />
            <CardBody className="space-y-2">
              <Link
                href="/platform/schools"
                className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 text-sm text-ink hover:bg-page"
              >
                <span>
                  <span className="block font-medium text-primary">Schools &amp; tenants</span>
                  <span className="block text-xs text-body">Provision, edit and suspend</span>
                </span>
                <ArrowRightIcon />
              </Link>
              <Link
                href="/platform/admins"
                className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 text-sm text-ink hover:bg-page"
              >
                <span>
                  <span className="block font-medium text-primary">School admins</span>
                  <span className="block text-xs text-body">Invite staff and assign roles</span>
                </span>
                <ArrowRightIcon />
              </Link>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="The isolation rule"
              description="SCH-06 — enforced, not just promised."
              icon={<LockIcon />}
            />
            <CardBody>
              <p className="text-[13px] leading-relaxed text-body">
                Managing a school is not the same as reading it. This account has no membership
                in any school, so every school route returns 403. Opening a school requires a
                membership issued to that account — which the Super Admin should not give
                itself.
              </p>
              <div className="mt-4 flex justify-end">
                <Link href="/profile">
                  <Button variant="secondary" size="sm">
                    Open your profile
                  </Button>
                </Link>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function PlatformSettingsPage() {
  const [activeTab, setActiveTab] = useState<PlatformSettingsTab>("account");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Platform console / Account"
        title="Platform account"
        description="The Super Admin sits above every school. This account manages the fleet and holds no membership inside any school."
      />

      <PlatformSettingsTabs activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === "account" ? <AccountSection /> : <PlatformSecuritySection />}
    </div>
  );
}
