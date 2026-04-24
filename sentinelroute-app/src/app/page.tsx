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
  "Explainable AI insights — no mystery recommendations",
  "Full audit trail for compliance and review",
  "Decision confidence percentage per route",
  "Predictive alerting before disruption, not after",
];

const pricingPlans = [
  { name: "Starter", price: "$999", period: "/month", routes: "500 routes/month", highlighted: false },
  { name: "Professional", price: "$2,999", period: "/month", routes: "5,000 routes/month", highlighted: true },
  { name: "Enterprise", price: "Custom", period: "", routes: "Unlimited + API", highlighted: false },
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
              AI-powered logistics decision intelligence
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
              <Link href="#how-it-works">
                <Button variant="ghost" size="lg">
                  See How It Works
                </Button>
              </Link>
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
                Unlike traditional routing software, SentinelRoute explains the &apos;why&apos; behind every recommendation. Our AI doesn&apos;t just find routes — it builds your team&apos;s institutional knowledge.
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Pricing */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl md:text-3xl font-semibold mb-3">Ready to Transform Your Logistics?</h2>
            <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-xl mx-auto">
              Join leading logistics companies using SentinelRoute to make smarter decisions, reduce costs, and improve reliability.
            </p>
          </motion.div>
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto mb-8"
          >
            {pricingPlans.map((plan, i) => (
              <motion.div
                key={plan.name}
                variants={fadeUp}
                custom={i}
                className={cn(
                  "rounded-xl border p-6 text-center flex flex-col gap-2",
                  plan.highlighted
                    ? "border-primary/50 bg-primary/5 ring-1 ring-primary/30"
                    : "border-border/60 bg-card"
                )}
              >
                <p className="text-sm font-semibold text-foreground">{plan.name}</p>
                <p className={cn("text-2xl font-bold", plan.highlighted ? "text-primary" : "text-foreground")}>
                  {plan.price}
                  <span className="text-xs font-normal text-muted-foreground">{plan.period}</span>
                </p>
                <p className="text-xs text-muted-foreground">{plan.routes}</p>
              </motion.div>
            ))}
          </motion.div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/auth/signup">
              <Button size="lg" className="gap-2">
                Start 14-Day Free Trial <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Button variant="ghost" size="lg">Contact Sales</Button>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-4">
            No credit card required. 14-day free trial includes full access to all features.
          </p>
        </div>
      </section>

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
                AI-powered decision intelligence for modern logistics.
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
