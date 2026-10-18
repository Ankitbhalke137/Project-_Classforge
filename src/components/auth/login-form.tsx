"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { SchoolIllustration } from "@/components/brand/school-illustration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertIcon, EyeIcon, EyeOffIcon, ShieldCheckIcon } from "@/components/ui/icons";
import { ApiError } from "@/lib/api";
import { landingPath } from "@/lib/nav";
import { ACCOUNTS, DEMO_PASSWORD } from "@/mocks/data";
import { useAuth } from "@/store/auth";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = { email?: string; password?: string };

export function LoginForm() {
  const router = useRouter();
  const login = useAuth((state) => state.login);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [formHint, setFormHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Same checks the mock backend makes, run early so the fields can speak first. */
  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!email.trim()) next.email = "Enter your email address.";
    else if (!EMAIL_PATTERN.test(email.trim())) next.email = "That does not look like an email address.";
    if (!password) next.password = "Enter your password.";
    return next;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setFormError(null);
    setFormHint(null);

    try {
      await login(email.trim(), password);
      const { user, schools } = useAuth.getState();
      router.replace(landingPath(user, schools));
    } catch (err) {
      // A rejected sign-in gets a recovery line; a dead server does not.
      const rejected = err instanceof ApiError && err.status === 401;
      setFormError(
        err instanceof ApiError ? err.message : "Could not reach the server. Try again in a moment.",
      );
      setFormHint(rejected ? "Check your details and try again." : null);
      setBusy(false);
    }
  }

  function fillDemoAccount(accountEmail: string) {
    setEmail(accountEmail);
    setPassword(DEMO_PASSWORD);
    setErrors({});
    setFormError(null);
    setFormHint(null);
  }

  return (
    <div className="min-h-screen bg-page lg:flex">
      {/* Left: the pitch. Hidden on small screens, where the card carries it. */}
      <aside className="hidden w-[44%] shrink-0 flex-col bg-panel px-10 py-12 lg:flex xl:px-14">
        <Logo />

        <div className="flex flex-1 flex-col justify-center py-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-brand-600">
            A connected school starts here
          </p>

          <h1 className="mt-5 text-[2.6rem] font-semibold leading-[1.08] tracking-tight text-ink xl:text-[3.4rem]">
            One Platform.
            <br />
            Every School.
          </h1>

          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-body">
            Bring people, learning, and school operations together. One secure workspace, built
            around your school.
          </p>

          <SchoolIllustration className="mt-10 w-full max-w-lg" />
        </div>

        <p className="flex items-center gap-2 text-xs text-body">
          <ShieldCheckIcon width={16} height={16} className="shrink-0 text-brand-600" />
          Your school. Your workspace. Securely connected.
        </p>
      </aside>

      {/* Right: the form itself. */}
      <main className="flex min-h-screen flex-1 flex-col">
        {/* Mobile-only brand block. */}
        <div className="bg-panel px-6 pb-8 pt-8 sm:px-10 lg:hidden">
          <Logo />
          <h1 className="mt-7 text-[2rem] font-semibold leading-[1.12] tracking-tight text-ink">
            One Platform.
            <br />
            Every School.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-body">
            People, learning, and operations. Together in your school&apos;s secure workspace.
          </p>
        </div>

        <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-md">
            <div className="rounded-2xl border border-line bg-white p-7 shadow-card sm:p-10">
              <header>
                <h2 className="text-[1.75rem] font-semibold tracking-tight text-ink">
                  Welcome Back
                </h2>
                <p className="mt-1.5 text-sm text-body">Sign in to your school workspace</p>
              </header>

              {formError ? (
                <div
                  role="alert"
                  className="mt-6 flex items-start gap-2.5 rounded-lg border border-danger-200 bg-danger-50 p-3.5"
                >
                  <AlertIcon
                    width={18}
                    height={18}
                    className="mt-0.5 shrink-0 text-danger-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-danger-600">{formError}</p>
                    {formHint ? (
                      <p className="mt-0.5 text-sm text-danger-600/90">{formHint}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <form onSubmit={onSubmit} className="mt-6 space-y-6" noValidate>
                <Input
                  label="Email address"
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="you@school.edu"
                  value={email}
                  error={errors.email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (errors.email) setErrors({ ...errors, email: undefined });
                  }}
                  onBlur={() => setErrors(validate())}
                />

                <Input
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  error={errors.password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (errors.password) setErrors({ ...errors, password: undefined });
                  }}
                  onBlur={() => setErrors(validate())}
                  endAdornment={
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                      className="rounded p-1 text-muted transition-colors hover:text-ink"
                    >
                      {showPassword ? (
                        <EyeOffIcon width={18} height={18} />
                      ) : (
                        <EyeIcon width={18} height={18} />
                      )}
                    </button>
                  }
                />

                <div className="-mt-2 flex justify-end">
                  <button
                    type="button"
                    className="rounded text-sm font-medium text-brand-600 hover:text-brand-700"
                  >
                    Forgot password?
                  </button>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="h-12 w-full"
                  isLoading={busy}
                  disabled={busy}
                >
                  Sign In
                </Button>
              </form>
            </div>

            <DemoAccounts onPick={fillDemoAccount} />

            <p className="mt-8 text-center text-xs text-body">
              © {new Date().getFullYear()} ClassForge. All rights reserved.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * Not in the marketing mockups, but the app runs on mocked accounts — so the
 * list stays, collapsed, so every role can be tried in one click.
 */
function DemoAccounts({ onPick }: { onPick: (email: string) => void }) {
  return (
    <details className="mt-6 rounded-xl border border-line bg-page px-4 py-3">
      <summary className="cursor-pointer list-none text-xs font-medium text-body marker:content-none hover:text-ink">
        Demo accounts · password <span className="font-mono text-ink">{DEMO_PASSWORD}</span>
      </summary>

      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {Object.entries(ACCOUNTS).map(([accountEmail, account]) => (
          <li key={accountEmail}>
            <button
              type="button"
              onClick={() => onPick(accountEmail)}
              className="w-full rounded-lg border border-line bg-white p-2.5 text-left transition-colors hover:border-brand-300 hover:bg-brand-50"
            >
              <span className="block truncate text-xs font-medium text-ink">{accountEmail}</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-body">{account.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}