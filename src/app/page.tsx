"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FullPageLoader } from "@/components/ui/states";
import { landingPath } from "@/lib/nav";
import { useAuth } from "@/store/auth";

/** The front door. Sends whoever you are to the right first screen. */
export default function IndexPage() {
  const router = useRouter();
  const ready = useAuth((state) => state.ready);
  const user = useAuth((state) => state.user);
  const schools = useAuth((state) => state.schools);

  useEffect(() => {
    if (ready) router.replace(landingPath(user, schools));
  }, [ready, user, schools, router]);

  return <FullPageLoader label="Opening ClassForge…" />;
}