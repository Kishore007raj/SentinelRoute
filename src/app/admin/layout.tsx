"use client";
/**
 * Admin layout — requires super_admin role.
 * Renders a minimal top-nav admin shell.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Route, Shield, LogOut } from "lucide-react";
import { useUser } from "@/lib/auth-context";
import { useCompany } from "@/lib/company-context";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading: authLoading } = useUser();
  const { isSuperAdmin, status } = useCompany();

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.replace("/auth/signin");
        return;
      }
      if (status !== "loading" && !isSuperAdmin) {
        router.replace("/dashboard");
      }
    }
  }, [user, authLoading, isSuperAdmin, status, router]);

  const handleSignOut = async () => {
    await signOut(auth);
    document.cookie = "sr_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push("/auth/signin");
  };

  if (authLoading || status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
          className="w-8 h-8 border-2 border-border border-t-primary rounded-full"
        />
      </div>
    );
  }

  if (!user || !isSuperAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Admin header */}
      <div className="h-14 border-b border-border flex items-center justify-between px-6 bg-card">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 border border-primary/30">
              <Route className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="font-semibold text-sm text-foreground tracking-tight">SentinelRoute</span>
          </div>
          <div className="h-4 w-px bg-border mx-1" />
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-widest">Super Admin</span>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>
      {children}
    </div>
  );
}
