"use client";

import { useEffect } from "react";
import { useAuth } from "@/store/auth";

/**
 * Reads the saved session out of sessionStorage once on start-up, before any
 * guard makes a decision. Wrapping the app in this is the whole "auth state"
 * set-up: sign in writes the store, sign out clears it, guards read it.
 */
export function SessionGate({ children }: { children: React.ReactNode }) {
  const restore = useAuth((state) => state.restore);

  useEffect(() => {
    restore();
  }, [restore]);

  return <>{children}</>;
}