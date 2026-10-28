"use client";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { TableSkeleton } from "@/components/ui/table";
import { useApi } from "@/lib/hooks";
import { useAuth } from "@/store/auth";
import { schoolApi } from "@/lib/api";
import { LogoutIcon } from "@/components/ui/icons";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import type { SchoolIdentity } from "@/types";

function AdminProfile({ schoolSlug }: { schoolSlug: string }) {
  const { user } = useAuth();
  const identity = useApi(
    () => schoolApi.getIdentity(schoolSlug, user?.email ?? ""),
    [schoolSlug, user?.email],
  );

  if (identity.loading) return <div className="col-span-full h-40 flex items-center justify-center"><TableSkeleton /></div>;
  if (identity.error) return <div className="col-span-full text-xs text-danger-600">Failed to load admin profile.</div>;

  const data = identity.data as SchoolIdentity | null;
  const teacher = data?.teacher ?? null;

  return (
    <Card className="col-span-full">
      <CardHeader title="Admin Profile" description="Your account details within this school." />
      <CardBody className="space-y-4">
        {!data ? (
          <EmptyState title="No profile found" description="Could not load your admin profile." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="col-span-full sm:col-span-1">
              <label className="text-[12px] font-medium text-muted block mb-1">Name</label>
              <p className="text-sm text-ink">{user?.name || data.teacher?.name || "—"}</p>
            </div>
            <div className="col-span-full sm:col-span-1">
              <label className="text-[12px] font-medium text-muted block mb-1">Role</label>
              <p className="text-sm text-ink">{data.role}</p>
            </div>
            <div className="col-span-full sm:col-span-1">
              <label className="text-[12px] font-medium text-muted block mb-1">Email</label>
              <p className="text-sm text-body">{user?.email || "—"}</p>
            </div>
            <div className="col-span-full sm:col-span-1">
              <label className="text-[12px] font-medium text-muted block mb-1">Subject</label>
              <p className="text-sm text-ink">{teacher?.subject || "—"}</p>
            </div>
            <div className="col-span-full sm:col-span-1">
              <label className="text-[12px] font-medium text-muted block mb-1">Employee No.</label>
              <p className="text-sm text-ink">{teacher?.employeeNo || "—"}</p>
            </div>
            <div className="col-span-full sm:col-span-1">
              <label className="text-[12px] font-medium text-muted block mb-1">Joined On</label>
              <p className="text-sm text-ink">{teacher?.joinedOn || "—"}</p>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export function AccountSecuritySection() {
  const schoolSlug = typeof window !== "undefined" ? window.location.pathname.split("/").filter(Boolean)[0] : "";
  const { logout } = useAuth();

  function handleLogout() {
    logout();
  }

  return (
    <div className="space-y-6">
      <AdminProfile schoolSlug={schoolSlug} />

      <ChangePasswordForm />

      <Card>
        <CardHeader title="Sign Out" description="End your session and return to the sign-in screen." />
        <CardBody className="px-5 py-4">
          <Button
            variant="danger"
            leftIcon={<LogoutIcon className="size-4" />}
            onClick={handleLogout}
          >
            Sign Out
          </Button>
          <p className="mt-3 text-xs text-body">
            Signing out clears your session. You will need to sign in again to access this school.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
