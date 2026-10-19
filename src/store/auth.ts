
"use client";

import { create } from "zustand";
import { authApi, MOCKS_ENABLED } from "@/lib/api";
import type { Membership, User } from "@/types";

interface AuthState {
  user: User | null;
  schools: Membership[];
  ready: boolean;
  restore: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  schools: [],
  ready: false,

  restore: async () => {
    try {
      if (MOCKS_ENABLED) {
        set({ ready: true });
        return;
      }

      const session = await authApi.me();

      set({
        user: session.user,
        schools: session.schools,
        ready: true,
      });
    } catch {
      set({
        user: null,
        schools: [],
        ready: true,
      });
    }
  },

  login: async (email, password) => {
    const result = await authApi.login(email, password);

    set({
      user: result.user,
      schools: result.schools,
      ready: true,
    });
  },

  logout: async () => {
    try {
      if (!MOCKS_ENABLED) {
        await authApi.logout();
      }
    } finally {
      set({
        user: null,
        schools: [],
        ready: true,
      });
    }
  },
}));
