"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogoutIcon } from "@/components/ui/icons";
import { useAuth } from "@/store/auth";

export function SignOutButton() {
  const router = useRouter();
  const logout = useAuth((state) => state.logout);

  return (
    <Button
      variant="secondary"
      leftIcon={<LogoutIcon />}
      onClick={() => {
        logout();
        router.replace("/login");
      }}
    >
      Sign out
    </Button>
  );
}