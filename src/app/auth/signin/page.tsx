"use client";
import { Suspense, useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Route, ArrowRight, Shield, Zap, BarChart3 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";

// ─── Sphere palette (same as landing page) ───────────────────────────────────
const SPHERES = [
  {
    bg: "radial-gradient(circle at 35% 35%, #60a5fa, #4f46e5 60%, #312e81 100%)",
    shadow: "0 0 0 1px rgba(99,102,241,0.3), 0 4px 16px rgba(79,70,229,0.25)",
  },
  {
    bg: "radial-gradient(circle at 35% 35%, #5eead4, #059669 60%, #064e3b 100%)",
    shadow: "0 0 0 1px rgba(5,150,105,0.3), 0 4px 16px rgba(5,150,105,0.25)",
  },
  {
    bg: "radial-gradient(circle at 35% 35%, #c084fc, #7c3aed 60%, #3b0764 100%)",
    shadow: "0 0 0 1px rgba(124,58,237,0.3), 0 4px 16px rgba(124,58,237,0.25)",
  },
];

const features = [
  { icon: Shield, label: "Risk-first routing", text: "Every decision is scored and explainable", sphere: SPHERES[0] },
  { icon: Zap, label: "Operational speed", text: "Compare 3 routes in under 60 seconds", sphere: SPHERES[1] },
  { icon: BarChart3, label: "Audit trail", text: "Full dispatch history for compliance", sphere: SPHERES[2] },
];

function setSessionCookie(token: string) {
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `sr_session=${encodeURIComponent(token)}; path=/; expires=${expires}; SameSite=Lax`;
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/dashboard";

  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
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
      const token = await auth.currentUser!.getIdToken();
      setSessionCookie(token);
      router.push(redirectTo);
    } catch (err: unknown) {
      setLoading(false);
      const code = (err as { code?: string }).code ?? "";
      const message = (err as { message?: string }).message ?? "";
      if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setErrors({ form: "Invalid email or password" });
      } else if (code === "auth/too-many-requests") {
        setErrors({ form: "Too many attempts. Please try again later." });
      } else if (code === "auth/operation-not-allowed") {
        setErrors({ form: "Email/password sign-in is not enabled in Firebase Console." });
      } else if (code === "auth/invalid-api-key" || code === "auth/app-not-initialized") {
        setErrors({ form: `Firebase not configured. Check .env.local and restart. (${code})` });
      } else {
        setErrors({ form: `Error: ${code || message || "Unknown error."}` });
      }
    }
  };

  const handleGoogleSignIn = async () => {
    if (googleLoading || loading) return;
    setGoogleLoading(true);
    setErrors({});
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      const token = await auth.currentUser!.getIdToken();
      setSessionCookie(token);
      router.push(redirectTo);
    } catch (err: unknown) {
      setGoogleLoading(false);
      const code = (err as { code?: string }).code ?? "";
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
      if (code === "auth/popup-blocked") {
        setErrors({ form: "Pop-up was blocked. Allow pop-ups for this site and try again." });
      } else if (code === "auth/account-exists-with-different-credential") {
        setErrors({ form: "An account already exists with this email. Sign in with email and password instead." });
      } else {
        setErrors({ form: `Google sign-in failed. ${code || "Check browser console."}` });
      }
    }
  };

  return (
    <div className="min-h-screen flex bg-background">

      {/* ── Left panel ── */}
      <div className="hidden lg:flex w-[420px] shrink-0 flex-col justify-between bg-card border-r border-border p-10">
        <div>
          {/* Logo — sphere */}
          <div className="flex items-center gap-2.5 mb-12">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ background: SPHERES[0].bg, boxShadow: SPHERES[0].shadow }}
            >
              <Route className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-foreground tracking-tight">SentinelRoute</span>
          </div>

          <h2 className="text-2xl font-bold text-foreground leading-tight mb-3">
            Decision intelligence<br />for operations teams
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Not just tracking. Defensible routing decisions backed by risk intelligence.
          </p>

          {/* Feature list — each with its own sphere */}
          <div className="mt-8 space-y-5">
            {features.map(({ icon: Icon, label, text, sphere }) => (
              <div key={label} className="flex items-start gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: sphere.bg, boxShadow: sphere.shadow }}
                >
                  <Icon className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">{label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonial */}
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
          <p className="text-xs font-semibold text-foreground mb-1">
            &ldquo;Reduced route disruptions by 35% in Q1.&rdquo;
          </p>
          <p className="text-[10px] text-muted-foreground">— Fleet Operations Lead, Tier-1 Logistics Co.</p>
        </div>
      </div>

      {/* ── Right: form ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-sm"
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-6 lg:hidden">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
              style={{ background: SPHERES[0].bg, boxShadow: SPHERES[0].shadow }}
            >
              <Route className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-foreground">SentinelRoute</span>
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-1">Sign in</h1>
          <p className="text-sm text-muted-foreground mb-8">
            No account?{" "}
            <Link href="/auth/signup" className="text-foreground underline underline-offset-2 font-medium hover:opacity-80">
              Create one
            </Link>
          </p>

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
                className="h-10 bg-muted/20 border-border text-sm"
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
                  className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 disabled:opacity-50"
                >
                  {resetLoading ? "Sending..." : "Forgot password?"}
                </button>
              </div>
              <div className="relative">
                <Input
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  className="h-10 bg-muted/20 border-border text-sm pr-9"
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

            {/* Primary CTA — sphere button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 flex items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: SPHERES[0].bg, boxShadow: SPHERES[0].shadow }}
            >
              {loading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}
                  className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                />
              ) : (
                <>Sign In <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-border/60" />
            <span className="text-[11px] text-muted-foreground/60 uppercase tracking-widest shrink-0">or</span>
            <div className="flex-1 h-px bg-border/60" />
          </div>

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="w-full h-10 flex items-center justify-center gap-2.5 rounded-lg border border-border bg-muted/20 text-sm font-medium text-foreground hover:bg-muted/40 transition-colors disabled:opacity-50"
          >
            {googleLoading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}
                className="w-4 h-4 border-2 border-muted-foreground/30 border-t-foreground rounded-full"
              />
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </>
            )}
          </button>

          <div className="mt-6 pt-6 border-t border-border/40 text-center">
            <p className="text-xs text-muted-foreground">
              Or{" "}
              <Link href="/demo" className="text-foreground underline underline-offset-2 hover:opacity-80 font-medium">
                try the interactive demo
              </Link>{" "}
              — no login required
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
