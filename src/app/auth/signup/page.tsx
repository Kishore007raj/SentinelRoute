"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Route, ArrowRight, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, updateProfile, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { cn } from "@/lib/utils";

const steps = ["Account", "Company", "Review"];

// Session cookie — read by middleware
function setSessionCookie() {
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `sr_session=1; path=/; expires=${expires}; SameSite=Lax`;
}

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
      setSessionCookie();
      router.push("/dashboard");
    } catch (err: unknown) {
      setGoogleLoading(false);
      const code = (err as { code?: string }).code ?? "";
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        return; // user dismissed — not an error
      }
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
      // Create Firebase user with email + password
      const credential = await createUserWithEmailAndPassword(
        auth,
        form.email,
        form.password
      );

      // Store display name as "CompanyName (OperationalLevel)"
      await updateProfile(credential.user, {
        displayName: `${form.companyName} (${form.operationalLevel})`,
      });

      setSessionCookie();
      router.push("/dashboard");
    } catch (err: unknown) {
      setLoading(false);
      const code = (err as { code?: string }).code ?? "";
      const message = (err as { message?: string }).message ?? "";
      console.error("[signup] Firebase error:", code, message);

      if (code === "auth/email-already-in-use") {
        setErrors({ form: "An account with this email already exists." });
        setStep(0);
      } else if (code === "auth/weak-password") {
        setErrors({ password: "Password is too weak. Use at least 8 characters." });
        setStep(0);
      } else if (code === "auth/invalid-api-key" || code === "auth/app-not-initialized") {
        setErrors({ form: `Firebase not configured. Check .env.local and restart. (${code})` });
      } else if (code === "auth/network-request-failed") {
        setErrors({ form: "Network error. Check your internet connection." });
      } else if (code === "auth/operation-not-allowed") {
        setErrors({ form: "Email/password sign-up is not enabled. Enable it in Firebase Console → Authentication → Sign-in method." });
      } else {
        setErrors({ form: `Error: ${code || message || "Unknown error. Check browser console."}` });
      }
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel */}
      <div className="hidden lg:flex w-[380px] shrink-0 flex-col bg-card border-r border-border p-10">
        <div className="flex items-center gap-2.5 mb-12">
          <div className="w-8 h-8 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Route className="w-4 h-4 text-primary" />
          </div>
          <span className="font-bold text-foreground tracking-tight">SentinelRoute</span>
        </div>
        <h2 className="text-xl font-bold text-foreground leading-tight mb-3">
          Join operations teams who route with confidence
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-8">
          Set up your account in 2 minutes. Start analyzing routes immediately.
        </p>
        {/* Step indicator */}
        <div className="space-y-3">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-3">
              <div className={cn(
                "w-6 h-6 rounded-full border flex items-center justify-center text-[11px] font-bold shrink-0",
                i < step ? "bg-emerald-400/20 border-emerald-400/40 text-emerald-400" :
                i === step ? "bg-primary/20 border-primary/40 text-primary" :
                "bg-muted/30 border-border text-muted-foreground"
              )}>
                {i < step ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={cn("text-sm", i === step ? "text-foreground font-semibold" : "text-muted-foreground")}>
                {s}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Right: form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
          className="w-full max-w-sm"
        >
          {/* Mobile step dots */}
          <div className="flex items-center gap-2 mb-8">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={cn(
                  "w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold",
                  i < step ? "bg-emerald-400/20 border-emerald-400 text-emerald-400" :
                  i === step ? "bg-primary/20 border-primary text-primary" :
                  "bg-muted/20 border-border text-muted-foreground"
                )}>
                  {i < step ? "✓" : i + 1}
                </div>
                {i < steps.length - 1 && (
                  <div className={cn("w-8 h-px", i < step ? "bg-emerald-400/40" : "bg-border")} />
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
              <h1 className="text-xl font-bold text-foreground mb-1">Create account</h1>
              <p className="text-sm text-muted-foreground mb-6">
                Already have one?{" "}
                <Link href="/auth/signin" className="text-primary hover:underline font-medium">Sign in</Link>
              </p>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Email <span className="text-amber-400">*</span>
                  </Label>
                  <Input
                    type="email"
                    placeholder="you@company.com"
                    className="h-9 bg-muted/20 border-border text-sm"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    autoComplete="email"
                  />
                  {errors.email && <p className="text-[11px] text-red-400">{errors.email}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Password <span className="text-amber-400">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPass ? "text" : "password"}
                      placeholder="Min 8 characters"
                      className="h-9 bg-muted/20 border-border text-sm pr-9"
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
                <Button className="w-full h-9 text-sm font-semibold gap-2" onClick={handleNext}>
                  Continue <ArrowRight className="w-4 h-4" />
                </Button>

                {/* Google sign-up */}
                <div className="relative flex items-center gap-3 pt-1">
                  <div className="flex-1 h-px bg-border/60" />
                  <span className="text-[11px] text-muted-foreground/60 uppercase tracking-widest shrink-0">or</span>
                  <div className="flex-1 h-px bg-border/60" />
                </div>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading || loading}
                  className="w-full h-9 flex items-center justify-center gap-2.5 rounded-md border border-border bg-muted/20 text-sm font-medium text-foreground hover:bg-muted/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              </div>
            </>
          )}

          {/* ── Step 1: Company ── */}
          {step === 1 && (
            <>
              <h1 className="text-xl font-bold text-foreground mb-1">Company details</h1>
              <p className="text-sm text-muted-foreground mb-6">Tell us about your operation</p>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Company Name <span className="text-amber-400">*</span>
                  </Label>
                  <Input
                    placeholder="FleetCo Logistics"
                    className="h-9 bg-muted/20 border-border text-sm"
                    value={form.companyName}
                    onChange={(e) => set("companyName", e.target.value)}
                  />
                  {errors.companyName && <p className="text-[11px] text-red-400">{errors.companyName}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Company Type <span className="text-amber-400">*</span>
                  </Label>
                  <Select value={form.companyType} onValueChange={(v) => set("companyType", v)}>
                    <SelectTrigger className="h-9 bg-muted/20 border-border text-sm">
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
                  <Label className="text-xs text-muted-foreground">
                    Operational Level <span className="text-amber-400">*</span>
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {["Regional", "National", "Enterprise"].map((lvl) => (
                      <button
                        key={lvl}
                        onClick={() => set("operationalLevel", lvl)}
                        className={cn(
                          "py-2 rounded-md border text-xs font-semibold transition-all",
                          form.operationalLevel === lvl
                            ? "bg-primary/10 border-primary/40 text-primary"
                            : "bg-muted/20 border-border text-muted-foreground hover:bg-muted/40"
                        )}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                  {errors.operationalLevel && <p className="text-[11px] text-red-400">{errors.operationalLevel}</p>}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="h-9 text-sm flex-1" onClick={() => setStep(0)}>Back</Button>
                  <Button className="h-9 text-sm flex-1 gap-2" onClick={handleNext}>
                    Review <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* ── Step 2: Review ── */}
          {step === 2 && (
            <>
              <h1 className="text-xl font-bold text-foreground mb-1">Confirm & Launch</h1>
              <p className="text-sm text-muted-foreground mb-6">Review your details before creating your account</p>
              <div className="panel p-4 space-y-3 mb-6">
                {[
                  { label: "Email", value: form.email },
                  { label: "Company", value: form.companyName },
                  { label: "Type", value: form.companyType },
                  { label: "Scale", value: form.operationalLevel },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="label-meta">{item.label}</span>
                    <span className="text-sm font-semibold text-foreground truncate max-w-[200px]">{item.value}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="h-9 text-sm flex-1" onClick={() => setStep(1)}>Back</Button>
                <Button
                  className="h-9 text-sm flex-1 gap-2 font-semibold"
                  onClick={handleSubmit}
                  disabled={loading}
                >
                  {loading ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}
                      className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
                    />
                  ) : (
                    <>Launch Account <ArrowRight className="w-4 h-4" /></>
                  )}
                </Button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
