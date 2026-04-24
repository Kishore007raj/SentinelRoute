"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Building, Bell, Shield, Truck, Lock, Save, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const sections = [
  { id: "company", label: "Company Profile", icon: Building },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "thresholds", label: "Route Risk Thresholds", icon: Shield },
  { id: "dispatch", label: "Dispatch Defaults", icon: Truck },
  { id: "security", label: "Account Security", icon: Lock },
];

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
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
  const [riskThreshold, setRiskThreshold] = useState([60]);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    toast.success("Settings saved", { description: "Your preferences have been updated." });
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your workspace and operational preferences</p>
        </div>
        <Button className="h-8 text-xs gap-1.5" onClick={handleSave}>
          <Save className="w-3.5 h-3.5" />
          {saved ? "Saved!" : "Save Changes"}
        </Button>
      </div>

      <Tabs defaultValue="company">
        <TabsList className="h-8 mb-6 bg-muted/30 flex-wrap gap-1">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <TabsTrigger key={s.id} value={s.id} className="text-xs h-7 px-3 gap-1.5">
                <Icon className="w-3 h-3" />
                {s.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Company Profile */}
        <TabsContent value="company">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="panel p-5 space-y-1">
            <p className="label-meta mb-4">Company Information</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: "Company Name", placeholder: "FleetCo Logistics", defaultValue: "FleetCo Logistics" },
                { label: "Company Type", placeholder: "Freight & Logistics" },
                { label: "Operations Manager", placeholder: "Ops Manager" },
                { label: "Fleet Size", placeholder: "e.g. 120 vehicles" },
              ].map((f) => (
                <div key={f.label} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{f.label}</Label>
                  <Input defaultValue={f.defaultValue} placeholder={f.placeholder} className="h-8 text-sm bg-muted/20 border-border" />
                </div>
              ))}
            </div>
            <Separator className="my-4 opacity-30" />
            <p className="label-meta mb-3">Operational Level</p>
            <div className="grid grid-cols-3 gap-3">
              {["Standard", "Priority", "Enterprise"].map((level) => (
                <button
                  key={level}
                  className={cn(
                    "py-2.5 rounded-md border text-xs font-semibold transition-all",
                    level === "Enterprise"
                      ? "bg-primary/10 border-primary/40 text-primary"
                      : "bg-muted/20 border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  )}
                >
                  {level}
                  {level === "Enterprise" && <Badge className="ml-2 text-[9px] bg-primary/20 text-primary border-primary/30">Current</Badge>}
                </button>
              ))}
            </div>
            <Separator className="my-4 opacity-30" />
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Operational Notes</Label>
              <Textarea
                placeholder="Additional context for routing decisions..."
                className="text-sm bg-muted/20 border-border resize-none"
                rows={3}
              />
            </div>
          </motion.div>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="panel p-5 divide-y divide-border/50">
            {[
              { label: "Predictive Risk Alerts", description: "Notify when route risk score exceeds threshold", defaultChecked: true },
              { label: "Shipment Dispatch Confirmation", description: "Send confirmation on every dispatch action", defaultChecked: true },
              { label: "Route Disruption Events", description: "Real-time alerts for road closures and disruptions", defaultChecked: true },
              { label: "Completion Summaries", description: "Daily summary of completed shipments", defaultChecked: false },
              { label: "Weather Impact Warnings", description: "Early warnings for weather-related route risks", defaultChecked: true },
              { label: "Analytics Digest", description: "Weekly analytics report to registered email", defaultChecked: false },
            ].map((item) => (
              <SettingRow key={item.label} label={item.label} description={item.description}>
                <Switch defaultChecked={item.defaultChecked} />
              </SettingRow>
            ))}
          </motion.div>
        </TabsContent>

        {/* Risk Thresholds */}
        <TabsContent value="thresholds">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="panel p-5 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">Auto-Flag Threshold</p>
                  <p className="text-xs text-muted-foreground">Shipments above this risk score are flagged for review</p>
                </div>
                <span className="text-xl font-bold text-amber-400">{riskThreshold[0]}</span>
              </div>
              <Slider
                value={riskThreshold}
                onValueChange={setRiskThreshold}
                min={0} max={100} step={5}
                className="w-full"
              />
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-emerald-400">Low Risk</span>
                <span className="text-[10px] text-red-400">Critical</span>
              </div>
            </div>
            <Separator className="opacity-30" />
            {[
              { label: "Require Approval Above", description: "Require manager approval for dispatch when risk exceeds", value: "75" },
              { label: "Auto-Block Threshold", description: "Automatically block dispatch above this risk level", value: "90" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                </div>
                <Input defaultValue={item.value} className="w-16 h-8 text-sm text-center bg-muted/20 border-border" />
              </div>
            ))}
            <Separator className="opacity-30" />
            <SettingRow label="Preferred Route Type" description="Default route selection preference for new shipments">
              <Select defaultValue="balanced">
                <SelectTrigger className="w-32 h-8 text-xs bg-muted/20 border-border">
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

        {/* Dispatch Defaults */}
        <TabsContent value="dispatch">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="panel p-5 divide-y divide-border/50">
            <SettingRow label="Default Vehicle Type" description="Pre-selected vehicle for new shipments">
              <Select defaultValue="container">
                <SelectTrigger className="w-40 h-8 text-xs bg-muted/20 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mini">Mini Truck</SelectItem>
                  <SelectItem value="container">Container Truck</SelectItem>
                  <SelectItem value="reefer">Reefer Truck</SelectItem>
                  <SelectItem value="express">Express Van</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>
            <SettingRow label="Require Shipment Pass" description="Always generate a Shipment Pass before dispatch">
              <Switch defaultChecked />
            </SettingRow>
            <SettingRow label="Audit Trail" description="Record every routing decision for compliance review">
              <Switch defaultChecked />
            </SettingRow>
            <SettingRow label="Auto-Assign Shipment Code" description="Automatically generate SR-XXXX codes">
              <Switch defaultChecked />
            </SettingRow>
            <SettingRow label="Dispatch Confirmation Window" description="Time window to confirm before auto-cancel">
              <Select defaultValue="30">
                <SelectTrigger className="w-28 h-8 text-xs bg-muted/20 border-border">
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

        {/* Security */}
        <TabsContent value="security">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="panel p-5 space-y-5">
            <p className="label-meta">Authentication</p>
            <div className="grid gap-4">
              {[
                { label: "Current Password", type: "password" },
                { label: "New Password", type: "password" },
                { label: "Confirm Password", type: "password" },
              ].map((f) => (
                <div key={f.label} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{f.label}</Label>
                  <Input type={f.type} placeholder="••••••••" className="h-8 text-sm bg-muted/20 border-border" />
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="h-8 text-xs">Update Password</Button>
            <Separator className="opacity-30" />
            <p className="label-meta">Access Control</p>
            <div className="divide-y divide-border/50">
              <SettingRow label="Two-Factor Authentication" description="Require 2FA for all dispatch actions">
                <Switch />
              </SettingRow>
              <SettingRow label="Session Timeout" description="Auto-logout after period of inactivity">
                <Select defaultValue="60">
                  <SelectTrigger className="w-28 h-8 text-xs bg-muted/20 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="240">4 hours</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
