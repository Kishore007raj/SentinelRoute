"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Activity,
  Shield,
  ActivitySquare,
  BarChart3,
  Wrench,
  ChevronRight,
  X,
  Route,
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
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const adminNavItems = [
  { label: "Dashboard",          href: "/admin",             icon: LayoutDashboard },
  { label: "Tenant Management",  href: "/admin/companies",   icon: Building2 },
  { label: "Global Operational", href: "/admin/operational", icon: Activity },
  { label: "Audit Center",       href: "/admin/audit",       icon: Shield },
  { label: "Health Center",      href: "/admin/health",      icon: ActivitySquare },
  { label: "Analytics",          href: "/admin/analytics",   icon: BarChart3 },
  { label: "Support Tools",      href: "/admin/support",     icon: Wrench },
];

export function AdminMobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-border flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-5 border-b border-border">
          <Link href="/admin" onClick={onClose} className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 shrink-0 shadow-sm">
              <Route className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-sm text-foreground tracking-tight">SentinelRoute</span>
              <span className="text-[10px] font-semibold text-amber-500 uppercase tracking-widest">Admin Console</span>
            </div>
          </Link>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-accent transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-3 py-4">
          <p className="label-meta px-3 mb-3">Platform Console</p>
          <div className="space-y-1">
            {adminNavItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href + "/"));
              return (
                <Link key={item.href + item.label} href={item.href} onClick={onClose}>
                  <div className={cn(
                    "relative flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all duration-200 rounded-lg overflow-hidden",
                    isActive
                      ? "bg-amber-500/10 text-amber-500 font-semibold ring-1 ring-amber-500/20 shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                  )}>
                    {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500" />}
                    <item.icon className={cn("w-4 h-4 shrink-0", isActive ? "text-amber-500" : "text-muted-foreground")} />
                    {item.label}
                    {isActive && <ChevronRight className="ml-auto w-3.5 h-3.5 opacity-60" />}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar className="border-r border-border">
      <SidebarHeader className="h-[72px] flex flex-col justify-center px-6 border-b border-border">
        <Link href="/admin" className="flex items-center gap-3 transition-opacity hover:opacity-80">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 shrink-0 shadow-sm">
            <Route className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm text-foreground tracking-tight leading-tight">SentinelRoute</span>
            <span className="text-[10px] font-semibold text-amber-500 uppercase tracking-widest">Platform Admin</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3 py-6">
        <SidebarGroup>
          <SidebarGroupLabel className="label-meta mb-2 px-3">
            Command Center
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {adminNavItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href + "/"));
                return (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton className="p-0 h-10 w-full hover:bg-transparent">
                      <Link href={item.href} className={cn(
                        "flex items-center gap-3 w-full h-full px-3 text-sm transition-all duration-200 rounded-lg",
                        isActive
                          ? "bg-amber-500/10 text-amber-500 font-medium ring-1 ring-amber-500/20 shadow-sm hover:bg-amber-500/15"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                      )}>
                        <item.icon className={cn("w-4 h-4 shrink-0", isActive ? "text-amber-500" : "text-muted-foreground")} />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-border">
        <div className="rounded-lg bg-muted/40 p-3.5 border border-border">
          <div className="flex items-center gap-2 text-amber-500 mb-1.5">
            <Shield className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Elevated Access</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Super Admin mode active. All cross-tenant actions and modifications are strictly audited.
          </p>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
