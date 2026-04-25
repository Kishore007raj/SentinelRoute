"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Route, ArrowRight, Shield, Zap, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";

const features = [
  { icon: Shield, label: "Risk-first routing", text: "Every decision is scored and explainable" },
  { icon: Zap, label: "Operational speed", text: "Compare 3 routes in under 60 seconds" },
  { icon: BarChart3, label: "Audit trail", text: "Full dispatch history for compliance" },
];

// Session cookie helpers — read by middleware for route protection
function setSessionCookie() {
  // 7-day session
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `sr_session=1; path=/; expires=${expires}; SameSite=Lax`;
}

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/dashboard";

  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ email: "", password: "" });

  const handleForgotPassword = async () => {
    if (!form.email || !/\S+@\S+\.\S+/.test(form.email)) {
      setErrors({ email: "Enter your email address first" });
      return;
    }
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, form.email);
      toast.success("Reset email sent", {
        description: `Check ${form.email} for a password reset link.`,
      });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      if (code === "auth/user-not-found") {
        // Don't reveal whether the email exists — show same success message
        toast.success("Reset email sent", {
          description: `If an account exists for ${form.email}, a reset link has been sent.`,
        });
      } else {
        toast.error("Could not send reset email", {
          description: "Please try again or contact support.",
        });
      }
    } finally {
      setResetLoading(false);
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.email) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Enter a valid email";
    if (!form.password) e.password = "Password is required";
    if (form.password && form.password.length < 6) e.password = "Password must be at least 6 characters";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, form.email, form.password);
      setSessionCookie();
      router.push(redirectTo);
    } catch (err: unknown) {
      setLoading(false);
      const code = (err as { code?: string }).code ?? "";
      const message = (err as { message?: string }).message ?? "";
      console.error("[signin] Firebase error:", code, message);

      if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setErrors({ form: "Invalid email or password" });
      } else if (code === "auth/too-many-requests") {
        setErrors({ form: "Too many attempts. Please try again later." });
      } else if (code === "auth/operation-not-allowed") {
        setErrors({ form: "Email/password sign-in is not enabled in Firebase Console." });
      } else if (code === "auth/invalid-api-key" || code === "auth/app-not-initialized") {
        setErrors({ form: `Firebase not configured. Check .env.local and restart. (${code})` });
      } else {
        setErrors({ form: `Error: ${code || message || "Unknown error. Check browser console."}` });
      }
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel */}
      <div className="hidden lg:flex w-[420px] shrink-0 flex-col justify-between bg-card border-r border-border p-10">
        <div>
          <div className="flex items-center gap-2.5 mb-12">
            <div className="w-8 h-8 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center">
              <Route className="w-4 h-4 text-primary" />
            </div>
            <span className="font-bold text-foreground tracking-tight">SentinelRoute</span>
          </div>
          <h2 className="text-2xl font-bold text-foreground leading-tight mb-3">
            Decision intelligence<br />for operations teams
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Not just tracking. Defensible routing decisions backed by risk intelligence.
          </p>
          <div className="mt-8 space-y-5">
            {features.map(({ icon: Icon, label, text }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-3.5 h-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">{label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="panel p-4 bg-muted/20">
          <p className="text-xs font-semibold text-foreground mb-1">"Reduced route disruptions by 35% in Q1."</p>
          <p className="text-[10px] text-muted-foreground">— Fleet Operations Lead, Tier-1 Logistics Co.</p>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-sm"
        >
          <div className="flex items-center gap-2 mb-1 lg:hidden">
            <Route className="w-5 h-5 text-primary" />
            <span className="font-bold text-foreground">SentinelRoute</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Sign in</h1>
          <p className="text-sm text-muted-foreground mb-8">
            No account?{" "}
            <Link href="/auth/signup" className="text-primary hover:underline font-medium">
              Create one
            </Link>
          </p>

          {/* Form-level error */}
          {errors.form && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-400/10 border border-red-400/20 text-sm text-red-400">
              {errors.form}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Email</Label>
              <Input
                type="email"
                placeholder="you@company.com"
                className="h-9 bg-muted/20 border-border text-sm"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                autoComplete="email"
              />
              {errors.email && <p className="text-[11px] text-red-400">{errors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Password</Label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={resetLoading}
                  className="text-[11px] text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resetLoading ? "Sending..." : "Forgot password?"}
                </button>
              </div>
              <div className="relative">
                <Input
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  className="h-9 bg-muted/20 border-border text-sm pr-9"
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-[11px] text-red-400">{errors.password}</p>}
            </div>

            <Button type="submit" className="w-full h-9 text-sm font-semibold gap-2" disabled={loading}>
              {loading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}
                  className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
                />
              ) : (
                <>Sign In <ArrowRight className="w-4 h-4" /></>
              )}
            </Button>
          </form>

          <Separator className="my-6 opacity-30" />
          <p className="text-center text-xs text-muted-foreground">
            Or{" "}
            <Link href="/demo" className="text-primary hover:underline font-medium">
              try the interactive demo
            </Link>{" "}
            — no login required
          </p>
        </motion.div>
      </div>
    </div>
  );
}
