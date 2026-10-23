
"use client";

import { useEffect } from "react";
import { useAuth } from "@/store/auth";

export function SessionGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const restore = useAuth((state) => state.restore);

  useEffect(() => {
    void restore();
  }, [restore]);

  return <>{children}</>;
}
