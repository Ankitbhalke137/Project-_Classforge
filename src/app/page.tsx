"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FullPageLoader } from "@/components/ui/states";
import { landingPath } from "@/lib/nav";
import { useAuth } from "@/store/auth";
import { Modal } from "@/components/ui/modal";
import { ChangePasswordForm } from "@/components/settings/change-password-form";

/** The front door. Sends whoever you are to the right first screen. */
export default function IndexPage() {
  const router = useRouter();
  const ready = useAuth((state) => state.ready);
  const user = useAuth((state) => state.user);
  const schools = useAuth((state) => state.schools);

  useEffect(() => {
    if (!ready) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    // First-time login: force a password change before reaching any screen.
    if (user.mustChangePassword) return;

    router.replace(landingPath(user, schools));
  }, [ready, user, schools, router]);

  if (!ready) return <FullPageLoader label="Opening ClassForge…" />;
  if (!user) return <FullPageLoader label="Checking your session…" />;

  if (user.mustChangePassword) {
    return (
      <Modal
        open
        onClose={() => {}}
        title="Change your password"
        description="This is your first sign in. Set a new password before you can use ClassForge."
      >
        <ChangePasswordForm
          onSuccess={() => {
            const { user: currentUser, schools: currentSchools } =
              useAuth.getState();
            router.replace(landingPath(currentUser, currentSchools));
          }}
        />
      </Modal>
    );
  }

  return <FullPageLoader label="Opening ClassForge…" />;
}
