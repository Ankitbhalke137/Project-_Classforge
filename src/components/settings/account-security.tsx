"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/states";
import { TableSkeleton } from "@/components/ui/table";
import { useApi } from "@/lib/hooks";
import { useAuth } from "@/store/auth";
import { schoolApi } from "@/lib/api";
import { EyeIcon, EyeOffIcon, LogoutIcon } from "@/components/ui/icons";
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

  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordVisibility, setPasswordVisibility] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function toggleVisibility(field: "current" | "new" | "confirm") {
    setPasswordVisibility((v) => ({ ...v, [field]: !v[field] }));
  }

  function validatePasswords(): boolean {
    const next: Record<string, string> = {};
    if (!passwords.currentPassword) next.currentPassword = "Current password is required";
    if (!passwords.newPassword) next.newPassword = "New password is required";
    else if (passwords.newPassword.length < 8) {
      next.newPassword = "New password must be at least 8 characters";
    }
    if (!passwords.confirmPassword) next.confirmPassword = "Please confirm your new password";
    else if (passwords.confirmPassword !== passwords.newPassword) {
      next.confirmPassword = "Passwords do not match";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleChange(field: keyof typeof passwords, value: string) {
    setPasswords((p) => ({ ...p, [field]: value }));
    if (errors[field]) setErrors((e) => { const n = { ...e }; delete n[field]; return n; });
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!validatePasswords()) return;

    setSubmitting(true);
    setMessage(null);

    // There is no backend endpoint for changing a password.
    await new Promise((resolve) => setTimeout(resolve, 800));

    setSubmitting(false);
    setMessage({
      type: "error",
      text: "Password changes require a backend endpoint that is not yet available. Your password was not changed.",
    });
    setTimeout(() => setMessage(null), 5000);
  }

  function handleLogout() {
    logout();
  }

  return (
    <div className="space-y-6">
      <AdminProfile schoolSlug={schoolSlug} />

      <Card>
        <CardHeader
          title="Change Password"
          description="Update your account password. Your current password is required to confirm the change."
        />
        <CardBody>
          {message && (
            <div
              className={`p-3 rounded-lg mb-4 text-sm ${
                message.type === "success"
                  ? "bg-brand-50 text-secondary-strong border border-brand-100"
                  : "bg-danger-50 text-danger-600 border border-danger-100"
              }`}
            >
              {message.text}
            </div>
          )}
          <form onSubmit={handleSave} className="space-y-4">
            <Input
              label="Current password"
              type={passwordVisibility.current ? "text" : "password"}
              required
              value={passwords.currentPassword}
              onChange={(event) => handleChange("currentPassword", event.target.value)}
              error={errors.currentPassword}
              endAdornment={
                <button
                  type="button"
                  onClick={() => toggleVisibility("current")}
                  aria-label={passwordVisibility.current ? "Hide password" : "Show password"}
                  className="rounded-md p-1 text-muted hover:bg-brand-50 hover:text-ink"
                >
                  {passwordVisibility.current ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                </button>
              }
            />
            <Input
              label="New password"
              type={passwordVisibility.new ? "text" : "password"}
              required
              value={passwords.newPassword}
              onChange={(event) => handleChange("newPassword", event.target.value)}
              error={errors.newPassword}
              hint="At least 8 characters"
              endAdornment={
                <button
                  type="button"
                  onClick={() => toggleVisibility("new")}
                  aria-label={passwordVisibility.new ? "Hide password" : "Show password"}
                  className="rounded-md p-1 text-muted hover:bg-brand-50 hover:text-ink"
                >
                  {passwordVisibility.new ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                </button>
              }
            />
            <Input
              label="Confirm new password"
              type={passwordVisibility.confirm ? "text" : "password"}
              required
              value={passwords.confirmPassword}
              onChange={(event) => handleChange("confirmPassword", event.target.value)}
              error={errors.confirmPassword}
              endAdornment={
                <button
                  type="button"
                  onClick={() => toggleVisibility("confirm")}
                  aria-label={passwordVisibility.confirm ? "Hide password" : "Show password"}
                  className="rounded-md p-1 text-muted hover:bg-brand-50 hover:text-ink"
                >
                  {passwordVisibility.confirm ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                </button>
              }
            />
            <div className="pt-2 flex items-center gap-3 justify-between">
              <p className="text-xs text-body">
                Changing your password requires a backend endpoint that is not yet available.
              </p>
              <Button
                type="submit"
                variant="primary"
                isLoading={submitting}
                disabled={submitting}
              >
                Change Password
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

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
