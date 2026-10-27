"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EyeIcon, EyeOffIcon } from "@/components/ui/icons";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const email = searchParams.get("email") ?? "";

  const [passwords, setPasswords] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [visible, setVisible] = useState({
    newPassword: false,
    confirmPassword: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleReset(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);

    if (passwords.newPassword.length < 8) {
      setMessage({ type: "error", text: "Password must be at least 8 characters." });
      return;
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match." });
      return;
    }

    setSubmitting(true);

    try {
      await api("/api/auth/reset-password", {
        method: "POST",
        body: { token, email, newPassword: passwords.newPassword },
      });
      setMessage({ type: "success", text: "Your password has been reset. You can now sign in." });
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof ApiError ? err.message : "Could not reset password. Try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (!token || !email) {
    return (
      <Card>
        <CardHeader title="Invalid reset link" />
        <CardBody>
          <p>This reset link is missing required information.</p>
          <Link href="/login" className="underline underline-offset-4">
            Go to sign in
          </Link>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Reset your password" />
      <CardBody>
        {message ? (
          <div
            role="alert"
            className={`rounded-lg border p-3 text-sm ${
              message.type === "success"
                ? "border-success-200 bg-success-50 text-success-600"
                : "border-danger-200 bg-danger-50 text-danger-600"
            }`}
          >
            {message.text}
          </div>
        ) : null}
        <form onSubmit={handleReset} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="new-password" className="text-sm font-medium text-ink">
              New password
            </label>
            <Input
              id="new-password"
              type={visible.newPassword ? "text" : "password"}
              value={passwords.newPassword}
              onChange={(e) => setPasswords((p) => ({ ...p, newPassword: e.target.value }))}
              placeholder="••••••••"
              minLength={8}
              label="New password"
              endAdornment={
                <button
                  type="button"
                  onClick={() => setVisible((v) => ({ ...v, newPassword: !v.newPassword }))}
                  aria-label={visible.newPassword ? "Hide password" : "Show password"}
                  className="inline"
                >
                  {visible.newPassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                </button>
              }
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="confirm-password" className="text-sm font-medium text-ink">
              Confirm password
            </label>
            <Input
              id="confirm-password"
              type={visible.confirmPassword ? "text" : "password"}
              value={passwords.confirmPassword}
              onChange={(e) => setPasswords((p) => ({ ...p, confirmPassword: e.target.value }))}
              placeholder="••••••••"
              minLength={8}
              label="Confirm password"
              endAdornment={
                <button
                  type="button"
                  onClick={() => setVisible((v) => ({ ...v, confirmPassword: !v.confirmPassword }))}
                  aria-label={visible.confirmPassword ? "Hide password" : "Show password"}
                  className="inline"
                >
                  {visible.confirmPassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                </button>
              }
            />
          </div>
          <Button type="submit" variant="primary" isLoading={submitting} disabled={submitting} className="w-full">
            Reset password
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-body">
          Already have a new password?{" "}
          <Link href="/login" className="underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}
