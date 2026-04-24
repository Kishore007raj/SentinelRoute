"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Route, ArrowRight, Shield, Zap, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { useRouter } from "next/navigation";

const features = [
  { icon: Shield, label: "Risk-first routing", text: "Every decision is scored and explainable" },
  { icon: Zap, label: "Operational speed", text: "Compare 3 routes in under 60 seconds" },
  { icon: BarChart3, label: "Audit trail", text: "Full dispatch history for compliance" },
];

export default function SignInPage() {
  const router = useRouter();
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ username: "", password: "" });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.username) e.username = "Username is required";
    if (!form.password) e.password = "Password is required";
    if (form.password && form.password.length < 6) e.password = "Password must be at least 6 characters";
    return e;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    setTimeout(() => router.push("/dashboard"), 1200);
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Username</Label>
              <Input
                placeholder="your.username"
                className="h-9 bg-muted/20 border-border text-sm"
                value={form.username}
                onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
              />
              {errors.username && <p className="text-[11px] text-red-400">{errors.username}</p>}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Password</Label>
                <button type="button" className="text-[11px] text-primary hover:underline">Forgot?</button>
              </div>
              <div className="relative">
                <Input
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  className="h-9 bg-muted/20 border-border text-sm pr-9"
                  value={form.password}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
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
