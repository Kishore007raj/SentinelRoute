"use client";
/**
 * (app)/layout.tsx — Protected app shell.
 *
 * Checks Firebase auth state via useUser().
 * Then checks company verification state via useCompany().
 *
 * - Loading → full-screen spinner
 * - Not authenticated → redirect to /auth/signin
 * - Authenticated, super_admin → allow access
 * - Authenticated, no company → redirect to /company/register
 * - Authenticated, company pending → redirect to /company/pending
 * - Authenticated, company rejected → redirect to /company/rejected
 * - Authenticated, company suspended → redirect to /company/pending
 * - Authenticated, company approved → render sidebar + header + content
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/auth-context";
import { useCompany } from "@/lib/company-context";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { PageTransition } from "@/components/layout/PageTransition";
import { motion } from "framer-motion";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useUser();
  const { status: companyStatus, isSuperAdmin } = useCompany();
  const router = useRouter();

  const isLoading = authLoading || companyStatus === "loading";

  useEffect(() => {
    if (isLoading) return;

    // Not authenticated → sign in
    if (!user) { router.replace("/auth/signin"); return; }

    // Super admins bypass all company checks
    if (isSuperAdmin) return;

    // Company checks
    if (companyStatus === "none")      { router.replace("/company/register"); return; }
    if (companyStatus === "pending")   { router.replace("/company/pending");  return; }
    if (companyStatus === "rejected")  { router.replace("/company/rejected"); return; }
    if (companyStatus === "suspended") { router.replace("/company/pending");  return; }
  }, [user, isLoading, companyStatus, isSuperAdmin, router]);

  // ── Loading state ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
            className="w-8 h-8 border-2 border-border border-t-primary rounded-full"
          />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // ── Not ready — render nothing while redirect fires ──────────────────────
  if (!user) return null;
  if (!isSuperAdmin && companyStatus !== "approved") return null;

  // ── Authenticated + approved — render app shell ──────────────────────────
  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <div className="flex-1 overflow-auto px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
          <PageTransition>{children}</PageTransition>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
