import { RequireSuperAdmin } from "@/components/auth/guards";
import { PlatformShell } from "@/components/layout/platform-shell";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireSuperAdmin>
      <PlatformShell>{children}</PlatformShell>
    </RequireSuperAdmin>
  );
}