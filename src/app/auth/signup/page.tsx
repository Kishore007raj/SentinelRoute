"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Eye, EyeOff, Route, ArrowRight,
  CheckCircle, Shield, Zap, BarChart3,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { cn } from "@/lib/utils";

// ─── Sphere palette (same as landing + signin) ────────────────────────────────
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
  {
    bg: "radial-gradient(circle at 35% 35%, #fcd34d, #ea580c 60%, #7c2d12 100%)",
    shadow: "0 0 0 1px rgba(234,88,12,0.3), 0 4px 16px rgba(234,88,12,0.25)",
  },
];


const STEPS = ["Account", "Company", "Review"];

function setSessionCookie(token: string) {
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `sr_session=${encodeURIComponent(token)}; path=/; expires=${expires}; SameSite=Lax`;
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function Spinner({ light = false }: { light?: boolean }) {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}
      className={cn(
        "w-4 h-4 border-2 rounded-full",
        light ? "border-white/30 border-t-white" : "border-muted-foreground/30 border-t-foreground",
      )}
    />
  );
}

// ─── Step bubble helper — avoids duplicate className ─────────────────────────
function StepBubble({
  index, current, size = "md",
}: {
  index: number; current: number; size?: "sm" | "md";
}) {
  const done = index < current;
  const active = index === current;
  const dim = size === "sm" ? "w-5 h-5" : "w-6 h-6";
  const iconSize = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";
  const textSize = size === "sm" ? "text-[10px]" : "text-[11px]";

  const inlineStyle = done
    ? { background: SPHERES[1].bg, boxShadow: SPHERES[1].shadow }
    : active
    ? { background: SPHERES[0].bg, boxShadow: SPHERES[0].shadow }
    : undefined;

  return (
    <div
      className={cn(
        dim,
        "rounded-full flex items-center justify-center shrink-0 font-bold",
        !done && !active && "border border-border bg-muted/20",
      )}
      style={inlineStyle}
    >
      {done ? (
        <CheckCircle className={cn(iconSize, "text-white")} />
      ) : (
        <span className={cn(textSize, active ? "text-white" : "text-muted-foreground")}>
          {index + 1}
        </span>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SignUpPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    email: "", password: "",
    companyName: "", companyType: "", operationalLevel: "",
  });

  const set = (key: string, val: string) => setForm((p) => ({ ...p, [key]: val }));

  const validateStep0 = () => {
    const e: Record<string, string> = {};
    if (!form.email) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Enter a valid email";
    if (!form.password || form.password.length < 8) e.password = "Min 8 characters";
    return e;
  };

  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (!form.companyName) e.companyName = "Required";
    if (!form.companyType) e.companyType = "Required";
    if (!form.operationalLevel) e.operationalLevel = "Required";
    return e;
  };

  const handleNext = () => {
    const errs = step === 0 ? validateStep0() : validateStep1();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setStep((s) => s + 1);
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
      router.push("/dashboard");
    } catch (err: unknown) {
      setGoogleLoading(false);
      const code = (err as { code?: string }).code ?? "";
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
      if (code === "auth/popup-blocked") {
        setErrors({ form: "Pop-up was blocked. Allow pop-ups for this site and try again." });
      } else if (code === "auth/account-exists-with-different-credential") {
        setErrors({ form: "An account already exists with this email. Sign in instead." });
      } else {
        setErrors({ form: `Google sign-in failed. ${code || "Check browser console."}` });
      }
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setErrors({});
    try {
      const credential = await createUserWithEmailAndPassword(auth, form.email, form.password);
      await updateProfile(credential.user, {
        displayName: `${form.companyName} (${form.operationalLevel})`,
      });
      const token = await credential.user.getIdToken();
      setSessionCookie(token);
      router.push("/dashboard");
    } catch (err: unknown) {
      setLoading(false);
      const code = (err as { code?: string }).code ?? "";
      const message = (err as { message?: string }).message ?? "";
      if (code === "auth/email-already-in-use") {
        setErrors({ form: "An account with this email already exists." }); setStep(0);
      } else if (code === "auth/weak-password") {
        setErrors({ password: "Password is too weak. Use at least 8 characters." }); setStep(0);
      } else if (code === "auth/invalid-api-key" || code === "auth/app-not-initialized") {
        setErrors({ form: `Firebase not configured. Check .env.local and restart. (${code})` });
      } else if (code === "auth/network-request-failed") {
        setErrors({ form: "Network error. Check your internet connection." });
      } else if (code === "auth/operation-not-allowed") {
        setErrors({ form: "Email/password sign-up is not enabled in Firebase Console." });
      } else {
        setErrors({ form: `Error: ${code || message || "Unknown error."}` });
      }
    }
  };

  return (
    <div className="min-h-screen flex bg-background">

      {/* ── Left panel ── */}
      <div className="hidden lg:flex w-[420px] shrink-0 flex-col justify-between bg-card border-r border-border p-10">
        <div>
          {/* Logo */}
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
            Join operations teams<br />who route with confidence
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Set up your account in 2 minutes. Start analyzing routes immediately.
          </p>


          {/* Step progress */}
          <div className="mt-10 space-y-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-4">
              Setup progress
            </p>
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-3">
                <StepBubble index={i} current={step} />
                <span className={cn(
                  "text-sm",
                  i === step ? "text-foreground font-semibold" : "text-muted-foreground",
                )}>
                  {s}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonial */}
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
          <p className="text-xs font-semibold text-foreground mb-1">
            &ldquo;Reduced route disruptions by 35% in Q1.&rdquo;
          </p>
          <p className="text-[10px] text-muted-foreground">
            — Fleet Operations Lead, Tier-1 Logistics Co.
          </p>
        </div>
      </div>

      {/* ── Right: form ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
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

          {/* Mobile step dots */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <StepBubble index={i} current={step} size="sm" />
                {i < STEPS.length - 1 && (
                  <div
                    className={cn("h-px w-8", i >= step ? "bg-border" : "")}
                    style={i < step ? { background: SPHERES[1].bg } : undefined}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Form-level error */}
          {errors.form && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-400/10 border border-red-400/20 text-sm text-red-400">
              {errors.form}
            </div>
          )}

          {/* ── Step 0: Account ── */}
          {step === 0 && (
            <>
              <h1 className="text-2xl font-bold text-foreground mb-1">Create account</h1>
              <p className="text-sm text-muted-foreground mb-8">
                Already have one?{" "}
                <Link
                  href="/auth/signin"
                  className="text-foreground underline underline-offset-2 font-medium hover:opacity-80"
                >
                  Sign in
                </Link>
              </p>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <Input
                    type="email"
                    placeholder="you@company.com"
                    className="h-10 bg-muted/20 border-border text-sm"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    autoComplete="email"
                  />
                  {errors.email && <p className="text-[11px] text-red-400">{errors.email}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Password</Label>
                  <div className="relative">
                    <Input
                      type={showPass ? "text" : "password"}
                      placeholder="Min 8 characters"
                      className="h-10 bg-muted/20 border-border text-sm pr-9"
                      value={form.password}
                      onChange={(e) => set("password", e.target.value)}
                      autoComplete="new-password"
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

                <button
                  type="button"
                  onClick={handleNext}
                  className="w-full h-10 flex items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: SPHERES[0].bg, boxShadow: SPHERES[0].shadow }}
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </button>

                <div className="relative flex items-center gap-3">
                  <div className="flex-1 h-px bg-border/60" />
                  <span className="text-[11px] text-muted-foreground/60 uppercase tracking-widest shrink-0">or</span>
                  <div className="flex-1 h-px bg-border/60" />
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading || loading}
                  className="w-full h-10 flex items-center justify-center gap-2.5 rounded-lg border border-border bg-muted/20 text-sm font-medium text-foreground hover:bg-muted/40 transition-colors disabled:opacity-50"
                >
                  {googleLoading ? <Spinner /> : <><GoogleIcon /> Continue with Google</>}
                </button>
              </div>
            </>
          )}

          {/* ── Step 1: Company ── */}
          {step === 1 && (
            <>
              <h1 className="text-2xl font-bold text-foreground mb-1">Company details</h1>
              <p className="text-sm text-muted-foreground mb-8">Tell us about your operation</p>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Company Name</Label>
                  <Input
                    placeholder="FleetCo Logistics"
                    className="h-10 bg-muted/20 border-border text-sm"
                    value={form.companyName}
                    onChange={(e) => set("companyName", e.target.value)}
                  />
                  {errors.companyName && <p className="text-[11px] text-red-400">{errors.companyName}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Company Type</Label>
                  <Select
                    value={form.companyType}
                    onValueChange={(v) => { if (v) set("companyType", v); }}
                  >
                    <SelectTrigger className="h-10 bg-muted/20 border-border text-sm">
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {["3PL Provider", "E-Commerce Fulfillment", "Freight & Logistics", "Cold Chain", "Industrial Supply"].map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.companyType && <p className="text-[11px] text-red-400">{errors.companyType}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Operational Level</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["Regional", "National", "Enterprise"] as const).map((lvl, li) => {
                      const isSelected = form.operationalLevel === lvl;
                      return (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => set("operationalLevel", lvl)}
                          className={cn(
                            "py-2.5 rounded-lg border text-xs font-semibold transition-all",
                            isSelected
                              ? "text-white border-transparent"
                              : "bg-muted/20 border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                          )}
                          style={isSelected
                            ? { background: SPHERES[li].bg, boxShadow: SPHERES[li].shadow }
                            : undefined
                          }
                        >
                          {lvl}
                        </button>
                      );
                    })}
                  </div>
                  {errors.operationalLevel && <p className="text-[11px] text-red-400">{errors.operationalLevel}</p>}
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setStep(0)}
                    className="flex-1 h-10 rounded-lg border border-border bg-muted/20 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex-1 h-10 flex items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ background: SPHERES[0].bg, boxShadow: SPHERES[0].shadow }}
                  >
                    Review <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ── Step 2: Review ── */}
          {step === 2 && (
            <>
              <h1 className="text-2xl font-bold text-foreground mb-1">Confirm & Launch</h1>
              <p className="text-sm text-muted-foreground mb-8">
                Review your details before creating your account
              </p>

              <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3 mb-6">
                {[
                  { label: "Email",   value: form.email },
                  { label: "Company", value: form.companyName },
                  { label: "Type",    value: form.companyType },
                  { label: "Scale",   value: form.operationalLevel },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-4">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground shrink-0">
                      {item.label}
                    </span>
                    <span className="text-sm font-semibold text-foreground truncate text-right">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 h-10 rounded-lg border border-border bg-muted/20 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 h-10 flex items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ background: SPHERES[0].bg, boxShadow: SPHERES[0].shadow }}
                >
                  {loading ? <Spinner light /> : <>Launch Account <ArrowRight className="w-4 h-4" /></>}
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
