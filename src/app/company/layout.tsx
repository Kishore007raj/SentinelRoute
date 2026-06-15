"use client";
/**
 * Company onboarding layout.
 * Minimal shell — no sidebar, no header. Just the page + brand mark.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/auth-context";
import { Route } from "lucide-react";
import { motion } from "framer-motion";

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth/signin");
    }
  }, [user, loading, router]);

  if (loading) {
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

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Brand bar */}
      <div className="h-14 border-b border-border flex items-center px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 border border-primary/30">
            <Route className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="font-semibold text-sm text-foreground tracking-tight">SentinelRoute</span>
        </div>
      </div>
      {children}
    </div>
  );
}
