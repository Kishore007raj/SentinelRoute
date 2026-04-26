"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Building, Bell, Shield, Truck, Lock, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSettings } from "@/lib/settings-context";
import type { UserSettings } from "@/lib/types";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { auth } from "@/lib/firebase";

const sections = [
  { id: "notifications", label: "Notifications",        icon: Bell   },
  { id: "thresholds",    label: "Risk Thresholds",       icon: Shield },
  { id: "dispatch",      label: "Dispatch Defaults",     icon: Truck  },
  { id: "security",      label: "Account Security",      icon: Lock   },
];

function SettingRow({ label, description, children }: {
  label: string; description?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const { settings, loading, save } = useSettings();
  const [saving, setSaving] = useState(false);

  // Local draft — mirrors settings, allows editing before save
  const [draft, setDraft] = useState<Partial<UserSettings>>({});

  // Sync draft when settings load
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

  // Password change state
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
    if (!user || !user.email) { toast.error("Not authenticated"); return; }

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

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto w-full py-32 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
          className="w-8 h-8 border-2 border-border border-t-primary rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto w-full space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Workspace</p>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your workspace and operational preferences</p>
        </div>
        <Button className="gap-2 px-5 h-10 shrink-0" onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <Tabs defaultValue="notifications">
        <TabsList className="h-11 bg-muted/20 gap-1 p-1 flex-wrap">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <TabsTrigger key={s.id} value={s.id} className="text-sm h-9 px-4 gap-2">
                <Icon className="w-3.5 h-3.5" />
                {s.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* ── Notifications ── */}
        <TabsContent value="notifications" className="mt-8">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border p-8 divide-y divide-border/40">
            {([
              { key: "notifyRiskAlerts",        label: "Predictive Risk Alerts",         desc: "Notify when route risk score exceeds threshold" },
              { key: "notifyDispatchConfirm",   label: "Shipment Dispatch Confirmation", desc: "Send confirmation on every dispatch action" },
              { key: "notifyDisruptions",       label: "Route Disruption Events",        desc: "Real-time alerts for road closures and disruptions" },
              { key: "notifyCompletionSummary", label: "Completion Summaries",           desc: "Daily summary of completed shipments" },
              { key: "notifyWeatherWarnings",   label: "Weather Impact Warnings",        desc: "Early warnings for weather-related route risks" },
              { key: "notifyAnalyticsDigest",   label: "Analytics Digest",              desc: "Weekly analytics report to registered email" },
            ] as { key: keyof UserSettings; label: string; desc: string }[]).map((item) => (
              <SettingRow key={item.key} label={item.label} description={item.desc}>
                <Switch
                  checked={!!(draft[item.key] ?? false)}
                  onCheckedChange={(v) => patch(item.key, v as UserSettings[typeof item.key])}
                />
              </SettingRow>
            ))}
          </motion.div>
        </TabsContent>

        {/* ── Risk Thresholds ── */}
        <TabsContent value="thresholds" className="mt-8">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border p-8 space-y-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Auto-Flag Threshold</p>
                  <p className="text-sm text-muted-foreground">Shipments above this risk score are flagged for review</p>
                </div>
                <span className="text-2xl font-bold text-amber-400">{draft.autoFlagThreshold ?? 60}</span>
              </div>
              <Slider
                value={[draft.autoFlagThreshold ?? 60]}
                onValueChange={([v]) => patch("autoFlagThreshold", v)}
                min={0} max={100} step={5}
              />
              <div className="flex justify-between">
                <span className="text-xs text-emerald-400">Low Risk</span>
                <span className="text-xs text-red-400">Critical</span>
              </div>
            </div>
            <Separator className="opacity-30" />
            {([
              { key: "requireApprovalAbove", label: "Require Approval Above", desc: "Require manager approval for dispatch when risk exceeds" },
              { key: "autoBlockThreshold",   label: "Auto-Block Threshold",   desc: "Automatically block dispatch above this risk level" },
            ] as { key: keyof UserSettings; label: string; desc: string }[]).map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-6">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
                <Input
                  type="number"
                  min={0} max={100}
                  value={String(draft[item.key] ?? "")}
                  onChange={(e) => patch(item.key, Number(e.target.value) as UserSettings[typeof item.key])}
                  className="w-20 h-11 text-sm text-center bg-muted/20 border-border"
                />
              </div>
            ))}
            <Separator className="opacity-30" />
            <SettingRow label="Preferred Route Type" description="Default route selection preference for new shipments">
              <Select
                value={draft.preferredRouteType ?? "balanced"}
                onValueChange={(v) => { if (v) patch("preferredRouteType", v as "fastest" | "balanced" | "safest"); }}
              >
                <SelectTrigger className="w-36 h-11 text-sm bg-muted/20 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fastest">Fastest</SelectItem>
                  <SelectItem value="balanced">Balanced</SelectItem>
                  <SelectItem value="safest">Safest</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>
          </motion.div>
        </TabsContent>

        {/* ── Dispatch Defaults ── */}
        <TabsContent value="dispatch" className="mt-8">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border p-8 divide-y divide-border/40">
            <SettingRow label="Default Vehicle Type" description="Pre-selected vehicle for new shipments">
              <Select
                value={draft.defaultVehicleType ?? "Container Truck"}
                onValueChange={(v) => { if (v) patch("defaultVehicleType", v); }}
              >
                <SelectTrigger className="w-44 h-11 text-sm bg-muted/20 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mini Truck">Mini Truck</SelectItem>
                  <SelectItem value="Container Truck">Container Truck</SelectItem>
                  <SelectItem value="Reefer Truck">Reefer Truck</SelectItem>
                  <SelectItem value="Express Van">Express Van</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>
            <SettingRow label="Dispatch Confirmation Window" description="Time window to confirm before auto-cancel">
              <Select
                value={String(draft.dispatchConfirmWindow ?? 30)}
                onValueChange={(v) => { if (v) patch("dispatchConfirmWindow", Number(v)); }}
              >
                <SelectTrigger className="w-36 h-11 text-sm bg-muted/20 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>
          </motion.div>
        </TabsContent>

        {/* ── Security ── */}
        <TabsContent value="security" className="mt-8">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border p-8 space-y-8">
            <p className="text-sm font-semibold text-foreground">Change Password</p>
            <div className="grid gap-5 max-w-sm">
              {([
                { key: "current", label: "Current Password" },
                { key: "next",    label: "New Password" },
                { key: "confirm", label: "Confirm New Password" },
              ] as { key: keyof typeof pwForm; label: string }[]).map((f) => (
                <div key={f.key} className="space-y-2">
                  <Label className="text-sm text-muted-foreground">{f.label}</Label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={pwForm[f.key]}
                    onChange={(e) => setPwForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    className="h-11 text-sm bg-muted/20 border-border"
                  />
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              className="h-10 px-5 text-sm"
              onClick={handleUpdatePassword}
              disabled={pwLoading || !pwForm.current || !pwForm.next || !pwForm.confirm}
            >
              {pwLoading ? "Updating..." : "Update Password"}
            </Button>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
