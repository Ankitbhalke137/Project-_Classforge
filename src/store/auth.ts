"use client";

import { create } from "zustand";
import { api, authApi } from "@/lib/api";
import type { Membership, User } from "@/types";

// sessionStorage, not localStorage: closing the tab signs you out.
const STORAGE_KEY = "classforge.session";

interface AuthState {
  user: User | null;
  schools: Membership[];
  /** False until sessionStorage has been read. Guards wait for this. */
  ready: boolean;

  restore: () => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  schools: [],
  ready: false,

  // Called once on app start, before any guard makes a decision.
  restore: () => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      const { user, schools } = JSON.parse(saved);
      set({ user, schools });
    }
    set({ ready: true });
  },

  login: async (email, password) => {
    const result = await authApi.login(email, password);
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ user: result.user, schools: result.schools }),
    );
    set({ user: result.user, schools: result.schools });
  },

  logout: async () => {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } finally {
    sessionStorage.removeItem(STORAGE_KEY);
    set({ user: null, schools: [], ready: true });
  }
},
}));