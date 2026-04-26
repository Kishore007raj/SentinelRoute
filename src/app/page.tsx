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
  Clock,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ─── Per-item sphere palette ──────────────────────────────────────────────────
const SPHERES = [
  // 0 — blue → indigo
  {
    bg: "radial-gradient(circle at 35% 35%, #60a5fa, #4f46e5 60%, #312e81 100%)",
    shadow: "0 0 0 1px rgba(99,102,241,0.3), 0 4px 16px rgba(79,70,229,0.25)",
    line: "linear-gradient(to bottom, rgba(99,102,241,0.4), rgba(99,102,241,0.1))",
  },
  // 1 — teal → emerald
  {
    bg: "radial-gradient(circle at 35% 35%, #5eead4, #059669 60%, #064e3b 100%)",
    shadow: "0 0 0 1px rgba(5,150,105,0.3), 0 4px 16px rgba(5,150,105,0.25)",
    line: "linear-gradient(to bottom, rgba(5,150,105,0.4), rgba(5,150,105,0.1))",
  },
  // 2 — violet → purple
  {
    bg: "radial-gradient(circle at 35% 35%, #c084fc, #7c3aed 60%, #3b0764 100%)",
    shadow: "0 0 0 1px rgba(124,58,237,0.3), 0 4px 16px rgba(124,58,237,0.25)",
    line: "linear-gradient(to bottom, rgba(124,58,237,0.4), rgba(124,58,237,0.1))",
  },
  // 3 — amber → orange
  {
    bg: "radial-gradient(circle at 35% 35%, #fcd34d, #ea580c 60%, #7c2d12 100%)",
    shadow: "0 0 0 1px rgba(234,88,12,0.3), 0 4px 16px rgba(234,88,12,0.25)",
    line: "linear-gradient(to bottom, rgba(234,88,12,0.4), rgba(234,88,12,0.1))",
  },
  // 4 — rose → pink
  {
    bg: "radial-gradient(circle at 35% 35%, #fb7185, #be185d 60%, #500724 100%)",
    shadow: "0 0 0 1px rgba(190,24,93,0.3), 0 4px 16px rgba(190,24,93,0.25)",
    line: "linear-gradient(to bottom, rgba(190,24,93,0.4), rgba(190,24,93,0.1))",
  },
  // 5 — sky → cyan
  {
    bg: "radial-gradient(circle at 35% 35%, #7dd3fc, #0284c7 60%, #0c4a6e 100%)",
    shadow: "0 0 0 1px rgba(2,132,199,0.3), 0 4px 16px rgba(2,132,199,0.25)",
    line: "linear-gradient(to bottom, rgba(2,132,199,0.4), rgba(2,132,199,0.1))",
  },
];

// Navbar / logo always uses blue→indigo
const SPHERE_BG = SPHERES[0].bg;
const SPHERE_SHADOW = SPHERES[0].shadow;

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
          : "bg-transparent",
      )}
    >
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Logo — mini sphere */}
        <Link href="/" className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
            style={{ background: SPHERE_BG, boxShadow: SPHERE_SHADOW }}
          >
            <Route className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-foreground tracking-tight text-sm">
            SentinelRoute
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="#features" className="hover:text-foreground transition-colors">
              Features
            </Link>
            <Link href="#how-it-works" className="hover:text-foreground transition-colors">
              How It Works
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/auth/signin">
              <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground">
                Sign In
              </Button>
            </Link>
            <Link href="/auth/signup">
              {/* CTA button uses the same blue→indigo */}
              <button
                className="h-8 px-4 text-xs font-semibold text-white rounded-md transition-opacity hover:opacity-90"
                style={{ background: SPHERE_BG, boxShadow: SPHERE_SHADOW }}
              >
                Get Started
              </button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

// ─── How It Works steps ───────────────────────────────────────────────────────

const howSteps = [
  {
    step: "01",
    num: 1,
    label: "Configure Your Shipment",
    desc: "Specify origin, destination, vehicle type, cargo, urgency, and deadline. Our tile-based interface makes complex logistics simple.",
  },
  {
    step: "02",
    num: 2,
    label: "View Route Options",
    desc: "Get three fully-analyzed routes: Fastest, Balanced (recommended), and Safest. Each shows ETA, cost, risk breakdown, and decision confidence.",
  },
  {
    step: "03",
    num: 3,
    label: "Make the Decision",
    desc: "Select your route. The Shipment Pass formalizes your decision with complete metadata, risk assessment, and reasoning context for the record.",
  },
  {
    step: "04",
    num: 4,
    label: "Dispatch & Monitor",
    desc: "Confirm dispatch and watch live route execution. Access your complete order history, decision audit trail, and performance insights.",
  },
];

// ─── Features ─────────────────────────────────────────────────────────────────

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
    icon: Activity,
    title: "Fast Configuration",
    desc: "Intuitive tile-based shipment setup. Configure complex routes in minutes, not hours.",
  },
];

const trustCards = [
  {
    icon: BarChart3,
    title: "Explainable Decisions",
    desc: "Every route shows exactly why it was chosen.",
  },
  {
    icon: Zap,
    title: "Real-Time Risk Detection",
    desc: "Live updates across traffic, weather, and disruptions.",
  },
  {
    icon: Shield,
    title: "Audit-Ready Logs",
    desc: "Every decision is stored, traceable, and defensible.",
  },
  {
    icon: Clock,
    title: "Faster Execution",
    desc: "Reduce manual analysis time across your operations team.",
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Navbar />

      {/* ── Hero ── */}
      <section className="pt-28 pb-16 md:pt-36 md:pb-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="flex flex-col items-center text-center gap-6"
          >
            {/* Badge — indigo dot */}
            <motion.div
              variants={fadeUp}
              custom={0}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground"
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: SPHERE_BG }}
              />
              Predictive route intelligence for logistics teams
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={fadeUp}
              custom={1}
              className="text-4xl md:text-6xl lg:text-7xl font-bold leading-[1.05] tracking-tight max-w-3xl"
            >
              Make Logistics Decisions{" "}
              <span className="text-foreground">You Can Defend</span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              custom={2}
              className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-lg"
            >
              SentinelRoute provides the intelligence and justification for
              every routing decision. Analyze tradeoffs between speed, cost, and
              risk — then move with confidence.
            </motion.p>

            {/* CTAs */}
            <motion.div
              variants={fadeUp}
              custom={3}
              className="flex items-center justify-center gap-3"
            >
              <Link href="/auth/signin">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  {/* Sign In — same blue→indigo sphere style */}
                  <button
                    className="inline-flex items-center gap-2 h-11 px-6 text-sm font-semibold text-white rounded-lg transition-opacity hover:opacity-90"
                    style={{ background: SPHERE_BG, boxShadow: SPHERE_SHADOW }}
                  >
                    Sign In <ArrowRight className="w-4 h-4" />
                  </button>
                </motion.div>
              </Link>
              <Link href="#how-it-works">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    variant="outline"
                    size="lg"
                    className="font-semibold px-6 border-border/60 text-muted-foreground hover:text-foreground"
                  >
                    How It Works
                  </Button>
                </motion.div>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Trust cards ── */}
      <motion.section
        variants={stagger}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0 }}
        className="py-16 border-y border-border/50"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl md:text-3xl font-semibold">
              Built for Real Decisions
            </h2>
            <p className="text-sm md:text-base text-muted-foreground mt-3">
              Make faster, data-backed decisions with full transparency, real-time risk awareness, and complete audit trails.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {trustCards.map((card, i) => (
              <motion.div
                key={card.title}
                variants={fadeUp}
                custom={i}
                whileHover={{ y: -3 }}
                transition={{ duration: 0.2 }}
                className="rounded-xl border border-border/60 bg-card p-5 flex flex-col gap-3 hover:border-white/10 transition-colors"
              >
                {/* Per-card sphere */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: SPHERES[i % SPHERES.length].bg, boxShadow: SPHERES[i % SPHERES.length].shadow }}
                >
                  <card.icon className="w-3.5 h-3.5 text-white" />
                </div>
                <p className="text-sm font-semibold text-foreground">{card.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{card.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ── Features ── */}
      <section id="features" className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0 }}
            className="text-center mb-14"
          >
            <h2 className="text-2xl md:text-3xl font-semibold mb-4">
              Built for Professional Decision Making
            </h2>
            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed max-w-xl mx-auto">
              Every feature exists to support defensible decisions. Analyze,
              justify, and execute with confidence.
            </p>
          </motion.div>
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                variants={fadeUp}
                custom={i}
                whileHover={{ y: -3 }}
                transition={{ duration: 0.2 }}
                className="rounded-xl border border-border/60 bg-card p-6 flex flex-col gap-3 hover:border-white/10 transition-colors"
              >
                {/* Per-feature sphere */}
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    background: SPHERES[i % SPHERES.length].bg,
                    boxShadow: SPHERES[i % SPHERES.length].shadow,
                  }}
                >
                  <f.icon className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="py-16 md:py-24 bg-muted/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0 }}
            className="text-center mb-14"
          >
            <h2 className="text-2xl md:text-3xl font-semibold mb-3">
              From Configuration to Dispatch
            </h2>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-xl mx-auto">
              A four-step workflow designed for speed and confidence.
            </p>
          </motion.div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0 }}
            className="max-w-2xl mx-auto"
          >
            {howSteps.map((s, i) => (
              <motion.div
                key={s.step}
                variants={fadeUp}
                custom={i}
                className="flex gap-5 items-stretch"
              >
                {/* Left — gradient sphere + connector line */}
                <div className="flex flex-col items-center shrink-0">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: SPHERES[i].bg, boxShadow: SPHERES[i].shadow }}
                  >
                    <span className="text-sm font-bold text-white tabular-nums drop-shadow">
                      {s.num}
                    </span>
                  </div>
                  {i < howSteps.length - 1 && (
                    <div
                      style={{
                        width: "1px",
                        flexGrow: 1,
                        minHeight: "56px",
                        marginTop: "8px",
                        background: SPHERES[i].line,
                      }}
                    />
                  )}
                </div>

                {/* Right — content */}
                <div className={cn("min-w-0 pt-1.5", i < howSteps.length - 1 ? "pb-10" : "pb-0")}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <h3 className="text-sm font-bold text-foreground">{s.label}</h3>
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {s.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border/50 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
            <div className="flex flex-col gap-3">
              <Link href="/" className="flex items-center gap-2.5">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: SPHERE_BG, boxShadow: SPHERE_SHADOW }}
                >
                  <Route className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="font-bold text-foreground tracking-tight text-sm">
                  SentinelRoute
                </span>
              </Link>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Logistics decision intelligence for operations teams.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Product</p>
              <div className="flex flex-col gap-2">
                <Link href="#features" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Features
                </Link>
                <Link href="#how-it-works" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  How It Works
                </Link>
                <Link href="/auth/signup" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Get Started
                </Link>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Company</p>
              <div className="flex flex-col gap-2">
                <span className="text-xs text-muted-foreground/40">About Us</span>
                <span className="text-xs text-muted-foreground/40">Blog</span>
                <span className="text-xs text-muted-foreground/40">Careers</span>
                <Link href="/auth/signin" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Sign In
                </Link>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Legal</p>
              <div className="flex flex-col gap-2">
                <span className="text-xs text-muted-foreground/40">Privacy Policy</span>
                <span className="text-xs text-muted-foreground/40">Terms of Service</span>
                <span className="text-xs text-muted-foreground/40">Security</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-border/50">
            <p className="text-xs text-muted-foreground">
              © 2026 SentinelRoute. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              {["Twitter", "LinkedIn", "GitHub"].map((s) => (
                <span key={s} className="text-xs text-muted-foreground/40">
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
