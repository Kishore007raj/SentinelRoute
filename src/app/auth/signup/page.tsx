"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye, EyeOff, Route, ArrowRight, CheckCircle,
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

// ─── Design tokens ────────────────────────────────────────────────────────────
const AMBER_GLOW = "0 0 0 1px rgba(245,158,11,0.15), 0 4px 20px rgba(245,158,11,0.20)";
const AMBER_FOCUS = "0 0 0 2px rgba(245,158,11,0.35)";

// ─── Proof cards — real project capabilities ──────────────────────────────────
const PROOF_CARDS = [
  {
    tag: "Route Intelligence",
    title: "Multi-route comparison",
    body: "Evaluate available routes using multiple operational criteria — traffic, toll cost, road topology, and cargo constraints — before committing to dispatch.",
  },
  {
    tag: "Risk Intelligence",
    title: "Risk-aware decisions",
    body: "Every route carries a quantified risk score. Traffic anomalies, weather advisories, and disruption signals are factored in before you dispatch.",
  },
  {
    tag: "Explainability",
    title: "Explainable routing",
    body: "SentinelRoute shows the reasoning behind each recommendation. Every route option comes with a justification, not just a result.",
  },
  {
    tag: "Auditability",
    title: "Audit-ready decisions",
    body: "Every routing decision is recorded with its risk score, route choice, and rationale. Dispatch teams can review exactly what happened and why.",
  },
  {
    tag: "Real-Time Awareness",
    title: "Live disruption signals",
    body: "Route evaluation incorporates current traffic, weather conditions, and active disruption signals so decisions reflect what is happening now.",
  },
  {
    tag: "Operational Workflow",
    title: "From analysis to dispatch",
    body: "Move from route comparison to an actionable dispatch decision without leaving the operational workflow. One platform, one decision trail.",
  },
] as const;

function ProofWindow() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced.current) return;

    const interval = setInterval(() => {
      setVisible(false);
      const t = setTimeout(() => {
        setIndex((i) => (i + 1) % PROOF_CARDS.length);
        setVisible(true);
      }, 400);
      return () => clearTimeout(t);
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  const card = PROOF_CARDS[index];

  return (
    <div
      className="rounded-lg border border-[#202A33] bg-[#080B0F]/60 p-4"
      style={{ minHeight: "10rem" }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, y: visible ? 6 : -6 }}
          animate={{ opacity: visible ? 1 : 0, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="space-y-2"
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-500">
            {card.tag}
          </p>
          <p className="text-sm font-semibold text-[#F1F3F5] leading-snug">{card.title}</p>
          <p className="text-xs text-slate-400 leading-relaxed">{card.body}</p>
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center gap-1.5 mt-4">
        {PROOF_CARDS.map((_, i) => (
          <button
            key={i}
            aria-label={`View card ${i + 1}`}
            onClick={() => { setIndex(i); setVisible(true); }}
            className={cn(
              "rounded-full transition-all duration-200",
              i === index
                ? "w-4 h-1.5 bg-amber-500"
                : "w-1.5 h-1.5 bg-[#202A33] hover:bg-slate-500",
            )}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
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
        light ? "border-white/30 border-t-white" : "border-slate-600 border-t-slate-300",
      )}
    />
  );
}

function setSessionCookie(token: string) {
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `sr_session=${encodeURIComponent(token)}; path=/; expires=${expires}; SameSite=Lax`;
}

const STEPS = ["Account", "Company", "Review"] as const;

// Step indicator bubble
function StepBubble({ index, current }: { index: number; current: number }) {
  const done   = index < current;
  const active = index === current;
  return (
    <div
      className={cn(
        "w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold transition-all duration-200",
        done   ? "bg-amber-600 border border-amber-500/40" :
        active ? "bg-amber-600 border border-amber-400/60" :
                 "bg-[#0D1218] border border-[#202A33]",
      )}
      style={
        active || done
          ? { boxShadow: "0 0 8px rgba(245,158,11,0.25)" }
          : undefined
      }
    >
      {done
        ? <CheckCircle className="w-3.5 h-3.5 text-white" />
        : <span className={active ? "text-white" : "text-slate-500"}>{index + 1}</span>
      }
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
      router.push("/company/register");
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
      router.push("/company/register");
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
    <div className="min-h-screen bg-[#080B0F] text-[#F1F3F5] lg:grid lg:grid-cols-[40%_60%]">

      {/* ── Left panel — 40% ── */}
      <div className="hidden lg:flex w-full flex-col justify-between bg-[#0D1218] border-r border-[#202A33] p-10">
        <div className="flex flex-col gap-0">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group mb-12">
            <div
              className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 transition-colors group-hover:border-amber-500/60"
              style={{ boxShadow: "0 0 10px rgba(245,158,11,0.12)" }}
            >
              <Route className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-[#F1F3F5] tracking-tight text-sm leading-tight">SentinelRoute</span>
              <span className="text-[9px] font-semibold text-amber-500 uppercase tracking-widest leading-none">Intelligence</span>
            </div>
          </Link>

          <h2 className="text-2xl font-bold text-[#F1F3F5] leading-tight mb-3">
            Decision intelligence<br />for operations teams
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed mb-10">
            Compare routes against traffic, weather, disruption signals, and operational risk before dispatch.
          </p>

          {/* Setup progress */}
          <div className="mb-10">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-4">
              Setup Progress
            </p>
            <div className="space-y-3">
              {STEPS.map((s, i) => (
                <div key={s} className="flex items-center gap-3">
                  <StepBubble index={i} current={step} />
                  <span className={cn(
                    "text-sm transition-colors duration-200",
                    i === step ? "text-[#F1F3F5] font-semibold" :
                    i < step   ? "text-amber-500" :
                                 "text-slate-500",
                  )}>
                    {s}
                  </span>
                  {i < step && (
                    <span className="text-[10px] text-amber-500/70 font-mono ml-auto">done</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Proof window */}
          <ProofWindow />
        </div>

        <p className="text-[10px] text-slate-600 font-mono mt-8">
          © 2026 SentinelRoute Intelligence
        </p>
      </div>

      {/* ── Right: form — 60% ── */}
      <div className="flex flex-col items-center justify-center min-h-screen lg:min-h-0 p-6 sm:p-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.22 }}
            className="w-full max-w-md"
          >
            {/* Mobile logo */}
            <Link href="/" className="flex items-center gap-2.5 mb-6 lg:hidden">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                <Route className="w-4 h-4 text-amber-500" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-[#F1F3F5] tracking-tight text-sm leading-tight">SentinelRoute</span>
                <span className="text-[9px] font-semibold text-amber-500 uppercase tracking-widest leading-none">Intelligence</span>
              </div>
            </Link>

            {/* Mobile step dots */}
            <div className="flex items-center gap-2 mb-8 lg:hidden">
              {STEPS.map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <StepBubble index={i} current={step} />
                  {i < STEPS.length - 1 && (
                    <div className={cn(
                      "h-px w-8 transition-colors duration-300",
                      i < step ? "bg-amber-600/60" : "bg-[#202A33]",
                    )} />
                  )}
                </div>
              ))}
            </div>

            {/* Form-level error */}
            {errors.form && (
              <div className="mb-5 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
                {errors.form}
              </div>
            )}

            {/* ── Step 0: Account ── */}
            {step === 0 && (
              <>
                <h1 className="text-2xl font-bold text-[#F1F3F5] mb-1">
                  Create Account
                </h1>
                <p className="text-sm text-slate-400 mb-8">
                  Already have one? {" "}
                  <Link href="/auth/signin" className="text-slate-300 underline underline-offset-2 font-medium hover:text-amber-400 transition-colors">
                    Sign in
                  </Link>
                </p>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-400">Email</Label>
                    <Input
                      type="email"
                      placeholder="you@company.com"
                      className="h-10 bg-[#0D1218] border-[#202A33] text-sm text-[#F1F3F5] placeholder:text-slate-600 focus:border-amber-500/60 focus:ring-0 transition-colors"
                      onFocus={(e) => { e.currentTarget.style.boxShadow = AMBER_FOCUS; }}
                      onBlur={(e) => { e.currentTarget.style.boxShadow = "none"; }}
                      value={form.email}
                      onChange={(e) => set("email", e.target.value)}
                      autoComplete="email"
                    />
                    {errors.email && <p className="text-[11px] text-red-400">{errors.email}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-400">Password</Label>
                    <div className="relative">
                      <Input
                        type={showPass ? "text" : "password"}
                        placeholder="Min 8 characters"
                        className="h-10 bg-[#0D1218] border-[#202A33] text-sm text-[#F1F3F5] placeholder:text-slate-600 focus:border-amber-500/60 focus:ring-0 pr-9 transition-colors"
                        onFocus={(e) => { e.currentTarget.style.boxShadow = AMBER_FOCUS; }}
                        onBlur={(e) => { e.currentTarget.style.boxShadow = "none"; }}
                        value={form.password}
                        onChange={(e) => set("password", e.target.value)}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass((s) => !s)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                        aria-label={showPass ? "Hide password" : "Show password"}
                      >
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.password && <p className="text-[11px] text-red-400">{errors.password}</p>}
                  </div>

                  <button
                    type="button"
                    onClick={handleNext}
                    className="w-full h-10 flex items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white bg-amber-600 hover:bg-amber-500 transition-all duration-200 hover:-translate-y-px"
                    style={{ boxShadow: AMBER_GLOW }}
                  >
                    Continue <ArrowRight className="w-4 h-4" />
                  </button>

                  <div className="relative flex items-center gap-3">
                    <div className="flex-1 h-px bg-[#202A33]" />
                    <span className="text-[11px] text-slate-600 uppercase tracking-widest shrink-0">or</span>
                    <div className="flex-1 h-px bg-[#202A33]" />
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={googleLoading || loading}
                    className="w-full h-10 flex items-center justify-center gap-2.5 rounded-lg border border-[#202A33] bg-[#0D1218] text-sm font-medium text-slate-300 hover:text-[#F1F3F5] hover:border-[#2D3A47] hover:bg-[#111820] disabled:opacity-50 transition-all duration-200"
                  >
                    {googleLoading ? <Spinner /> : <><GoogleIcon /> Continue with Google</>}
                  </button>
                </div>
              </>
            )}

            {/* ── Step 1: Company ── */}
            {step === 1 && (
              <>
                <h1 className="text-2xl font-bold text-[#F1F3F5] mb-1">Company details</h1>
                <p className="text-sm text-slate-400 mb-8">Tell us about your operation</p>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-400">Company Name</Label>
                    <Input
                      placeholder="FleetCo Logistics"
                      className="h-10 bg-[#0D1218] border-[#202A33] text-sm text-[#F1F3F5] placeholder:text-slate-600 focus:border-amber-500/60 focus:ring-0 transition-colors"
                      onFocus={(e) => { e.currentTarget.style.boxShadow = AMBER_FOCUS; }}
                      onBlur={(e) => { e.currentTarget.style.boxShadow = "none"; }}
                      value={form.companyName}
                      onChange={(e) => set("companyName", e.target.value)}
                    />
                    {errors.companyName && <p className="text-[11px] text-red-400">{errors.companyName}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-400">Company Type</Label>
                    <Select value={form.companyType} onValueChange={(v) => { if (v) set("companyType", v); }}>
                      <SelectTrigger className="h-10 bg-[#0D1218] border-[#202A33] text-sm text-[#F1F3F5] focus:border-amber-500/60 focus:ring-0">
                        <SelectValue placeholder="Select type..." />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0D1218] border-[#202A33]">
                        {["3PL Provider", "E-Commerce Fulfillment", "Freight & Logistics", "Cold Chain", "Industrial Supply"].map((t) => (
                          <SelectItem key={t} value={t} className="text-slate-300 focus:bg-[#161F2B] focus:text-[#F1F3F5]">{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.companyType && <p className="text-[11px] text-red-400">{errors.companyType}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-400">Operational Level</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["Regional", "National", "Enterprise"] as const).map((lvl) => {
                        const isSelected = form.operationalLevel === lvl;
                        return (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() => set("operationalLevel", lvl)}
                            className={cn(
                              "py-2.5 rounded-lg border text-xs font-semibold transition-all duration-200",
                              isSelected
                                ? "bg-amber-600 border-amber-500/40 text-white"
                                : "bg-[#0D1218] border-[#202A33] text-slate-400 hover:border-[#2D3A47] hover:text-slate-200",
                            )}
                            style={isSelected ? { boxShadow: "0 0 8px rgba(245,158,11,0.25)" } : undefined}
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
                      className="flex-1 h-10 rounded-lg border border-[#202A33] bg-[#0D1218] text-sm font-medium text-slate-400 hover:text-slate-200 hover:border-[#2D3A47] transition-all duration-200"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      className="flex-1 h-10 flex items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white bg-amber-600 hover:bg-amber-500 transition-all duration-200 hover:-translate-y-px"
                      style={{ boxShadow: AMBER_GLOW }}
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
                <h1 className="text-2xl font-bold text-[#F1F3F5] mb-1">Confirm & Launch</h1>
                <p className="text-sm text-slate-400 mb-8">
                  Review your details before creating your account
                </p>

                <div className="rounded-lg border border-[#202A33] bg-[#0D1218] p-5 space-y-3.5 mb-6">
                  {[
                    { label: "Email",   value: form.email },
                    { label: "Company", value: form.companyName },
                    { label: "Type",    value: form.companyType },
                    { label: "Scale",   value: form.operationalLevel },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-4">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 shrink-0">
                        {item.label}
                      </span>
                      <span className="text-sm font-medium text-[#F1F3F5] truncate text-right">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 h-10 rounded-lg border border-[#202A33] bg-[#0D1218] text-sm font-medium text-slate-400 hover:text-slate-200 hover:border-[#2D3A47] transition-all duration-200"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading}
                    className="flex-1 h-10 flex items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-50 transition-all duration-200 hover:-translate-y-px"
                    style={{ boxShadow: AMBER_GLOW }}
                  >
                    {loading ? <Spinner light /> : <>Launch Account <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
