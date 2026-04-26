"use client";
/**
 * auth-context.tsx — Firebase Auth context with token refresh.
 *
 * Provides:
 *  - useUser()     → { user, loading }
 *  - UserProvider  → wraps the app, listens to onAuthStateChanged
 *
 * Token refresh strategy:
 *  - On sign-in: getIdToken(true) → write fresh token to sr_session cookie
 *  - Every 45 minutes: proactively refresh before the 1-hour expiry
 *  - On 401 from any API: force-refresh once, retry, then logout if still 401
 *
 * NOTE: Middleware only checks cookie presence (UI guard).
 * Auth is enforced at the API layer via getUserIdFromRequest().
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "./firebase";

// ─── Cookie helper ────────────────────────────────────────────────────────────

function writeSessionCookie(token: string) {
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `sr_session=${encodeURIComponent(token)}; path=/; expires=${expires}; SameSite=Lax`;
}

function clearSessionCookie() {
  document.cookie = "sr_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
}

// ─── Context shape ────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  /**
   * Force-refresh the Firebase ID token and update the session cookie.
   * Returns the fresh token string, or null if the user is signed out.
   */
  refreshToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  refreshToken: async () => null,
});

// ─── Refresh interval — 45 minutes ───────────────────────────────────────────
const REFRESH_INTERVAL_MS = 45 * 60 * 1000;

// ─── Provider ─────────────────────────────────────────────────────────────────

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refresh the token and update the cookie. Returns the fresh token or null.
  const refreshToken = async (): Promise<string | null> => {
    const currentUser = auth.currentUser;
    if (!currentUser) return null;
    try {
      const token = await currentUser.getIdToken(/* forceRefresh */ true);
      writeSessionCookie(token);
      return token;
    } catch (err) {
      console.error("[auth] Token refresh failed:", err);
      return null;
    }
  };

  // Start the 45-minute proactive refresh timer.
  const startRefreshTimer = () => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    refreshTimerRef.current = setInterval(async () => {
      const token = await refreshToken();
      if (!token) {
        // Refresh failed — user session is broken, force sign-out
        console.warn("[auth] Proactive refresh failed — signing out");
        clearSessionCookie();
        await signOut(auth).catch(() => {});
      }
    }, REFRESH_INTERVAL_MS);
  };

  const stopRefreshTimer = () => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  };

  useEffect(() => {
    // Guard: if auth has no app attached it's a stub (SSR without env vars)
    if (!auth.app) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);

      if (firebaseUser) {
        // Write a fresh token on every sign-in / auth state resolution
        try {
          const token = await firebaseUser.getIdToken(true);
          writeSessionCookie(token);
        } catch {
          // Non-fatal — token will be refreshed on next API call
        }
        startRefreshTimer();
      } else {
        clearSessionCookie();
        stopRefreshTimer();
      }
    });

    return () => {
      unsubscribe();
      stopRefreshTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refreshToken }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useUser(): AuthContextValue {
  return useContext(AuthContext);
}
