"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FullPageLoader } from "@/components/ui/states";
import { useAuth } from "@/store/auth";

export default function RootParentsPage() {
  const router = useRouter();
  const ready = useAuth((state) => state.ready);
  const user = useAuth((state) => state.user);
  const schools = useAuth((state) => state.schools);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login?next=/parents");
      return;
    }
    const firstSchool = schools[0];
    if (firstSchool) {
      router.replace(`/${firstSchool.schoolSlug}/parents`);
    } else {
      router.replace("/no-access");
    }
  }, [ready, user, schools, router]);

  return <FullPageLoader label="Opening Parent Portal…" />;
}
