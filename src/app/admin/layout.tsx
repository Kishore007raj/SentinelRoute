"use client";
/**
 * Admin layout — requires super_admin role.
 * Renders a complete enterprise admin shell with sidebar and header.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useUser } from "@/lib/auth-context";
import { useCompany } from "@/lib/company-context";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { AdminHeader } from "@/components/layout/AdminHeader";
import { PageTransition } from "@/components/layout/PageTransition";

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

  if (authLoading || status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
          className="w-8 h-8 border-2 border-border border-t-amber-500 rounded-full"
        />
      </div>
    );
  }

  if (!user || !isSuperAdmin) return null;

  return (
    <SidebarProvider defaultOpen={true}>
      <AdminSidebar />
      <SidebarInset>
        <AdminHeader />
        <main className="flex-1 min-h-0 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12 overflow-x-hidden bg-background">
          <PageTransition>{children}</PageTransition>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
