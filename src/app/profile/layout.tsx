import { RequireUser } from "@/components/auth/guards";
import { UserMenu } from "@/components/layout/topbar";
import Link from "next/link";

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireUser>
      <div className="min-h-screen bg-slate-50">
        <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-brand-600 text-xs font-bold text-white">
              CF
            </span>
            <span className="text-sm font-semibold text-slate-900">ClassForge</span>
          </Link>
          <UserMenu />
        </header>
        <main className="px-4 py-6 sm:px-6">{children}</main>
      </div>
    </RequireUser>
  );
}