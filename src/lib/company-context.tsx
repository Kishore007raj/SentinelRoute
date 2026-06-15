"use client";
/**
 * company-context.tsx — Company workspace context for Module 1.
 *
 * Loads the authenticated user's company record and user profile.
 * All operational pages read companyId from this context to scope queries.
 *
 * Flow:
 *   1. User signs in → fetch /api/company/me
 *   2. No company record found → status = "none" (route to /company/register)
 *   3. Company found with status "pending" → route to /company/pending
 *   4. Company found with status "approved" → proceed to workspace
 *   5. Company found with status "rejected" → route to /company/rejected
 *   6. Company found with status "suspended" → route to /company/pending (suspended view)
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type { Company, UserRecord } from "./types";
import { useUser } from "./auth-context";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CompanyLoadStatus = "loading" | "none" | "pending" | "approved" | "rejected" | "suspended";

interface CompanyContextValue {
  company:        Company | null;
  userRecord:     UserRecord | null;
  status:         CompanyLoadStatus;
  isSuperAdmin:   boolean;
  refresh:        () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const CompanyContext = createContext<CompanyContextValue>({
  company:      null,
  userRecord:   null,
  status:       "loading",
  isSuperAdmin: false,
  refresh:      async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useUser();

  const [company,    setCompany]    = useState<Company | null>(null);
  const [userRecord, setUserRecord] = useState<UserRecord | null>(null);
  const [status,     setStatus]     = useState<CompanyLoadStatus>("loading");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const fetchCompanyData = useCallback(async () => {
    if (!user) {
      setCompany(null);
      setUserRecord(null);
      setStatus("none");
      setIsSuperAdmin(false);
      return;
    }

    setStatus("loading");

    try {
      const token = await user.getIdToken();
      const res   = await fetch("/api/company/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 404) {
        // User has no company record yet
        setCompany(null);
        setUserRecord(null);
        setStatus("none");
        setIsSuperAdmin(false);
        return;
      }

      if (!res.ok) throw new Error(`API ${res.status}`);

      const data = await res.json();

      setCompany(data.company ?? null);
      setUserRecord(data.userRecord ?? null);
      setIsSuperAdmin(data.userRecord?.role === "super_admin");

      const companyStatus = data.company?.status ?? "none";
      setStatus(
        data.userRecord?.role === "super_admin"
          ? "approved"          // super_admins are always "in"
          : (companyStatus as CompanyLoadStatus)
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // 503 = firebase admin not configured (dev mode) — don't block the app
      if (msg.includes("503")) {
        setStatus("none");
      } else {
        console.error("[company-context] fetch error:", err);
        setStatus("none");
      }
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      fetchCompanyData();
    }
  }, [authLoading, fetchCompanyData]);

  const refresh = useCallback(async () => {
    await fetchCompanyData();
  }, [fetchCompanyData]);

  return (
    <CompanyContext.Provider value={{
      company,
      userRecord,
      status,
      isSuperAdmin,
      refresh,
    }}>
      {children}
    </CompanyContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCompany(): CompanyContextValue {
  return useContext(CompanyContext);
}
