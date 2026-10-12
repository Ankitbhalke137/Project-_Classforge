"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-lg space-y-4">
        <ErrorState onRetry={reset} />
        <div className="flex justify-center">
          <Link href="/">
            <Button variant="ghost">Back to start</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}