"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Route, ArrowRight, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const steps = ["Account", "Company", "Review"];

export default function SignUpPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    username: "", password: "",
    companyName: "", companyType: "", operationalLevel: "",
  });

  const set = (key: string, val: string) => setForm((p) => ({ ...p, [key]: val }));

  const validateStep0 = () => {
    const e: Record<string, string> = {};
    if (!form.username) e.username = "Required";
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

  const handleSubmit = () => {
    setLoading(true);
    setTimeout(() => router.push("/dashboard"), 1400);
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
                {i < steps.length - 1 && <div className={cn("w-8 h-px", i < step ? "bg-emerald-400/40" : "bg-border")} />}
              </div>
            ))}
          </div>

          {step === 0 && (
            <>
              <h1 className="text-xl font-bold text-foreground mb-1">Create account</h1>
              <p className="text-sm text-muted-foreground mb-6">
                Already have one?{" "}
                <Link href="/auth/signin" className="text-primary hover:underline font-medium">Sign in</Link>
              </p>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Username <span className="text-amber-400">*</span></Label>
                  <Input placeholder="ops.manager" className="h-9 bg-muted/20 border-border text-sm" value={form.username} onChange={(e) => set("username", e.target.value)} />
                  {errors.username && <p className="text-[11px] text-red-400">{errors.username}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Password <span className="text-amber-400">*</span></Label>
                  <div className="relative">
                    <Input type={showPass ? "text" : "password"} placeholder="Min 8 characters" className="h-9 bg-muted/20 border-border text-sm pr-9" value={form.password} onChange={(e) => set("password", e.target.value)} />
                    <button type="button" onClick={() => setShowPass((s) => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-[11px] text-red-400">{errors.password}</p>}
                </div>
                <Button className="w-full h-9 text-sm font-semibold gap-2" onClick={handleNext}>
                  Continue <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="text-xl font-bold text-foreground mb-1">Company details</h1>
              <p className="text-sm text-muted-foreground mb-6">Tell us about your operation</p>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Company Name <span className="text-amber-400">*</span></Label>
                  <Input placeholder="FleetCo Logistics" className="h-9 bg-muted/20 border-border text-sm" value={form.companyName} onChange={(e) => set("companyName", e.target.value)} />
                  {errors.companyName && <p className="text-[11px] text-red-400">{errors.companyName}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Company Type <span className="text-amber-400">*</span></Label>
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
                  <Label className="text-xs text-muted-foreground">Operational Level <span className="text-amber-400">*</span></Label>
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

          {step === 2 && (
            <>
              <h1 className="text-xl font-bold text-foreground mb-1">Confirm & Launch</h1>
              <p className="text-sm text-muted-foreground mb-6">Review your details before creating your account</p>
              <div className="panel p-4 space-y-3 mb-6">
                {[
                  { label: "Username", value: form.username },
                  { label: "Company", value: form.companyName },
                  { label: "Type", value: form.companyType },
                  { label: "Scale", value: form.operationalLevel },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="label-meta">{item.label}</span>
                    <span className="text-sm font-semibold text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="h-9 text-sm flex-1" onClick={() => setStep(1)}>Back</Button>
                <Button className="h-9 text-sm flex-1 gap-2 font-semibold" onClick={handleSubmit} disabled={loading}>
                  {loading ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}
                      className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
                    />
                  ) : <>Launch Account <ArrowRight className="w-4 h-4" /></>}
                </Button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
