import type { Metadata } from "next";
import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";

export const metadata: Metadata = { title: "No access" };

export default function NoAccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-lg space-y-4">
        <Card>
          <EmptyState
            title="No school assigned"
            description="This account is valid but has not been added to a school yet. Ask your administrator for an invitation."
          />
        </Card>
        <div className="flex justify-center gap-2">
          <Link href="/login" className="text-sm text-slate-600 underline">
            Use a different account
          </Link>
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}