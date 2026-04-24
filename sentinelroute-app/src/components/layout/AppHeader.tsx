"use client";
import { Bell, Search, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { usePathname } from "next/navigation";

const routeLabels: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/shipments": "Shipments",
  "/create-shipment": "Create Shipment",
  "/route-intelligence": "Route Intelligence",
  "/analytics": "Analytics",
  "/settings": "Settings",
  "/routes": "Route Comparison",
  "/demo": "Demo",
};

export function AppHeader() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const pageTitle = routeLabels[pathname] ?? segments[segments.length - 1] ?? "Dashboard";

  return (
    <header className="h-12 flex items-center gap-3 px-4 border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-30">
      <SidebarTrigger className="text-muted-foreground hover:text-foreground -ml-1" />
      <Separator orientation="vertical" className="h-5 opacity-30" />

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm">
        <span className="text-muted-foreground hidden sm:block">SentinelRoute</span>
        <ChevronRight className="w-3 h-3 text-muted-foreground/50 hidden sm:block" />
        <span className="font-medium text-foreground">{pageTitle}</span>
      </div>

      <div className="flex-1" />

      {/* Search placeholder */}
      <button className="hidden md:flex items-center gap-2 h-7 px-3 rounded-md border border-border bg-muted/30 text-muted-foreground text-xs hover:bg-muted/50 transition-colors">
        <Search className="w-3 h-3" />
        <span>Search shipments...</span>
        <kbd className="ml-1 px-1 py-0.5 text-[10px] bg-muted border border-border rounded font-mono">⌘K</kbd>
      </button>

      {/* Notifications */}
      <Button variant="ghost" size="icon" className="relative h-7 w-7 text-muted-foreground hover:text-foreground">
        <Bell className="w-4 h-4" />
        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-400" />
      </Button>

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex h-7 cursor-pointer items-center gap-2 rounded-md px-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none"
          aria-label="User menu"
        >
          <Avatar className="h-6 w-6">
            <AvatarFallback className="bg-primary/20 text-primary text-[10px] font-bold">OM</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="font-normal">
            <p className="text-sm font-semibold">Ops Manager</p>
            <p className="text-xs text-muted-foreground">FleetCo Logistics</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/settings" />}>
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/" />} className="text-destructive focus:text-destructive">
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
