"use client";

import { create } from "zustand";
import { api, authApi } from "@/lib/api";
import type { Membership, User } from "@/types";

// sessionStorage, not localStorage: closing the tab signs you out.
const STORAGE_KEY = "classforge.session";

interface AuthState {
  user: User | null;
  schools: Membership[];
  /** False until sessionStorage has been read and /api/auth/me has validated the session. */
  ready: boolean;

  restore: () => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Clears the first-login flag after a successful password change. */
  passwordChanged: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  schools: [],
  ready: false,

  // Called once on app start, before any guard makes a decision.
  // Reads the client copy for an instant paint, then validates the httpOnly
  // session cookie against /api/auth/me when there is saved session data to
  // validate. Avoids calling /api/auth/me on a cold load with no session,
  // which would return 401 and pollute the browser console.
  restore: async () => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const { user, schools } = JSON.parse(saved);
        set({ user, schools });
      } catch {
        // Malformed storage is ignored.
      }

      // Validate the saved session against the server. If the cookie is gone
      // or expired, clear the stale client copy.
      try {
        const { user: meUser, schools: meSchools } = await authApi.me();
        set({ user: meUser, schools: meSchools });
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ user: meUser, schools: meSchools }),
        );
      } catch {
        sessionStorage.removeItem(STORAGE_KEY);
        set({ user: null, schools: [] });
      }
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

  passwordChanged: () => {
    set((state) => {
      if (!state.user) return state;
      const user = { ...state.user, mustChangePassword: false };
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ user, schools: state.schools }),
      );
      return { user };
    });
  },
}));
