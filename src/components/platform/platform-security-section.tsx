"use client";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { useAuth } from "@/store/auth";

/**
 * The Super Admin's security tab.
 *
 * The password is the only thing here that changes state, so it is the only
 * thing that needs a form. Everything else on this tab describes the session
 * that is already open.
 */
export function PlatformSecuritySection() {
  const user = useAuth((state) => state.user);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <ChangePasswordForm />

      <Card>
        <CardHeader
          title="Session"
          description="Signing out ends this browser session and clears your cookies."
        />
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-body">
            Signed in as <span className="text-ink">{user.email}</span>
          </p>
          <SignOutButton />
        </CardBody>
      </Card>
    </div>
  );
}
