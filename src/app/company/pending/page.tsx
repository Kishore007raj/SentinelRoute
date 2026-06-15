"use client";
/**
 * /company/pending
 *
 * Blocks access while the company is awaiting super admin verification.
 * Also handles "suspended" status.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Clock, CheckCircle2, FileText, ShieldCheck, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useCompany } from "@/lib/company-context";

export default function CompanyPendingPage() {
  const router = useRouter();
  const { company, status } = useCompany();

  useEffect(() => {
    if (status === "approved")  router.replace("/dashboard");
    if (status === "rejected")  router.replace("/company/rejected");
    if (status === "none")      router.replace("/company/register");
  }, [status, router]);

  const isSuspended = status === "suspended" || company?.status === "suspended";

  const handleSignOut = async () => {
    await signOut(auth);
    document.cookie = "sr_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push("/auth/signin");
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-16 flex flex-col items-center text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full"
      >
        {/* Icon */}
        <div className="flex items-center justify-center mb-6">
          <div className={[
            "w-16 h-16 rounded-full flex items-center justify-center",
            isSuspended
              ? "bg-red-400/10 border border-red-400/20"
              : "bg-amber-400/10 border border-amber-400/20",
          ].join(" ")}>
            <Clock className={["w-7 h-7", isSuspended ? "text-red-400" : "text-amber-400"].join(" ")} />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">
          {isSuspended ? "Account Suspended" : "Application Submitted"}
        </h1>
        <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
          {isSuspended
            ? "Your company account has been suspended. Please contact SentinelRoute support for assistance."
            : "Your verification documents are under review. Our team will process your application within 1–2 business days."}
        </p>

        {!isSuspended && (
          <div className="bg-card border border-border rounded-xl p-6 mb-8 text-left space-y-4">
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Verification Status</p>

            {[
              {
                icon: CheckCircle2,
                label: "Application Submitted",
                sub:   "Company details received",
                done:  true,
              },
              {
                icon: FileText,
                label: "Documents Received",
                sub:   "All required files uploaded",
                done:  true,
              },
              {
                icon: Clock,
                label: "Awaiting Verification",
                sub:   "Under review by our team",
                done:  false,
              },
              {
                icon: ShieldCheck,
                label: "Workspace Activation",
                sub:   "Access granted on approval",
                done:  false,
              },
            ].map(({ icon: Icon, label, sub, done }) => (
              <div key={label} className="flex items-center gap-4">
                <div className={[
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                  done ? "bg-emerald-400/10 border border-emerald-400/20" : "bg-muted/20 border border-border",
                ].join(" ")}>
                  <Icon className={["w-4 h-4", done ? "text-emerald-400" : "text-muted-foreground/40"].join(" ")} />
                </div>
                <div>
                  <p className={["text-sm font-medium", done ? "text-foreground" : "text-muted-foreground"].join(" ")}>
                    {label}
                  </p>
                  <p className="text-xs text-muted-foreground">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {company && (
          <div className="bg-muted/10 border border-border rounded-xl p-4 mb-8 text-left">
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3">Submitted Application</p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Company</span>
                <span className="font-medium text-foreground">{company.companyName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium text-foreground">{company.companyType}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium text-amber-400 capitalize">{company.status}</span>
              </div>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground mb-6">
          You will receive an email notification when your application is reviewed.
        </p>

        <Button
          variant="outline"
          className="gap-2 h-10 px-6"
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </motion.div>
    </div>
  );
}
