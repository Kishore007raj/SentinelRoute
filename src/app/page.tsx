"use client";
import { useState, useEffect } from "react";
import { motion, type Variants, type Transition } from "framer-motion";
import {
  Route,
  ArrowRight,
  Shield,
  Zap,
  BarChart3,
  CheckCircle,
  TrendingUp,
  Package,
  Star,
  AlertTriangle,
  Clock,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

const easeOut = [0.0, 0.0, 0.2, 1.0] as [number, number, number, number];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.08, ease: easeOut } as Transition,
  }),
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

// ─── Hero Visual ──────────────────────────────────────────────────────────────

function HeroVisual() {
  return (
    <div className="w-full rounded-xl border border-border/60 bg-card overflow-hidden shadow-2xl shadow-black/40">
      {/* Window chrome */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border/60 bg-muted/20">
        <div className="w-2.5 h-2.5 rounded-full bg-border" />
        <div className="w-2.5 h-2.5 rounded-full bg-border" />
        <div className="w-2.5 h-2.5 rounded-full bg-border" />
        <span className="ml-3 text-[10px] text-muted-foreground font-mono">
          SentinelRoute — Route Comparison
        </span>
      </div>

      <div className="p-4 grid grid-cols-1 lg:grid-cols-[1fr_1fr_280px] gap-3">
        {/* Route card A */}
        <div className="rounded-md border border-border bg-background/60 p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 border border-amber-400/30 bg-amber-400/10 rounded px-1.5 py-0.5">
              FASTEST
            </span>
          </div>
          <div className="rounded border border-red-400/20 bg-red-400/5 px-3 py-2 text-center">
            <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-0.5">Risk Score</p>
            <p className="text-2xl font-bold text-red-400 tabular-nums">72</p>
            <p className="text-[9px] text-red-400 uppercase tracking-wider">high risk</p>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="bg-muted/30 rounded px-2 py-1.5">
              <p className="text-[9px] text-muted-foreground uppercase tracking-widest">ETA</p>
              <p className="text-xs font-bold text-foreground">4h 20m</p>
            </div>
            <div className="bg-muted/30 rounded px-2 py-1.5">
              <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Dist</p>
              <p className="text-xs font-bold text-foreground">347 km</p>
            </div>
          </div>
          <div className="space-y-1">
            {[["Traffic", 80], ["Weather", 65], ["Disruption", 70]].map(([k, v]) => (
              <div key={k as string} className="flex items-center gap-1.5">
                <span className="text-[9px] text-muted-foreground w-14 shrink-0">{k}</span>
                <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-red-400 rounded-full" style={{ width: `${v}%` }} />
                </div>
                <span className="text-[9px] font-mono text-muted-foreground w-5 text-right">{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Route card B — recommended */}
        <div className="rounded-md border border-primary/40 bg-background/60 p-3 flex flex-col gap-2 ring-1 ring-primary/20 shadow-lg shadow-primary/10">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary border border-primary/30 bg-primary/10 rounded px-1.5 py-0.5">
              BALANCED
            </span>
            <span className="flex items-center gap-1 text-[9px] font-semibold text-primary bg-primary/10 border border-primary/25 rounded px-1.5 py-0.5">
              <Star className="w-2 h-2 fill-primary" /> Recommended
            </span>
          </div>
          <div className="rounded border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-center">
            <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-0.5">Risk Score</p>
            <p className="text-2xl font-bold text-amber-400 tabular-nums">37</p>
            <p className="text-[9px] text-amber-400 uppercase tracking-wider">medium risk</p>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="bg-muted/30 rounded px-2 py-1.5">
              <p className="text-[9px] text-muted-foreground uppercase tracking-widest">ETA</p>
              <p className="text-xs font-bold text-foreground">5h 05m</p>
            </div>
            <div className="bg-muted/30 rounded px-2 py-1.5">
              <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Dist</p>
              <p className="text-xs font-bold text-foreground">362 km</p>
            </div>
          </div>
          <div className="space-y-1">
            {[["Traffic", 40], ["Weather", 30], ["Disruption", 35]].map(([k, v]) => (
              <div key={k as string} className="flex items-center gap-1.5">
                <span className="text-[9px] text-muted-foreground w-14 shrink-0">{k}</span>
                <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: `${v}%` }} />
                </div>
                <span className="text-[9px] font-mono text-muted-foreground w-5 text-right">{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel: shipment pass + map preview */}
        <div className="flex flex-col gap-2">
          {/* Shipment pass stub */}
          <div className="rounded-md border border-border bg-background/60 overflow-hidden">
            <div className="bg-amber-400/10 border-b border-amber-400/20 px-3 py-1.5 flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="text-[9px] text-amber-400 font-medium">Risk: 37% — Minor congestion possible</span>
            </div>
            <div className="px-3 py-2 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-xs font-bold text-foreground">
                  <span>Chennai</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                  <span>Bangalore</span>
                </div>
                <span className="text-[9px] text-primary bg-primary/10 border border-primary/25 rounded px-1 py-0.5 font-semibold">Route B</span>
              </div>
              <p className="text-[9px] text-muted-foreground mt-0.5">Logistics Authorization · SentinelRoute</p>
            </div>
            <div className="grid grid-cols-2 gap-px bg-border mx-3 my-2 rounded overflow-hidden border border-border">
              {[["ETA", "5h 05m"], ["Risk", "37 / med"]].map(([l, v]) => (
                <div key={l} className="bg-card px-2 py-1.5">
                  <p className="text-[8px] text-muted-foreground uppercase tracking-widest">{l}</p>
                  <p className="text-xs font-bold text-foreground">{v}</p>
                </div>
              ))}
            </div>
            <div className="px-3 pb-2 grid grid-cols-2 gap-2">
              {[["ID", "SR-2026-0041"], ["Conf.", "82%"], ["Cargo", "Electronics"], ["Vehicle", "Container"]].map(([l, v]) => (
                <div key={l}>
                  <p className="text-[8px] text-muted-foreground uppercase tracking-widest">{l}</p>
                  <p className="text-[10px] font-semibold text-foreground truncate">{v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Map preview */}
          <div className="rounded-md border border-border bg-slate-950/80 overflow-hidden flex-1 min-h-[100px] relative">
            {/* Grid background */}
            <div className="absolute inset-0 bg-[linear-gradient(0deg,_rgba(255,255,255,0.03)_1px,_transparent_1px),linear-gradient(90deg,_rgba(255,255,255,0.03)_1px,_transparent_1px)] bg-[length:20px_20px]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,_rgba(56,189,248,0.08),_transparent_60%)]" />
            {/* Alternate routes */}
            <div className="absolute h-px bg-slate-600/50 rounded-full" style={{ width: "55%", top: "30%", left: "10%" }} />
            <div className="absolute h-px bg-slate-700/40 rounded-full" style={{ width: "65%", top: "55%", left: "8%" }} />
            {/* Selected route */}
            <div className="absolute h-1 bg-primary/70 rounded-full" style={{ width: "60%", top: "42%", left: "12%" }} />
            {/* Origin dot */}
            <div className="absolute flex items-center gap-1" style={{ left: "10%", top: "34%" }}>
              <div className="w-2 h-2 rounded-full bg-slate-200 border border-slate-400" />
              <span className="text-[8px] text-muted-foreground font-semibold">Chennai</span>
            </div>
            {/* Destination dot */}
            <div className="absolute flex items-center gap-1" style={{ right: "10%", bottom: "28%" }}>
              <div className="w-2 h-2 rounded-full bg-slate-200 border border-slate-400" />
              <span className="text-[8px] text-muted-foreground font-semibold">Bangalore</span>
            </div>
            {/* Status badge */}
            <div className="absolute top-2 right-2 text-[8px] text-emerald-400 bg-emerald-400/10 border border-emerald-400/25 rounded px-1.5 py-0.5 font-semibold uppercase tracking-wider">
              Dispatched
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 h-14 flex items-center",
        scrolled
          ? "bg-background/95 backdrop-blur-sm border-b border-border shadow-sm"
          : "bg-transparent"
      )}
    >
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
            <Route className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="font-bold text-foreground tracking-tight text-sm">SentinelRoute</span>
        </Link>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="#features" className="hover:text-foreground transition-colors">Features</Link>
            <Link href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</Link>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/auth/signin">
              <Button variant="ghost" size="sm" className="h-8 text-xs">Sign In</Button>
            </Link>
            <Link href="/auth/signup">
              <Button size="sm" className="h-8 text-xs">Get Started</Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

const howSteps = [
  {
    step: "01",
    icon: Package,
    label: "Configure Your Shipment",
    desc: "Specify origin, destination, vehicle type, cargo, urgency, and deadline. Our tile-based interface makes complex logistics simple.",
  },
  {
    step: "02",
    icon: BarChart3,
    label: "View Route Options",
    desc: "Get three fully-analyzed routes: Fastest, Balanced (recommended), and Safest. Each shows ETA, cost, risk breakdown, and decision confidence.",
  },
  {
    step: "03",
    icon: Shield,
    label: "Make the Decision",
    desc: "Select your route. The Shipment Pass formalizes your decision with complete metadata, risk assessment, and reasoning context for the record.",
  },
  {
    step: "04",
    icon: CheckCircle,
    label: "Dispatch & Monitor",
    desc: "Confirm dispatch and watch live route execution. Access your complete order history, decision audit trail, and performance insights.",
  },
];

const features = [
  {
    icon: TrendingUp,
    title: "Multi-Criteria Route Analysis",
    desc: "Evaluate speed, cost, safety, and risk across all available routes. Make informed tradeoffs with complete transparency.",
  },
  {
    icon: Zap,
    title: "Real-Time Intelligence",
    desc: "Live updates as conditions change. Stay ahead of disruptions and seize optimization opportunities instantly.",
  },
  {
    icon: BarChart3,
    title: "Decision Audit Trail",
    desc: "Every decision is logged with its justification. Full visibility for compliance, learning, and continuous improvement.",
  },
  {
    icon: Shield,
    title: "Risk & Compliance",
    desc: "Built-in safety assessments, regulatory compliance checks, and risk scoring for every route option.",
  },
  {
    icon: Package,
    title: "Performance Metrics",
    desc: "Track outcome data against decisions. Learn what works and continuously refine your routing strategy.",
  },
  {
    icon: CheckCircle,
    title: "Fast Configuration",
    desc: "Intuitive tile-based shipment setup. Configure complex routes in minutes, not hours.",
  },
];

const trustItems = [
  "Transparent risk scoring — every factor visible",
  "Explainable recommendation logic — no mystery decisions",
  "Full audit trail for compliance and review",
  "Decision confidence percentage per route",
  "Predictive alerting before disruption, not after",
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Navbar />

      {/* Hero */}
      <section className="pt-28 pb-16 md:pt-36 md:pb-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="flex flex-col items-center text-center gap-6"
          >
            <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs text-primary">
              <Zap className="w-3 h-3" />
              Predictive route intelligence for logistics teams
            </motion.div>
            <motion.h1 variants={fadeUp} custom={1} className="text-3xl md:text-5xl lg:text-6xl font-semibold leading-tight max-w-3xl">
              Make Logistics Decisions You Can Defend
            </motion.h1>
            <motion.p variants={fadeUp} custom={2} className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-xl">
              SentinelRoute provides the intelligence and justification for every routing decision. Analyze tradeoffs between speed, cost, and risk — then move with confidence.
            </motion.p>
            <motion.div variants={fadeUp} custom={3} className="flex flex-wrap items-center justify-center gap-3">
              <Link href="/auth/signup">
                <Button size="lg" className="gap-2">
                  Get Started <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/demo">
                <Button variant="outline" size="lg" className="gap-2">
                  View Live Demo
                </Button>
              </Link>
              <Link href="/demo">
                <Button variant="ghost" size="lg" className="gap-2 text-muted-foreground hover:text-foreground">
                  Try Interactive Example <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </motion.div>

            {/* Hero visual */}
            <motion.div
              variants={fadeUp}
              custom={4}
              className="w-full max-w-5xl mt-4"
            >
              <HeroVisual />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Trust bar */}
      <motion.section
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        className="py-10 border-y border-border/50"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs text-muted-foreground mb-6 uppercase tracking-widest">Why teams trust SentinelRoute</p>
          <ul className="flex flex-wrap justify-center gap-x-8 gap-y-3">
            {trustItems.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </motion.section>

      {/* Features */}
      <section id="features" className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl md:text-3xl font-semibold mb-3">Built for Professional Decision Making</h2>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-xl mx-auto">
              Every feature exists to support defensible decisions. Analyze, justify, and execute with confidence.
            </p>
          </motion.div>
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {features.map((f, i) => (
              <motion.div key={f.title} variants={fadeUp} custom={i} className="rounded-xl border border-border/60 bg-card p-6 flex flex-col gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <f.icon className="w-4 h-4 text-primary" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-16 md:py-24 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl md:text-3xl font-semibold mb-3">From Configuration to Dispatch</h2>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-xl mx-auto">
              A four-step workflow designed for speed and confidence. From shipment configuration to live route monitoring.
            </p>
          </motion.div>
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            className="flex flex-col gap-8 max-w-2xl mx-auto"
          >
            {howSteps.map((s, i) => (
              <motion.div key={s.step} variants={fadeUp} custom={i} className="flex gap-5">
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold shrink-0">
                    {s.step}
                  </div>
                  {i < howSteps.length - 1 && (
                    <div className="w-px flex-1 bg-border/60 mt-2" />
                  )}
                </div>
                <div className="pb-8">
                  <div className="flex items-center gap-2 mb-1">
                    <s.icon className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">{s.label}</h3>
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Decision Intelligence callout */}
      <motion.section
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-60px" }}
        className="py-16 md:py-24"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-6 flex gap-4 items-start">
            <div className="w-9 h-9 rounded-lg bg-amber-400/10 border border-amber-400/20 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">Decision Intelligence at Every Step</h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                Unlike traditional routing software, SentinelRoute explains the &apos;why&apos; behind every recommendation — building explainable decision records your team can defend, audit, and learn from.
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
            <div className="flex flex-col gap-3">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                  <Route className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="font-bold text-foreground tracking-tight text-sm">SentinelRoute</span>
              </Link>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Logistics decision intelligence for operations teams.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Product</p>
              <div className="flex flex-col gap-2">
                {["Features", "Pricing", "How It Works"].map((l) => (
                  <Link key={l} href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">{l}</Link>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Company</p>
              <div className="flex flex-col gap-2">
                {["About Us", "Blog", "Careers", "Contact"].map((l) => (
                  <Link key={l} href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">{l}</Link>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Legal</p>
              <div className="flex flex-col gap-2">
                {["Privacy Policy", "Terms of Service", "Security"].map((l) => (
                  <Link key={l} href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">{l}</Link>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-border/50">
            <p className="text-xs text-muted-foreground">© 2026 SentinelRoute. All rights reserved.</p>
            <div className="flex items-center gap-4">
              {["Twitter", "LinkedIn", "GitHub"].map((s) => (
                <Link key={s} href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">{s}</Link>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
