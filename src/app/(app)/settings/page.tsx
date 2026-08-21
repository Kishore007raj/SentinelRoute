"use client";

import { useEffect, useState } from "react";
import { Bell, Shield, Truck, Lock, Save, Building2, Sliders } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSettings } from "@/lib/settings-context";
import { useCompany } from "@/lib/company-context";
import type { UserSettings } from "@/lib/types";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { auth } from "@/lib/firebase";

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5 border-b border-border/40 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-foreground">{label}</p>
        {description && <p className="text-[11px] text-muted-foreground mt-0.5 max-w-md">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const { settings, save } = useSettings();
  const { company } = useCompany();
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Partial<UserSettings>>({});

  useEffect(() => {
    if (settings) setDraft(settings);
  }, [settings]);

  const patch = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await save(draft);
      toast.success("Settings saved", { description: "Your preferences have been updated." });
    } catch {
      toast.error("Failed to save settings", { description: "Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwLoading, setPwLoading] = useState(false);

  const handleUpdatePassword = async () => {
    if (!pwForm.next || pwForm.next !== pwForm.confirm) {
      toast.error("Passwords do not match");
      return;
    }
    if (pwForm.next.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    const user = auth.currentUser;
    if (!user || !user.email) {
      toast.error("Not authenticated");
      return;
    }

    setPwLoading(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, pwForm.current);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, pwForm.next);
      setPwForm({ current: "", next: "", confirm: "" });
      toast.success("Password updated");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        toast.error("Current password is incorrect");
      } else {
        toast.error("Failed to update password", { description: code });
      }
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-7 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="label-meta flex items-center gap-2 mb-2">
            <Sliders className="w-3.5 h-3.5 text-primary" />
            Configuration & User Preferences
          </p>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage company profile, notification routing, risk thresholds, and dispatch defaults.
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="h-10 px-5 font-bold text-xs uppercase tracking-wider bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
        >
          {saving ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5" /> Save Changes
            </>
          )}
        </Button>
      </div>

      {/* Tabs Layout */}
      <Tabs defaultValue="company" className="w-full">
        <TabsList className="h-auto bg-transparent gap-0 p-0 rounded-none border-b border-border w-full flex-wrap justify-start mb-6">
          {[
            { id: "company", label: "Company Profile", icon: Building2 },
            { id: "notifications", label: "Notifications", icon: Bell },
            { id: "thresholds", label: "Risk Thresholds", icon: Shield },
            { id: "dispatch", label: "Dispatch Defaults", icon: Truck },
            { id: "security", label: "Account Security", icon: Lock },
          ].map(({ id, label, icon: Icon }) => (
            <TabsTrigger
              key={id}
              value={id}
              className={cn(
                "relative h-10 px-4 text-xs font-semibold text-muted-foreground rounded-none border-b-2 border-transparent",
                "data-[state=active]:text-foreground data-[state=active]:border-primary",
                "hover:text-foreground/80 transition-colors bg-transparent",
                "flex items-center gap-2 uppercase tracking-wider"
              )}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── 1. Company Profile ── */}
        <TabsContent value="company" className="space-y-6 outline-none mt-0">
          <div className="panel p-5 bg-card space-y-4">
            <div className="border-b border-border/40 pb-3">
              <p className="label-meta">Company Identification</p>
              <h3 className="text-sm font-bold text-foreground">Organization Context</h3>
            </div>

            <div className="space-y-4 max-w-lg">
              <div className="space-y-1.5">
                <label className="label-meta">Company Name</label>
                <Input
                  value={company?.companyName ?? ""}
                  disabled
                  className="h-10 bg-muted/20 border-border text-xs font-medium text-muted-foreground cursor-not-allowed"
                />
              </div>

              <div className="space-y-1.5">
                <label className="label-meta">Company ID</label>
                <Input
                  value={company?.companyId ?? ""}
                  disabled
                  className="h-10 bg-muted/20 border-border text-xs font-mono text-muted-foreground cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── 2. Notifications ── */}
        <TabsContent value="notifications" className="space-y-6 outline-none mt-0">
          <div className="panel p-5 bg-card space-y-4">
            <div className="border-b border-border/40 pb-3">
              <p className="label-meta">Notification Channels</p>
              <h3 className="text-sm font-bold text-foreground">Alert Routing Preferences</h3>
            </div>

            <div className="divide-y divide-border/40">
              <SettingRow label="Risk Alert Notifications" description="Receive high-priority risk alerts.">
                <Switch
                  checked={draft.notifyRiskAlerts ?? true}
                  onCheckedChange={(v) => patch("notifyRiskAlerts", v)}
                />
              </SettingRow>

              <SettingRow label="Disruption Warnings" description="Receive notification for route disruption events.">
                <Switch
                  checked={draft.notifyDisruptions ?? true}
                  onCheckedChange={(v) => patch("notifyDisruptions", v)}
                />
              </SettingRow>

              <SettingRow label="Weather Warnings" description="Receive automated severe weather warnings.">
                <Switch
                  checked={draft.notifyWeatherWarnings ?? true}
                  onCheckedChange={(v) => patch("notifyWeatherWarnings", v)}
                />
              </SettingRow>

              <SettingRow label="Dispatch Confirmations" description="Receive confirmation upon trip dispatch.">
                <Switch
                  checked={draft.notifyDispatchConfirm ?? true}
                  onCheckedChange={(v) => patch("notifyDispatchConfirm", v)}
                />
              </SettingRow>
            </div>
          </div>
        </TabsContent>

        {/* ── 3. Risk Thresholds ── */}
        <TabsContent value="thresholds" className="space-y-6 outline-none mt-0">
          <div className="panel p-5 bg-card space-y-4">
            <div className="border-b border-border/40 pb-3">
              <p className="label-meta">Sensitivity Calibration</p>
              <h3 className="text-sm font-bold text-foreground">Operational Risk Thresholds</h3>
            </div>

            <div className="space-y-6 max-w-lg">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-foreground">Auto Flag Risk Threshold</span>
                  <span className="font-mono font-bold text-amber-400 tabular-nums">
                    {draft.autoFlagThreshold ?? 60}/100
                  </span>
                </div>
                <Slider
                  min={10}
                  max={90}
                  step={5}
                  value={[draft.autoFlagThreshold ?? 60]}
                  onValueChange={([v]) => patch("autoFlagThreshold", v)}
                  className="w-full"
                />
                <p className="text-[11px] text-muted-foreground">
                  Shipments exceeding this composite score trigger warning alerts.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-foreground">Approval Cutoff Threshold</span>
                  <span className="font-mono font-bold text-red-400 tabular-nums">
                    {draft.requireApprovalAbove ?? 75}/100
                  </span>
                </div>
                <Slider
                  min={20}
                  max={90}
                  step={5}
                  value={[draft.requireApprovalAbove ?? 75]}
                  onValueChange={([v]) => patch("requireApprovalAbove", v)}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── 4. Dispatch Defaults ── */}
        <TabsContent value="dispatch" className="space-y-6 outline-none mt-0">
          <div className="panel p-5 bg-card space-y-4">
            <div className="border-b border-border/40 pb-3">
              <p className="label-meta">Operational Presets</p>
              <h3 className="text-sm font-bold text-foreground">Default Dispatch Parameters</h3>
            </div>

            <div className="space-y-4 max-w-md">
              <div className="space-y-1.5">
                <label className="label-meta">Default Vehicle Type</label>
                <Select
                  value={draft.defaultVehicleType ?? "Container Truck"}
                  onValueChange={(v: string | null) => {
                    if (v) patch("defaultVehicleType", v);
                  }}
                >
                  <SelectTrigger className="h-10 bg-muted/20 border-border text-xs font-medium">
                    <SelectValue placeholder="Select vehicle type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mini Truck">Mini Truck</SelectItem>
                    <SelectItem value="Container Truck">Container Truck</SelectItem>
                    <SelectItem value="Reefer Truck">Reefer Truck</SelectItem>
                    <SelectItem value="Express Van">Express Van</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="label-meta">Preferred Routing Profile</label>
                <Select
                  value={draft.preferredRouteType ?? "balanced"}
                  onValueChange={(v: string | null) => {
                    if (v) patch("preferredRouteType", v as "fastest" | "safest" | "balanced");
                  }}
                >
                  <SelectTrigger className="h-10 bg-muted/20 border-border text-xs font-medium">
                    <SelectValue placeholder="Select profile" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="balanced">Balanced Corridor</SelectItem>
                    <SelectItem value="fastest">Fastest Transit</SelectItem>
                    <SelectItem value="safest">Safest Path</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── 5. Account Security ── */}
        <TabsContent value="security" className="space-y-6 outline-none mt-0">
          <div className="panel p-5 bg-card space-y-4">
            <div className="border-b border-border/40 pb-3">
              <p className="label-meta">Credentials</p>
              <h3 className="text-sm font-bold text-foreground">Account Security & Password</h3>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleUpdatePassword();
              }}
              className="space-y-4 max-w-md"
            >
              <div className="space-y-1.5">
                <label className="label-meta">Current Password</label>
                <Input
                  type="password"
                  value={pwForm.current}
                  onChange={(e) => setPwForm((p) => ({ ...p, current: e.target.value }))}
                  required
                  placeholder="••••••••"
                  className="h-10 bg-muted/20 border-border text-xs font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="label-meta">New Password</label>
                <Input
                  type="password"
                  value={pwForm.next}
                  onChange={(e) => setPwForm((p) => ({ ...p, next: e.target.value }))}
                  required
                  placeholder="••••••••"
                  className="h-10 bg-muted/20 border-border text-xs font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="label-meta">Confirm New Password</label>
                <Input
                  type="password"
                  value={pwForm.confirm}
                  onChange={(e) => setPwForm((p) => ({ ...p, confirm: e.target.value }))}
                  required
                  placeholder="••••••••"
                  className="h-10 bg-muted/20 border-border text-xs font-medium"
                />
              </div>

              <Button
                type="submit"
                disabled={pwLoading}
                className="h-9 px-4 text-xs font-bold uppercase tracking-wider bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
              >
                {pwLoading ? "Updating…" : "Update Password"}
              </Button>
            </form>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
