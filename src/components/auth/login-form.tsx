"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertIcon } from "@/components/ui/icons";
import { ApiError } from "@/lib/api";
import { landingPath } from "@/lib/nav";
import { ACCOUNTS, DEMO_PASSWORD } from "@/mocks/data";
import { useAuth } from "@/store/auth";

export function LoginForm() {
  const router = useRouter();
  const login = useAuth((state) => state.login);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await login(email, password);
      const { user, schools } = useAuth.getState();
      router.replace(landingPath(user, schools));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reach the server.");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 lg:flex-row">
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">
              CF
            </span>
            <span className="text-lg font-semibold text-slate-900">ClassForge</span>
          </Link>

          <h1 className="mt-8 text-2xl font-semibold text-slate-900">Sign in</h1>
          <p className="mt-1 text-sm text-slate-500">
            Use the account issued by your school administrator.
          </p>

          {error ? (
            <div
              role="alert"
              className="mt-6 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200"
            >
              <AlertIcon width={18} height={18} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <Input
              label="Email"
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@school.edu"
            />
            <Input
              label="Password"
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Button type="submit" size="lg" className="w-full" isLoading={busy}>
              Sign in
            </Button>
          </form>
        </div>
      </div>

      <aside className="w-full shrink-0 border-t border-slate-200 bg-white px-4 py-8 sm:px-8 lg:w-96 lg:border-l lg:border-t-0">
        <h2 className="text-sm font-semibold text-slate-900">Demo accounts</h2>
        <p className="mt-1 text-xs text-slate-500">
          Sign in as each role to see the navigation change.
        </p>
        <ul className="mt-4 space-y-2">
          {Object.entries(ACCOUNTS).map(([accountEmail, account]) => (
            <li key={accountEmail}>
              <button
                type="button"
                onClick={() => {
                  setEmail(accountEmail);
                  setPassword(DEMO_PASSWORD);
                }}
                className="w-full rounded-lg border border-slate-200 p-3 text-left hover:border-indigo-300 hover:bg-indigo-50"
              >
                <span className="block text-sm font-medium text-slate-900">{accountEmail}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{account.label}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-slate-400">
          Password for every demo account: <code>{DEMO_PASSWORD}</code>
        </p>
      </aside>
    </div>
  );
}