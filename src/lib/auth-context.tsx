"use client";
/**
 * auth-context.tsx — Firebase Auth context.
 *
 * Provides:
 *  - useUser()  → { user, loading }
 *  - UserProvider  → wraps the app, listens to onAuthStateChanged
 *
 * Usage:
 *   const { user, loading } = useUser();
 *   if (loading) return <Spinner />;
 *   if (!user) redirect("/auth/signin");
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "./firebase";

// ─── Context shape ────────────────────────────────────────────────────────────

interface AuthContextValue {
  /** The currently signed-in Firebase user, or null if signed out. */
  user: User | null;
  /** True while the initial auth state is being resolved. */
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Guard: if auth has no app attached it's a stub (SSR without env vars)
    if (!auth.app) {
      setLoading(false);
      return;
    }

    // Subscribe to Firebase auth state changes
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    // Cleanup on unmount
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useUser(): AuthContextValue {
  return useContext(AuthContext);
}
