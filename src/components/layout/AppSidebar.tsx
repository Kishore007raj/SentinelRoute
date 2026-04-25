"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Package,
  PlusSquare,
  ClipboardList,
  BarChart3,
  Settings,
  Route,
  ChevronRight,
  X,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useUser } from "@/lib/auth-context";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Shipments", href: "/shipments", icon: Package },
  { label: "Create Shipment", href: "/create-shipment", icon: PlusSquare },
  { label: "Your Orders", href: "/your-orders", icon: ClipboardList },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
];

// ─── Mobile slide-over drawer ─────────────────────────────────────────────────
function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-border flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-border">
          <Link href="/dashboard" onClick={onClose} className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 shrink-0">
              <Route className="w-4 h-4 text-primary" />
            </div>
            <span className="font-semibold text-sm text-foreground tracking-tight">SentinelRoute</span>
          </Link>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-accent transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-auto px-3 py-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest px-3 mb-3">Navigation</p>
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link key={item.href} href={item.href} onClick={onClose}>
                  <div className={cn(
                    "flex items-center gap-3 px-3 py-3 text-sm font-medium transition-colors rounded-lg",
                    isActive
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent",
                  )}>
                    <item.icon className="w-4 h-4 shrink-0" />
                    {item.label}
                    {isActive && <ChevronRight className="ml-auto w-3.5 h-3.5 opacity-60" />}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-primary">OP</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">Ops Manager</p>
              <p className="text-xs text-muted-foreground truncate">FleetCo Logistics</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Desktop sidebar ──────────────────────────────────────────────────────────
export function AppSidebar() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-sidebar hidden md:flex">
      <SidebarHeader className="px-5 py-5 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 shrink-0">
            <Route className="w-4 h-4 text-primary" />
          </div>
          {!collapsed && (
            <span className="font-semibold text-sm text-foreground tracking-tight truncate">
              SentinelRoute
            </span>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="label-meta px-3 mb-2">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={isActive}
                      tooltip={item.label}
                      className={cn(
                        "relative rounded-lg transition-all duration-150 py-3",
                        isActive
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent"
                      )}
                    >
                      <item.icon className="w-4 h-4 shrink-0" />
                      <span className="text-sm font-medium">{item.label}</span>
                      {isActive && !collapsed && (
                        <ChevronRight className="ml-auto w-3.5 h-3.5 opacity-60" />
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-3 py-4 border-t border-border">
        <div className={cn("flex items-center gap-3 px-2 py-2", collapsed && "justify-center")}>
          <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-primary">OP</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">Ops Manager</p>
              <p className="text-xs text-muted-foreground truncate">FleetCo Logistics</p>
            </div>
          )}
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

// ─── Export mobile nav hook for AppHeader ─────────────────────────────────────
export { MobileNav };
