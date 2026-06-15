"use client";
/**
 * /company/register
 *
 * Company registration form — collected immediately after first sign-up.
 * Three sections: Company Details, Contact Information, Operations.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Building2, Phone, Truck, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useUser } from "@/lib/auth-context";
import { useCompany } from "@/lib/company-context";

// ─── Constants ────────────────────────────────────────────────────────────────

const COMPANY_TYPES = [
  "3PL Provider",
  "E-Commerce Fulfillment",
  "Freight & Cargo",
  "Cold Chain Logistics",
  "Industrial Supply Chain",
  "FMCG Distribution",
  "Pharmaceutical Logistics",
  "Automotive Logistics",
  "Project Cargo",
  "Other",
];

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Delhi", "Jammu & Kashmir", "Ladakh",
];

const CARGO_CATEGORIES = [
  "General Cargo",
  "Cold Chain / Refrigerated",
  "Pharmaceuticals",
  "Electronics",
  "Hazardous Materials",
  "Automotive Parts",
  "FMCG",
  "Agricultural Produce",
  "Heavy Machinery",
  "Textile & Apparel",
];

// ─── Progress indicator ───────────────────────────────────────────────────────

const STEPS = ["Company Details", "Contact Information", "Operations"];

function ProgressBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-10">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center">
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={[
                "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border transition-colors",
                i < current
                  ? "bg-primary border-primary text-primary-foreground"
                  : i === current
                  ? "border-primary text-primary bg-primary/10"
                  : "border-border text-muted-foreground bg-muted/20",
              ].join(" ")}
            >
              {i < current ? "✓" : i + 1}
            </div>
            <span
              className={[
                "text-[10px] whitespace-nowrap",
                i === current ? "text-foreground font-semibold" : "text-muted-foreground",
              ].join(" ")}
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={[
                "h-px w-16 sm:w-24 mx-2 mb-4 transition-colors",
                i < current ? "bg-primary" : "bg-border",
              ].join(" ")}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Multi-select chip ────────────────────────────────────────────────────────

function ChipSelect({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (opt: string) => {
    onChange(
      selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]
    );
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={[
              "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
              active
                ? "bg-primary/10 border-primary/40 text-primary"
                : "bg-muted/20 border-border text-muted-foreground hover:text-foreground hover:bg-muted/40",
            ].join(" ")}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface FormState {
  // Section 1
  companyName:     string;
  companyType:     string;
  gstNumber:       string;
  panNumber:       string;
  website:         string;
  // Section 2
  email:           string;
  phone:           string;
  address:         string;
  // Section 3
  fleetSize:       string;
  operatingStates: string[];
  cargoCategories: string[];
}

export default function CompanyRegisterPage() {
  const router  = useRouter();
  const { user } = useUser();
  const { refresh } = useCompany();

  const [step, setStep]     = useState(0);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState<FormState>({
    companyName:     "",
    companyType:     "",
    gstNumber:       "",
    panNumber:       "",
    website:         "",
    email:           user?.email ?? "",
    phone:           "",
    address:         "",
    fleetSize:       "",
    operatingStates: [],
    cargoCategories: [],
  });

  const patch = (key: keyof FormState, value: string | string[]) =>
    setForm((p) => ({ ...p, [key]: value }));

  // ── Validation ────────────────────────────────────────────────────────────

  const validateStep0 = () => {
    const e: Record<string, string> = {};
    if (!form.companyName.trim())   e.companyName  = "Company name is required";
    if (!form.companyType)          e.companyType   = "Company type is required";
    if (!form.gstNumber.trim())     e.gstNumber     = "GST number is required";
    else if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.gstNumber.toUpperCase()))
      e.gstNumber = "Enter a valid 15-character GSTIN";
    if (!form.panNumber.trim())     e.panNumber     = "PAN number is required";
    else if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.panNumber.toUpperCase()))
      e.panNumber = "Enter a valid 10-character PAN";
    return e;
  };

  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = "Valid business email required";
    if (!form.phone.trim() || !/^[+]?[0-9\s\-]{8,15}$/.test(form.phone.trim())) e.phone = "Valid phone number required";
    if (!form.address.trim()) e.address = "Registered address is required";
    return e;
  };

  const validateStep2 = () => {
    const e: Record<string, string> = {};
    const fs = parseInt(form.fleetSize, 10);
    if (!form.fleetSize || isNaN(fs) || fs < 1) e.fleetSize = "Fleet size must be at least 1";
    if (form.operatingStates.length === 0) e.operatingStates = "Select at least one state";
    if (form.cargoCategories.length === 0) e.cargoCategories = "Select at least one cargo category";
    return e;
  };

  const handleNext = () => {
    const errs = step === 0 ? validateStep0() : step === 1 ? validateStep1() : {};
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setStep((s) => s + 1);
  };

  const handleSubmit = async () => {
    const errs = validateStep2();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});

    if (!user) return;

    setSaving(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/company/register", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          gstNumber:   form.gstNumber.toUpperCase(),
          panNumber:   form.panNumber.toUpperCase(),
          fleetSize:   parseInt(form.fleetSize, 10),
          contactName: user.displayName ?? user.email ?? "",
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error("Registration failed", { description: data.error ?? "Please try again" });
        return;
      }

      await refresh();
      toast.success("Company registered", { description: "Proceed to upload your verification documents." });
      router.push("/company/documents");
    } catch (err) {
      console.error("[register]", err);
      toast.error("Registration failed", { description: "Network error. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="mb-8">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Company Setup</p>
        <h1 className="text-2xl font-bold text-foreground">Register Your Company</h1>
        <p className="text-sm text-muted-foreground mt-1">
          SentinelRoute is a verified B2B platform. All companies must be verified before accessing operations.
        </p>
      </div>

      <ProgressBar current={step} />

      <motion.div
        key={step}
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-card border border-border rounded-xl p-8 space-y-6"
      >
        {/* ── Step 0: Company Details ── */}
        {step === 0 && (
          <>
            <div className="flex items-center gap-3 mb-2">
              <Building2 className="w-5 h-5 text-primary" />
              <h2 className="text-base font-semibold text-foreground">Company Details</h2>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Company Name <span className="text-red-400">*</span></Label>
                <Input
                  placeholder="Acme Logistics Pvt. Ltd."
                  className="h-10 bg-muted/20 border-border text-sm"
                  value={form.companyName}
                  onChange={(e) => patch("companyName", e.target.value)}
                />
                {errors.companyName && <p className="text-[11px] text-red-400">{errors.companyName}</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Company Type <span className="text-red-400">*</span></Label>
                <Select value={form.companyType} onValueChange={(v) => { if (v) patch("companyType", v); }}>
                  <SelectTrigger className="h-10 bg-muted/20 border-border text-sm">
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.companyType && <p className="text-[11px] text-red-400">{errors.companyType}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">GST Number <span className="text-red-400">*</span></Label>
                  <Input
                    placeholder="22AAAAA0000A1Z5"
                    className="h-10 bg-muted/20 border-border text-sm uppercase"
                    value={form.gstNumber}
                    onChange={(e) => patch("gstNumber", e.target.value.toUpperCase())}
                    maxLength={15}
                  />
                  {errors.gstNumber && <p className="text-[11px] text-red-400">{errors.gstNumber}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">PAN Number <span className="text-red-400">*</span></Label>
                  <Input
                    placeholder="AAAPL1234C"
                    className="h-10 bg-muted/20 border-border text-sm uppercase"
                    value={form.panNumber}
                    onChange={(e) => patch("panNumber", e.target.value.toUpperCase())}
                    maxLength={10}
                  />
                  {errors.panNumber && <p className="text-[11px] text-red-400">{errors.panNumber}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Website <span className="text-muted-foreground/50">(optional)</span></Label>
                <Input
                  placeholder="https://acmelogistics.com"
                  className="h-10 bg-muted/20 border-border text-sm"
                  value={form.website}
                  onChange={(e) => patch("website", e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        {/* ── Step 1: Contact Information ── */}
        {step === 1 && (
          <>
            <div className="flex items-center gap-3 mb-2">
              <Phone className="w-5 h-5 text-primary" />
              <h2 className="text-base font-semibold text-foreground">Contact Information</h2>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Business Email <span className="text-red-400">*</span></Label>
                <Input
                  type="email"
                  placeholder="operations@acmelogistics.com"
                  className="h-10 bg-muted/20 border-border text-sm"
                  value={form.email}
                  onChange={(e) => patch("email", e.target.value)}
                />
                {errors.email && <p className="text-[11px] text-red-400">{errors.email}</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Business Phone <span className="text-red-400">*</span></Label>
                <Input
                  type="tel"
                  placeholder="+91 98765 43210"
                  className="h-10 bg-muted/20 border-border text-sm"
                  value={form.phone}
                  onChange={(e) => patch("phone", e.target.value)}
                />
                {errors.phone && <p className="text-[11px] text-red-400">{errors.phone}</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Registered Address <span className="text-red-400">*</span></Label>
                <textarea
                  placeholder="123, Industrial Area, Phase 2, Gurgaon, Haryana - 122001"
                  className="w-full min-h-[80px] px-3 py-2 rounded-lg bg-muted/20 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  value={form.address}
                  onChange={(e) => patch("address", e.target.value)}
                />
                {errors.address && <p className="text-[11px] text-red-400">{errors.address}</p>}
              </div>
            </div>
          </>
        )}

        {/* ── Step 2: Operations ── */}
        {step === 2 && (
          <>
            <div className="flex items-center gap-3 mb-2">
              <Truck className="w-5 h-5 text-primary" />
              <h2 className="text-base font-semibold text-foreground">Operations</h2>
            </div>

            <div className="space-y-6">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Fleet Size <span className="text-red-400">*</span></Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="e.g. 50"
                  className="h-10 bg-muted/20 border-border text-sm w-40"
                  value={form.fleetSize}
                  onChange={(e) => patch("fleetSize", e.target.value)}
                />
                {errors.fleetSize && <p className="text-[11px] text-red-400">{errors.fleetSize}</p>}
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Operating States <span className="text-red-400">*</span>
                  {form.operatingStates.length > 0 && (
                    <span className="ml-2 text-primary">{form.operatingStates.length} selected</span>
                  )}
                </Label>
                <ChipSelect
                  options={INDIAN_STATES}
                  selected={form.operatingStates}
                  onChange={(v) => patch("operatingStates", v)}
                />
                {errors.operatingStates && <p className="text-[11px] text-red-400">{errors.operatingStates}</p>}
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Cargo Categories <span className="text-red-400">*</span>
                  {form.cargoCategories.length > 0 && (
                    <span className="ml-2 text-primary">{form.cargoCategories.length} selected</span>
                  )}
                </Label>
                <ChipSelect
                  options={CARGO_CATEGORIES}
                  selected={form.cargoCategories}
                  onChange={(v) => patch("cargoCategories", v)}
                />
                {errors.cargoCategories && <p className="text-[11px] text-red-400">{errors.cargoCategories}</p>}
              </div>
            </div>
          </>
        )}

        {/* ── Navigation buttons ── */}
        <div className="flex items-center justify-between pt-4 border-t border-border/40">
          {step > 0 ? (
            <Button
              variant="outline"
              className="h-10 px-5"
              onClick={() => { setErrors({}); setStep((s) => s - 1); }}
              disabled={saving}
            >
              Back
            </Button>
          ) : (
            <div />
          )}

          {step < 2 ? (
            <Button className="h-10 px-6 gap-2" onClick={handleNext}>
              Continue <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button className="h-10 px-6 gap-2" onClick={handleSubmit} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : "Continue to Documents"}
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
