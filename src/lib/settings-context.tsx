"use client";
/**
 * settings-context.tsx — Global user settings.
 * Loads from /api/settings on auth, persists via POST /api/settings.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { UserSettings } from "./types";
import { DEFAULT_SETTINGS } from "./types";
import { useUser } from "./auth-context";

interface SettingsContextValue {
  settings: UserSettings | null;
  loading:  boolean;
  save:     (patch: Partial<Omit<UserSettings, "userId" | "updatedAt">>) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: null,
  loading:  true,
  save:     async () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading]   = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!user) { setSettings(null); setLoading(false); return; }
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/settings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      setSettings(data.settings);
    } catch (err) {
      // 503 = Firebase Admin not configured (expected in dev without service account).
      // Fall back to defaults so the app remains fully usable.
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("503")) {
        console.error("[settings] Failed to load:", err);
      }
      setSettings({
        ...DEFAULT_SETTINGS,
        userId:    user.uid,
        updatedAt: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const save = useCallback(
    async (patch: Partial<Omit<UserSettings, "userId" | "updatedAt">>) => {
      if (!user) return;
      // Optimistic update
      setSettings((prev) =>
        prev ? { ...prev, ...patch, updatedAt: new Date().toISOString() } : prev
      );
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/settings", {
          method:  "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body:    JSON.stringify(patch),
        });
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data = await res.json();
        setSettings(data.settings);
      } catch (err) {
        console.error("[settings] Failed to save:", err);
        // Revert optimistic update on failure
        await fetchSettings();
        throw err;
      }
    },
    [user, fetchSettings]
  );

  return (
    <SettingsContext.Provider value={{ settings, loading, save }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}
