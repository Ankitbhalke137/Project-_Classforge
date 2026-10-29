"use client";

import { create } from "zustand";
import { api, authApi } from "@/lib/api";
import type { Membership, Role, User } from "@/types";

// sessionStorage, not localStorage: closing the tab signs you out.
const STORAGE_KEY = "classforge.session";

interface AuthState {
  user: User | null;
  schools: Membership[];
  /** The school slug the user has chosen to work in (set at login or via the school switcher). */
  activeSchoolSlug: string | null;
  /** The role the user has chosen inside the active school (when they hold multiple roles there). */
  activeRole: Role | null;
  /** False until sessionStorage has been read and /api/auth/me has validated the session. */
  ready: boolean;

  restore: () => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Pick which school + role to work in. Used by the login role selector and the school switcher. */
  setActiveContext: (schoolSlug: string | null, role: Role | null) => void;
  /** Clears the first-login flag after a successful password change. */
  passwordChanged: () => void;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  schools: [],
  activeSchoolSlug: null,
  activeRole: null,
  ready: false,

  // Called once on app start, before any guard makes a decision.
  // Reads the client copy for an instant paint, then validates the httpOnly
  // session cookie against /api/auth/me when there is saved session data to
  // validate. Avoids calling /api/auth/me on a cold load with no session,
  // which would return 401 and pollute the browser console.
  restore: async () => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      let restoredSchoolSlug: string | null = null;
      let restoredRole: Role | null = null;
      try {
        const { user, schools, activeSchoolSlug, activeRole } = JSON.parse(saved);
        restoredSchoolSlug = activeSchoolSlug ?? null;
        restoredRole = activeRole ?? null;
        set({ user, schools, activeSchoolSlug: restoredSchoolSlug, activeRole: restoredRole });
      } catch {
        // Malformed storage is ignored.
      }

      // Validate the saved session against the server. If the cookie is gone
      // or expired, clear the stale client copy.
      try {
        const { user: meUser, schools: meSchools } = await authApi.me();
        // Re-derive roles from memberships.
        const roles = meSchools.map((m) => m.role);
        const user = { ...meUser, roles };
        set({ user, schools: meSchools });

        // Read the context *now* rather than writing back the values captured
        // before `/me` was awaited. The school switcher may have changed it
        // while that request was in flight, and a slow response used to undo
        // the user's choice.
        const { activeSchoolSlug, activeRole } = get();
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ user, schools: meSchools, activeSchoolSlug, activeRole }),
        );
      } catch {
        sessionStorage.removeItem(STORAGE_KEY);
        set({ user: null, schools: [], activeSchoolSlug: null, activeRole: null });
      }
    }

    set({ ready: true });
  },

  login: async (email, password) => {
    const result = await authApi.login(email, password);
    // Re-derive roles from memberships for convenience.
    const roles = result.schools.map((m) => m.role);
    const userWithRoles = { ...result.user, roles };
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ user: userWithRoles, schools: result.schools, activeSchoolSlug: null, activeRole: null }),
    );
    set({ user: userWithRoles, schools: result.schools, activeSchoolSlug: null, activeRole: null });
  },

  logout: async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      sessionStorage.removeItem(STORAGE_KEY);
      set({ user: null, schools: [], activeSchoolSlug: null, activeRole: null, ready: true });
    }
  },

  setActiveContext: (schoolSlug, role) => {
    set((state) => {
      const next = { ...state, activeSchoolSlug: schoolSlug, activeRole: role };
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          user: state.user,
          schools: state.schools,
          activeSchoolSlug: schoolSlug,
          activeRole: role,
        }),
      );
      return next;
    });
  },

  passwordChanged: () => {
    set((state) => {
      if (!state.user) return state;
      const user = { ...state.user, mustChangePassword: false };
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ user, schools: state.schools, activeSchoolSlug: state.activeSchoolSlug, activeRole: state.activeRole }),
      );
      return { user };
    });
  },
}));
