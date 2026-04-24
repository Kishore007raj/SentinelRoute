"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Truck,
  Package,
  Clock,
  AlertTriangle,
  Zap,
  CheckCircle,
  ChevronRight,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface TileConfig {
  id: string;
  label: string;
  icon: React.ElementType;
  type: "text" | "select" | "location";
  options?: string[];
  placeholder?: string;
  required: boolean;
}

const TILES: TileConfig[] = [
  {
    id: "origin",
    label: "Source",
    icon: MapPin,
    type: "location",
    placeholder: "e.g. Chennai",
    required: true,
  },
  {
    id: "destination",
    label: "Destination",
    icon: MapPin,
    type: "location",
    placeholder: "e.g. Bangalore",
    required: true,
  },
  {
    id: "vehicleType",
    label: "Vehicle Type",
    icon: Truck,
    type: "select",
    options: ["Mini Truck", "Container Truck", "Reefer Truck", "Express Van"],
    required: true,
  },
  {
    id: "cargoType",
    label: "Cargo Type",
    icon: Package,
    type: "select",
    options: [
      "Electronics",
      "Pharmaceuticals",
      "Cold Chain Goods",
      "Industrial Parts",
    ],
    required: true,
  },
  {
    id: "urgency",
    label: "Urgency",
    icon: Zap,
    type: "select",
    options: ["Standard", "Priority", "Critical"],
    required: true,
  },
  {
    id: "deadline",
    label: "Deadline",
    icon: Clock,
    type: "text",
    placeholder: "e.g. 2026-04-24",
    required: false,
  },
  {
    id: "insurance",
    label: "Insurance Priority",
    icon: AlertTriangle,
    type: "select",
    options: ["None", "Standard", "Full Coverage"],
    required: false,
  },
  {
    id: "tempSensitive",
    label: "Temp. Sensitivity",
    icon: AlertTriangle,
    type: "select",
    options: ["None", "Low (0-10°C)", "Frozen (-18°C)"],
    required: false,
  },
];

const LOCATION_OPTIONS = [
  "Chennai",
  "Bangalore",
  "Hyderabad",
  "Pune",
  "Mumbai",
  "Coimbatore",
  "Salem",
  "Thrissur",
  "Vijayawada",
];

type FormState = Record<string, string>;

export default function CreateShipmentPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({});
  const [activeTile, setActiveTile] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const activeTileConfig = TILES.find((t) => t.id === activeTile);

  useEffect(() => {
    setSearchQuery(activeTile ? (form[activeTile] ?? "") : "");
  }, [activeTile, form]);

  const requiredFilled = TILES.filter((t) => t.required).every(
    (t) => !!form[t.id],
  );

  const handleAnalyze = () => {
    setLoading(true);
    setTimeout(() => {
      router.push("/routes");
    }, 1600);
  };

  const setValue = (id: string, val: string) => {
    setForm((prev) => ({ ...prev, [id]: val }));
    setActiveTile(null);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Create Shipment</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your shipment parameters. Click each tile to enter details.
        </p>
      </div>

      {/* Tile grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {TILES.map((tile, i) => {
          const filled = !!form[tile.id];
          const Icon = tile.icon;
          return (
            <motion.button
              key={tile.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTile(tile.id)}
              className={cn(
                "relative flex flex-col items-start gap-2 p-4 rounded-lg border text-left transition-all duration-200",
                "bg-card hover:shadow-lg hover:shadow-black/20",
                filled
                  ? "border-primary/40 bg-primary/5"
                  : "border-border hover:border-border/80",
                tile.required && !filled && "border-dashed",
              )}
            >
              {/* Required dot */}
              {tile.required && !filled && (
                <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-amber-400" />
              )}
              {filled && (
                <span className="absolute top-2 right-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                </span>
              )}

              <Icon
                className={cn(
                  "w-5 h-5",
                  filled ? "text-primary" : "text-muted-foreground",
                )}
              />

              <div className="min-w-0 w-full">
                <p
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-wider mb-0.5",
                    filled ? "text-primary/70" : "text-muted-foreground",
                  )}
                >
                  {tile.label}
                  {tile.required && (
                    <span className="text-amber-400 ml-0.5">*</span>
                  )}
                </p>
                {filled ? (
                  <p className="text-sm font-semibold text-foreground truncate">
                    {form[tile.id]}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground/60">
                    Click to set
                  </p>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Progress indicator */}
      <div className="panel p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-foreground">
            Configuration Progress
          </p>
          <p className="text-xs text-muted-foreground">
            {TILES.filter((t) => t.required && form[t.id]).length}/
            {TILES.filter((t) => t.required).length} required fields
          </p>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            animate={{
              width: `${(TILES.filter((t) => t.required && form[t.id]).length / TILES.filter((t) => t.required).length) * 100}%`,
            }}
            transition={{ duration: 0.4 }}
          />
        </div>
        {form.origin && form.destination && (
          <p className="text-xs text-muted-foreground mt-2">
            Route:{" "}
            <span className="text-foreground font-semibold">
              {form.origin} → {form.destination}
            </span>
          </p>
        )}
      </div>

      {/* Analyze CTA */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" className="h-10 text-sm" disabled={loading}>
          Save Draft
        </Button>
        <Button
          className="h-10 text-sm gap-2 min-w-40"
          disabled={!requiredFilled || loading}
          onClick={handleAnalyze}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}
                className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
              />
              Analyzing Routes...
            </span>
          ) : (
            <>
              Analyze Routes
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>

      {/* Tile input dialog */}
      <Dialog open={!!activeTile} onOpenChange={() => setActiveTile(null)}>
        <DialogContent className="max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              {activeTileConfig && (
                <activeTileConfig.icon className="w-4 h-4 text-primary" />
              )}
              {activeTileConfig?.label}
              {activeTileConfig?.required && (
                <Badge
                  variant="outline"
                  className="text-amber-400 border-amber-400/30 text-[10px] ml-1"
                >
                  Required
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {activeTileConfig && (
            <div className="space-y-4">
              {activeTileConfig.type === "text" ? (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Enter {activeTileConfig.label}
                  </Label>
                  <Input
                    placeholder={activeTileConfig.placeholder}
                    defaultValue={form[activeTileConfig.id] ?? ""}
                    className="bg-muted/30 border-border h-9 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setValue(
                          activeTileConfig.id,
                          (e.target as HTMLInputElement).value,
                        );
                      }
                    }}
                    autoFocus
                    id="tile-input"
                  />
                  <Button
                    className="w-full h-8 text-xs"
                    onClick={() => {
                      const input = document.getElementById(
                        "tile-input",
                      ) as HTMLInputElement;
                      if (input?.value)
                        setValue(activeTileConfig.id, input.value);
                    }}
                  >
                    Confirm
                  </Button>
                </div>
              ) : activeTileConfig.type === "location" ? (
                <div className="space-y-4">
                  <Label className="text-xs text-muted-foreground">
                    Search {activeTileConfig.label}
                  </Label>
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={activeTileConfig.placeholder}
                    className="bg-muted/30 border-border h-9 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && searchQuery) {
                        setValue(activeTileConfig.id, searchQuery);
                      }
                    }}
                  />
                  <div className="grid gap-2">
                    {LOCATION_OPTIONS.filter((option) =>
                      option.toLowerCase().includes(searchQuery.toLowerCase()),
                    )
                      .slice(0, 6)
                      .map((option) => (
                        <button
                          key={option}
                          onClick={() => setValue(activeTileConfig.id, option)}
                          className={cn(
                            "w-full rounded-md border px-3 py-2 text-left text-sm transition-all",
                            form[activeTileConfig.id] === option
                              ? "bg-primary/10 border-primary/40 text-primary"
                              : "bg-muted/20 border-border text-foreground hover:bg-muted/40",
                          )}
                        >
                          {option}
                        </button>
                      ))}
                  </div>
                  <div className="rounded-2xl border border-border bg-slate-950/80 p-4 text-[11px] text-muted-foreground">
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground mb-2">
                      Location preview
                    </p>
                    <div className="h-32 rounded-xl bg-background/70 border border-border flex items-center justify-center text-center px-3">
                      {form[activeTileConfig.id] || searchQuery
                        ? `Selected: ${form[activeTileConfig.id] || searchQuery}`
                        : "Start typing a city or terminal name to preview a location."}
                    </div>
                  </div>
                  <Button
                    className="w-full h-8 text-xs"
                    onClick={() => {
                      if (searchQuery)
                        setValue(activeTileConfig.id, searchQuery);
                    }}
                  >
                    Confirm Location
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    Select {activeTileConfig.label}
                  </Label>
                  <div className="grid gap-2">
                    {activeTileConfig.options?.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setValue(activeTileConfig.id, opt)}
                        className={cn(
                          "flex items-center justify-between px-3 py-2.5 rounded-md border text-sm font-medium transition-all",
                          form[activeTileConfig.id] === opt
                            ? "bg-primary/10 border-primary/40 text-primary"
                            : "bg-muted/20 border-border text-foreground hover:bg-muted/40",
                        )}
                      >
                        {opt}
                        {form[activeTileConfig.id] === opt && (
                          <CheckCircle className="w-4 h-4" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
