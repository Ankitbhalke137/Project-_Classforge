"use client";

import { Avatar, Badge } from "@/components/ui/badge";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/states";
import { useAuth } from "@/store/auth";
import { ROLE_LABELS } from "@/types";

export default function ProfilePage() {
  const user = useAuth((state) => state.user);
  const schools = useAuth((state) => state.schools);

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Your account" description="Every school you belong to, and your role in it." />

      <Card>
        <CardHeader title="Identity" />
        <CardBody>
          <div className="flex items-center gap-4">
            <Avatar name={user.name} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
              <p className="truncate text-sm text-slate-500">{user.email}</p>
              {user.isSuperAdmin ? <Badge tone="brand">Super Admin</Badge> : null}
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Memberships" description="The same account can hold a different role in each school." />
        <CardBody>
          {schools.length === 0 ? (
            <p className="text-sm text-slate-500">Not a member of any school.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {schools.map((school) => (
                <li key={school.schoolId} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{school.schoolName}</p>
                    <p className="truncate text-xs text-slate-500">/{school.schoolSlug}</p>
                  </div>
                  <Badge tone="brand">{ROLE_LABELS[school.role]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <div className="flex justify-end">
        <SignOutButton />
      </div>
    </div>
  );
}