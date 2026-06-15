"use client";
/**
 * /company/rejected
 *
 * Shown when a company application is rejected.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { XCircle, LogOut, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useCompany } from "@/lib/company-context";

export default function CompanyRejectedPage() {
  const router = useRouter();
  const { company, status } = useCompany();

  useEffect(() => {
    if (status === "approved") router.replace("/dashboard");
    if (status === "pending")  router.replace("/company/pending");
    if (status === "none")     router.replace("/company/register");
  }, [status, router]);

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
        <div className="flex items-center justify-center mb-6">
          <div className="w-16 h-16 rounded-full flex items-center justify-center bg-red-400/10 border border-red-400/20">
            <XCircle className="w-7 h-7 text-red-400" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">Application Not Approved</h1>
        <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
          Unfortunately, your company application could not be approved at this time.
          Please review the information you submitted and contact us for clarification.
        </p>

        {company && (
          <div className="bg-muted/10 border border-border rounded-xl p-4 mb-8 text-left">
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-3">Application</p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Company</span>
                <span className="font-medium text-foreground">{company.companyName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium text-red-400">Rejected</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Submitted</span>
                <span className="font-medium text-foreground">
                  {new Date(company.createdAt).toLocaleDateString("en-IN", {
                    day: "2-digit", month: "short", year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="bg-card border border-border rounded-xl p-5 mb-8 text-left">
          <p className="text-sm font-medium text-foreground mb-1">What happens next?</p>
          <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
            <li>Review your submitted documents for accuracy</li>
            <li>Contact our team to understand the rejection reason</li>
            <li>Re-submit with updated documents if applicable</li>
          </ul>
        </div>

        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            className="gap-2 h-10 px-5"
            onClick={() => window.open("mailto:support@sentinelroute.com", "_blank")}
          >
            <Mail className="w-4 h-4" />
            Contact Support
          </Button>
          <Button
            variant="outline"
            className="gap-2 h-10 px-5"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
