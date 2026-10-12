import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <EmptyState
          title="Page not found"
          description="That address does not match any screen."
          action={
            <Link href="/">
              <Button variant="secondary">Back to start</Button>
            </Link>
          }
        />
      </div>
    </div>
  );
}