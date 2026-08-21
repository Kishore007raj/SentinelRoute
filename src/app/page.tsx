"use client";

/**
 * SentinelRoute - Industrial Logistics Decision Intelligence
 * Restored Landing Page with Design System Alignment
 */
import { useState, useEffect, useRef } from "react";
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
  Clock,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

const easeOut = [0.0, 0.0, 0.2, 1.0] as [number, number, number, number];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, delay: i * 0.08, ease: easeOut } as Transition,
  }),
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

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
        "fixed top-0 left-0 right-0 z-50 transition-all duration-200 h-16 flex items-center border-b",
        scrolled
          ? "bg-[#080B0F]/95 backdrop-blur-md border-[#202A33] shadow-lg shadow-black/40"
          : "bg-[#080B0F]/60 backdrop-blur-sm border-transparent",
      )}
    >
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 transition-colors group-hover:border-amber-500/50">
            <Route className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-foreground tracking-tight text-sm leading-tight">
              SentinelRoute
            </span>
            <span className="text-[9px] font-semibold text-amber-500 uppercase tracking-widest leading-none">
              Intelligence
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-400">
            <Link href="#capabilities" className="hover:text-foreground transition-colors">
              Capabilities
            </Link>
            <Link href="#how-it-works" className="hover:text-foreground transition-colors">
              Workflow
            </Link>
            <Link href="#trust" className="hover:text-foreground transition-colors">
              Reliability
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/auth/signin">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-xs text-slate-300 hover:text-foreground hover:bg-slate-800/50"
              >
                Sign In
              </Button>
            </Link>
            <Link href="/auth/signup">
              <Button
                size="sm"
                className="h-8 px-4 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg shadow-sm border border-amber-400/20"
              >
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

// ─── Animated Eyebrow ────────────────────────────────────────────────────────
// Hydration-safe: server and client both start at index 0.
// Rotation begins only after mount (useEffect), so initial HTML always matches.

const EYEBROW_PHRASES = [
  "Predictive route intelligence",
  "Real-time disruption awareness",
  "Risk-aware route decisions",
  "Explainable routing decisions",
  "Multi-route comparison",
  "Decision-ready logistics intelligence",
  "Audit-ready dispatch decisions",
] as const;

function AnimatedEyebrow() {
  const [index, setIndex] = useState(0);
  // visible drives the fade - starts true so first render is immediately visible
  const [visible, setVisible] = useState(true);
  const reducedMotion = useRef(false);

  useEffect(() => {
    // Detect preference once, client-only
    reducedMotion.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion.current) return; // stay static on phrase 0

    const interval = setInterval(() => {
      // Fade out
      setVisible(false);
      // After fade-out (300 ms), advance phrase and fade back in
      const t = setTimeout(() => {
        setIndex((i) => (i + 1) % EYEBROW_PHRASES.length);
        setVisible(true);
      }, 300);
      return () => clearTimeout(t);
    }, 3600);

    return () => clearInterval(interval);
  }, []);

  return (
    // Fixed height prevents any layout shift when phrase length changes
    <div
      className="inline-flex items-center gap-2 rounded-full border border-[#202A33] bg-[#0D1218] px-3.5 py-1.5 text-xs text-slate-300 overflow-hidden"
      style={{ minHeight: "1.875rem" }}
      aria-live="polite"
      aria-atomic="true"
    >
      {/* Amber dot - very subtle glow */}
      <span
        className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 flex-none"
        aria-hidden="true"
        style={{ boxShadow: "0 0 6px rgba(245,158,11,0.35)" }}
      />
      <motion.span
        key={index}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : -5 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="whitespace-nowrap"
      >
        {EYEBROW_PHRASES[index]}
      </motion.span>
    </div>
  );
}

// ─── Content Arrays ───────────────────────────────────────────────────────────

const howSteps = [
  {
    step: "01",
    num: 1,
    label: "Configure Your Shipment",
    desc: "Specify origin, destination, vehicle type, cargo class, and urgency constraints. Our structured interface captures all operational variables.",
  },
  {
    step: "02",
    num: 2,
    label: "Evaluate Route Options",
    desc: "Receive three fully-modeled routes: Fastest, Balanced (recommended), and Safest. Each reveals granular tradeoffs across time, cost, and hazard exposure.",
  },
  {
    step: "03",
    num: 3,
    label: "Formalize the Decision",
    desc: "Select your route. The SentinelRoute Shipment Pass locks in your operational choice with immutable risk scoring and rationale context.",
  },
  {
    step: "04",
    num: 4,
    label: "Dispatch & Monitor",
    desc: "Confirm execution and track live telemetry. Access complete historical audit trails and defensible performance insights for every trip.",
  },
];

const features = [
  {
    icon: TrendingUp,
    title: "Multi-Criteria Route Analysis",
    desc: "Simultaneously evaluate transit velocity, toll expense, road topography, and hazard exposure to eliminate blind tradeoffs.",
  },
  {
    icon: Zap,
    title: "Real-Time Telemetry & Weather",
    desc: "Live disruption feeds across monsoon advisories, traffic bottlenecks, and corridor closures keep dispatches agile.",
  },
  {
    icon: BarChart3,
    title: "Immutable Decision Audit Trail",
    desc: "Every routing selection is recorded with its underlying justification, ensuring defensible compliance across every contract.",
  },
  {
    icon: Shield,
    title: "Risk & Hazard Assessment",
    desc: "Algorithmic safety scoring evaluates accident frequency, elevation profiles, and cargo fragility for every alternative route.",
  },
  {
    icon: Package,
    title: "Continuous Outcome Intelligence",
    desc: "Compare post-trip execution against initial predictions to systematically calibrate fleet performance and ETAs.",
  },
  {
    icon: Activity,
    title: "Instant Dispatch Workflow",
    desc: "Streamlined operational configuration transitions from route comparison to driver assignment in seconds.",
  },
];

const trustCards = [
  {
    icon: BarChart3,
    title: "Explainable Decisions",
    desc: "Every recommendation shows transparent reasoning, cost breakdowns, and risk scores.",
  },
  {
    icon: Zap,
    title: "Real-Time Risk Detection",
    desc: "Live detection across traffic anomalies, severe weather, and route disruptions.",
  },
  {
    icon: Shield,
    title: "Audit-Ready Logs",
    desc: "Cryptographically verifiable operational history for enterprise compliance.",
  },
  {
    icon: Clock,
    title: "Operational Velocity",
    desc: "Reduce manual dispatcher analysis time by over 80% with automated trade-off models.",
  },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#080B0F] text-[#F1F3F5] overflow-x-hidden selection:bg-amber-500/20 selection:text-amber-300">
      <Navbar />

      {/* ── Hero Section ── */}
      <section className="pt-24 pb-20 md:pt-32 md:pb-28 border-b border-[#202A33]/60 relative overflow-hidden">
        {/* Subtle symmetric background grid */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, #202A33 1px, transparent 1px), linear-gradient(to bottom, #202A33 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            opacity: 0.035,
          }}
        />
        {/* Edge vignette - fades grid at perimeter */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 100% 80% at 50% 50%, transparent 40%, #080B0F 100%)",
          }}
        />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center">
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="flex flex-col items-center gap-7 w-full"
          >
            {/* Badge */}
            <motion.div variants={fadeUp} custom={0}>
              <AnimatedEyebrow />
            </motion.div>

            {/* Headline - 2-line composition at desktop */}
            <motion.h1
              variants={fadeUp}
              custom={1}
              className="max-w-3xl text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight text-[#F1F3F5]"
            >
              Make Logistics Decisions
              <br />
              {" "}
              <span className="text-amber-500">You Can Defend</span>
            </motion.h1>

            {/* Supporting paragraph */}
            <motion.p
              variants={fadeUp}
              custom={2}
              className="max-w-lg text-[0.9375rem] text-slate-400 leading-relaxed"
            >
              SentinelRoute evaluates available routes against traffic, weather,
              disruption signals, and operational risk - so teams can compare
              trade-offs and dispatch with confidence.
            </motion.p>

            {/* CTAs */}
            <motion.div
              variants={fadeUp}
              custom={3}
              className="flex flex-wrap items-center justify-center gap-3"
            >
              <Link href="/auth/signup">
                <Button
                  size="lg"
                  className="h-11 px-7 text-sm font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg border border-amber-400/20 gap-2 transition-all duration-200 hover:-translate-y-px"
                  style={{
                    boxShadow: "0 0 0 1px rgba(245,158,11,0.12), 0 4px 16px rgba(245,158,11,0.18)",
                  }}
                >
                  Get Started Free <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="#how-it-works">
                <Button
                  variant="outline"
                  size="lg"
                  className="h-11 px-7 text-sm font-medium border-[#202A33] bg-transparent text-slate-300 hover:text-foreground hover:bg-[#0D1218] hover:border-amber-500/20 transition-all duration-200"
                >
                  See How It Works
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Built for Real Decisions (Trust Section) ── */}
      <section id="trust" className="py-16 md:py-20 border-b border-[#202A33]/60 bg-[#0A0E14]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="label-meta mb-2 block">Enterprise Reliability</span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Built for Defensible Decisions
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2">
              Deliver operational certainty with explainable reasoning, proactive risk mitigation, and full auditability.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {trustCards.map((card, i) => (
              <motion.div
                key={card.title}
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0 }}
                custom={i}
                className="panel p-5 bg-[#0D1218] border-[#202A33] flex flex-col justify-between hover:border-slate-700 transition-colors"
              >
                <div>
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 mb-3 text-amber-500">
                    <card.icon className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-1.5">{card.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{card.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Capabilities (Features Section) ── */}
      <section id="capabilities" className="py-16 md:py-24 border-b border-[#202A33]/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="label-meta mb-2 block">Core Platform Capabilities</span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Engineered for Logistics Operators
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2">
              Every tool exists to support verifiable routing logic. Model, evaluate, and dispatch with precision.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0 }}
                custom={i}
                className="panel p-6 bg-[#0D1218] border-[#202A33] flex flex-col justify-between transition-all duration-250 hover:-translate-y-0.5"
                style={{
                  transition: "border-color 250ms, box-shadow 250ms, transform 250ms",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(245,158,11,0.25)";
                  (e.currentTarget as HTMLElement).style.boxShadow =
                    "0 0 0 1px rgba(245,158,11,0.08), 0 8px 28px rgba(245,158,11,0.07)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "";
                  (e.currentTarget as HTMLElement).style.boxShadow = "";
                }}
              >
                <div>
                  <div
                    className="w-9 h-9 rounded-lg bg-[#121820] border border-[#202A33] flex items-center justify-center shrink-0 mb-4 text-amber-500 transition-all duration-250"
                    style={{ transition: "border-color 250ms, filter 250ms" }}
                  >
                    <f.icon className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">{f.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works (Workflow Section) ── */}
      <section id="how-it-works" className="py-16 md:py-24 bg-[#0A0E14] border-b border-[#202A33]/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="label-meta mb-2 block">Operational Workflow</span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              From Configuration to Dispatch
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2">
              A four-step structured workflow designed for rapid dispatch execution and compliance integrity.
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            {howSteps.map((s, i) => (
              <motion.div
                key={s.step}
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0 }}
                custom={i}
                className="flex gap-5 items-stretch"
              >
                {/* Left Step Indicator & Connecting Line */}
                <div className="flex flex-col items-center shrink-0">
                  <div className="w-9 h-9 rounded-lg bg-[#121820] border border-[#202A33] flex items-center justify-center font-mono font-bold text-xs text-amber-500 shrink-0">
                    {s.step}
                  </div>
                  {i < howSteps.length - 1 && (
                    <div className="w-[1px] flex-1 bg-[#202A33] my-2 min-h-[50px]" />
                  )}
                </div>

                {/* Right Content */}
                <div className={cn("min-w-0 pt-1", i < howSteps.length - 1 ? "pb-8" : "pb-0")}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <h3 className="text-sm font-semibold text-foreground">{s.label}</h3>
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {s.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Structured CTA Section ── */}
      <section className="py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="panel p-8 sm:p-10 bg-[#0D1218] border-[#202A33] text-center relative overflow-hidden">
            <div className="max-w-2xl mx-auto space-y-4">
              <span className="label-meta">Ready to Modernize Your Fleet Routing?</span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Standardize Your Logistics Decision Intelligence
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-xl mx-auto">
                Join forward-thinking enterprise logistics operators. Evaluate real corridors with defensible risk scoring today.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
                <Link href="/auth/signup">
                  <Button
                    size="lg"
                    className="h-10 px-6 text-xs sm:text-sm font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg border border-amber-400/20 gap-2 transition-all duration-200 hover:-translate-y-px"
                    style={{
                      boxShadow: "0 0 0 1px rgba(245,158,11,0.12), 0 4px 16px rgba(245,158,11,0.18)",
                    }}
                  >
                    Get Started Free <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/auth/signin">
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-10 px-6 text-xs sm:text-sm font-medium border-[#202A33] bg-[#121820] text-slate-300 hover:text-foreground"
                  >
                    Sign In to Portal
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* ── Footer ── */}
      <footer className="border-t border-[#202A33] pt-12 pb-8 bg-[#06080B]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12 text-xs">
            {/* Brand */}
            <div className="space-y-3 lg:col-span-1">
              <Link href="/" className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <Route className="w-4 h-4 text-amber-500" />
                </div>
                <span className="font-bold text-foreground tracking-tight text-sm">SentinelRoute</span>
              </Link>
              <p className="text-slate-400 leading-relaxed max-w-[200px]">
                Logistics decision intelligence for operations teams.
              </p>
            </div>

            {/* Product */}
            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Product</p>
              <div className="flex flex-col gap-2.5 text-slate-400">
                <Link href="#capabilities" className="hover:text-slate-200 transition-colors">Features</Link>
                <Link href="#how-it-works" className="hover:text-slate-200 transition-colors">How It Works</Link>
                <Link href="/auth/signup" className="hover:text-slate-200 transition-colors">Get Started</Link>
              </div>
            </div>

            {/* Company */}
            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Company</p>
              <div className="flex flex-col gap-2.5 text-slate-400">
                <Link href="/demo" className="hover:text-slate-200 transition-colors">About Us</Link>
                <Link href="/demo" className="hover:text-slate-200 transition-colors">Demonstration</Link>
                <Link href="/auth/signin" className="hover:text-slate-200 transition-colors">Sign In</Link>
              </div>
            </div>

            {/* Legal */}
            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Legal</p>
              <div className="flex flex-col gap-2.5">
                <span className="text-slate-600 cursor-default">Privacy Policy</span>
                <span className="text-slate-600 cursor-default">Terms of Service</span>
                <span className="text-slate-600 cursor-default">Security</span>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-[#202A33]/60 text-xs text-slate-500">
            <p className="font-mono">© 2026 SentinelRoute. All rights reserved.</p>
            <div className="flex items-center gap-5">
              {/* Twitter / X */}
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition-colors" aria-label="Twitter">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
                </svg>
              </a>
              {/* LinkedIn */}
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition-colors" aria-label="LinkedIn">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
              {/* GitHub */}
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition-colors" aria-label="GitHub">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
