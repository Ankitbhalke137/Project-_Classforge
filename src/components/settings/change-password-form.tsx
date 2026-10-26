"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EyeIcon, EyeOffIcon } from "@/components/ui/icons";
import { authApi, ApiError } from "@/lib/api";

type Field = "currentPassword" | "newPassword" | "confirmPassword";

const EMPTY = { currentPassword: "", newPassword: "", confirmPassword: "" };

interface ChangePasswordFormProps {
  /** Fired after the password is successfully changed. */
  onSuccess?: () => void;
}

/**
 * The "change your password" form.
 *
 * Shared by the Super Admin's platform security tab and a school admin's
 * account & security tab, because both change the same thing: the signed-in
 * account's own `users.password_hash` row. The server requires the current
 * password, so a stolen session cannot be used to take the account over.
 */
export function ChangePasswordForm({ onSuccess }: ChangePasswordFormProps = {}) {
  const [passwords, setPasswords] = useState(EMPTY);
  const [visible, setVisible] = useState<Record<Field, boolean>>({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function handleChange(field: Field, value: string) {
    setPasswords((previous) => ({ ...previous, [field]: value }));
    // Clear the error as soon as the user starts fixing that field.
    setErrors((previous) => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
  }

  function validate(): boolean {
    const next: Partial<Record<Field, string>> = {};

    if (!passwords.currentPassword) {
      next.currentPassword = "Current password is required";
    }
    if (!passwords.newPassword) {
      next.newPassword = "New password is required";
    } else if (passwords.newPassword.length < 8) {
      next.newPassword = "New password must be at least 8 characters";
    }
    if (!passwords.confirmPassword) {
      next.confirmPassword = "Please confirm your new password";
    } else if (passwords.confirmPassword !== passwords.newPassword) {
      next.confirmPassword = "Passwords do not match";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setMessage(null);

    try {
      const result = await authApi.changePassword(passwords);
      setPasswords(EMPTY);
      setErrors({});
      setMessage({ type: "success", text: result.message });
      onSuccess?.();
    } catch (error) {
      if (error instanceof ApiError) {
        // The server can reject one field — usually the current password.
        setErrors(error.fields);
        setMessage({ type: "error", text: error.message });
      } else {
        setMessage({
          type: "error",
          text: "The password could not be changed. Please try again.",
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  function renderAdornment(field: Field) {
    const isVisible = visible[field];
    return (
      <button
        type="button"
        onClick={() => setVisible((previous) => ({ ...previous, [field]: !previous[field] }))}
        aria-label={isVisible ? "Hide password" : "Show password"}
        className="rounded-md p-1 text-muted hover:bg-brand-50 hover:text-ink"
      >
        {isVisible ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
      </button>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Change password"
        description="Your current password is required to confirm the change. Every other device signed in with the old password is signed out."
      />
      <CardBody>
        {message ? (
          <div
            role="status"
            className={`mb-4 rounded-lg border p-3 text-sm ${
              message.type === "success"
                ? "border-brand-100 bg-brand-50 text-secondary-strong"
                : "border-danger-100 bg-danger-50 text-danger-600"
            }`}
          >
            {message.text}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Current password"
            type={visible.currentPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            value={passwords.currentPassword}
            onChange={(event) => handleChange("currentPassword", event.target.value)}
            error={errors.currentPassword}
            endAdornment={renderAdornment("currentPassword")}
          />
          <Input
            label="New password"
            type={visible.newPassword ? "text" : "password"}
            required
            autoComplete="new-password"
            value={passwords.newPassword}
            onChange={(event) => handleChange("newPassword", event.target.value)}
            error={errors.newPassword}
            hint="At least 8 characters"
            endAdornment={renderAdornment("newPassword")}
          />
          <Input
            label="Confirm new password"
            type={visible.confirmPassword ? "text" : "password"}
            required
            autoComplete="new-password"
            value={passwords.confirmPassword}
            onChange={(event) => handleChange("confirmPassword", event.target.value)}
            error={errors.confirmPassword}
            endAdornment={renderAdornment("confirmPassword")}
          />

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="submit" variant="primary" isLoading={submitting} disabled={submitting}>
              Change password
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
