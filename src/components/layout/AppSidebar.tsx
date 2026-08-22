"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Brain,
  Building2,
  Shield,
  Users,
  UserCheck,
  Truck,
  UserCog,
  Activity,
  AlertTriangle,
  Map,
  TrendingUp,
  ShieldAlert,
  PanelLeftClose,
  PanelLeftOpen,
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
import { useCompany } from "@/lib/company-context";
import type { UserRole } from "@/lib/types";

const navItems = [
  { label: "Dashboard",          href: "/dashboard",          icon: LayoutDashboard },
  { label: "Shipments",          href: "/shipments",          icon: Package },
  { label: "Create Shipment",    href: "/create-shipment",    icon: PlusSquare },
  { label: "Your Orders",        href: "/your-orders",        icon: ClipboardList },
  { label: "Route Intelligence", href: "/route-intelligence", icon: Brain },
  { label: "Analytics",          href: "/analytics",          icon: BarChart3 },
  { label: "Company Profile",    href: "/settings?tab=company", icon: Building2 },
  { label: "Settings",           href: "/settings",           icon: Settings },
];

// ─── Sidebar collapse toggle ──────────────────────────────────────────────────
function SidebarCollapseToggle() {
  const { state, toggleSidebar } = useSidebar();
  const isExpanded = state === "expanded";
  return (
    <button
      onClick={toggleSidebar}
      aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
      className={cn(
        "flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors duration-150 shrink-0",
      )}
    >
      {isExpanded
        ? <PanelLeftClose className="w-4 h-4" />
        : <PanelLeftOpen  className="w-4 h-4" />
      }
    </button>
  );
}

// ─── Mobile slide-over drawer ─────────────────────────────────────────────────
function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { user } = useUser();
  const { isSuperAdmin, userRecord } = useCompany();

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
            aria-label="Close navigation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-auto px-3 py-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest px-3 mb-3">Navigation</p>
          <div className="space-y-1">
            {userRecord?.role === "driver" && (
              <Link href="/driver" onClick={onClose}>
                <div className={cn(
                  "relative flex items-center gap-3 px-3 py-3 text-sm font-medium transition-all duration-200 rounded-lg overflow-hidden",
                  pathname.startsWith("/driver")
                    ? "bg-emerald-400/10 text-emerald-500 font-semibold ring-1 ring-emerald-400/20 shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                )}>
                  {pathname.startsWith("/driver") && <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />}
                  <Truck className="w-4 h-4 shrink-0" />
                  Driver App
                  {pathname.startsWith("/driver") && <ChevronRight className="ml-auto w-3.5 h-3.5 opacity-60" />}
                </div>
              </Link>
            )}
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href.split("?")[0] + "/");
              return (
                <Link key={item.href + item.label} href={item.href} onClick={onClose}>
                  <div className={cn(
                    "relative flex items-center gap-3 px-3 py-3 text-sm font-medium transition-all duration-200 rounded-lg overflow-hidden",
                    isActive
                      ? "bg-primary/10 text-primary font-semibold ring-1 ring-primary/20 shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                  )}>
                    {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
                    <item.icon className="w-4 h-4 shrink-0" />
                    {item.label}
                    {isActive && <ChevronRight className="ml-auto w-3.5 h-3.5 opacity-60" />}
                  </div>
                </Link>
              );
            })}
            {isSuperAdmin && (
              <Link href="/admin/companies" onClick={onClose}>
                <div className={cn(
                  "relative flex items-center gap-3 px-3 py-3 text-sm font-medium transition-all duration-200 rounded-lg mt-2 overflow-hidden",
                  pathname.startsWith("/admin")
                    ? "bg-amber-400/10 text-amber-500 font-semibold ring-1 ring-amber-400/20 shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                )}>
                  {pathname.startsWith("/admin") && <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500" />}
                  <Shield className="w-4 h-4 shrink-0" />
                  Admin Panel
                  {pathname.startsWith("/admin") && <ChevronRight className="ml-auto w-3.5 h-3.5 opacity-60" />}
                </div>
              </Link>
            )}

            {/* ─── Workforce nav ───────────────────────────────────────── */}
            {(() => {
              const workforceNavRoles: UserRole[] = [
                "company_manager", "company_admin", "fleet_manager",
                "operations_manager", "dispatcher", "super_admin",
              ];
              const workforceItems = [
                { label: "Workforce",  href: "/workforce",          icon: Users },
                { label: "Drivers",    href: "/workforce/drivers",  icon: UserCheck },
                { label: "Vehicles",   href: "/workforce/vehicles", icon: Truck },
              ];
              const canSeeUsers =
                userRecord?.role === "company_manager" ||
                userRecord?.role === "company_admin" ||
                isSuperAdmin;
              const showWorkforce =
                workforceNavRoles.includes(userRecord?.role as UserRole) || isSuperAdmin;
              if (!showWorkforce) return null;
              return (
                <div className="mt-4">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest px-3 mb-2">Workforce</p>
                  <div className="space-y-1">
                    {workforceItems.map((item) => {
                      const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                      return (
                        <Link key={item.href} href={item.href} onClick={onClose}>
                          <div className={cn(
                            "relative flex items-center gap-3 px-3 py-3 text-sm font-medium transition-all duration-200 rounded-lg overflow-hidden",
                            isActive
                              ? "bg-primary/10 text-primary font-semibold ring-1 ring-primary/20 shadow-sm"
                              : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                          )}>
                            {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
                            <item.icon className="w-4 h-4 shrink-0" />
                            {item.label}
                          </div>
                        </Link>
                      );
                    })}
                    {canSeeUsers && (
                      <Link href="/workforce/users" onClick={onClose}>
                        <div className={cn(
                          "relative flex items-center gap-3 px-3 py-3 text-sm font-medium transition-all duration-200 rounded-lg overflow-hidden",
                          pathname.startsWith("/workforce/users")
                            ? "bg-primary/10 text-primary font-semibold ring-1 ring-primary/20 shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                        )}>
                          {pathname.startsWith("/workforce/users") && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
                          <UserCog className="w-4 h-4 shrink-0" />
                          Users
                        </div>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ─── Operational Intelligence nav ────────────────────────── */}
            {(() => {
              const intellItems = [
                { label: "Command Center",  href: "/command-center",                  icon: ShieldAlert },
                { label: "Risk Center",     href: "/company/intelligence/risk-center",icon: Activity },
                { label: "Incident Center", href: "/company/intelligence/incidents",  icon: AlertTriangle },
                { label: "Heatmap",         href: "/company/intelligence/heatmap",    icon: Map },
                { label: "Corridors",       href: "/company/intelligence/corridors",  icon: TrendingUp },
              ];
              return (
                <div className="mt-4">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest px-3 mb-2">Operational Intelligence</p>
                  <div className="space-y-1">
                    {intellItems.map((item) => {
                      const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                      return (
                        <Link key={item.href} href={item.href} onClick={onClose}>
                          <div className={cn(
                            "relative flex items-center gap-3 px-3 py-3 text-sm font-medium transition-all duration-200 rounded-lg overflow-hidden",
                            isActive
                              ? "bg-primary/10 text-primary font-semibold ring-1 ring-primary/20 shadow-sm"
                              : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                          )}>
                            {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
                            <item.icon className="w-4 h-4 shrink-0" />
                            {item.label}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* ─── Executive Analytics nav ─────────────────────────────── */}
            {(() => {
              const execRoles: UserRole[] = ["company_admin", "operations_manager", "super_admin"];
              if (!execRoles.includes(userRecord?.role as UserRole)) return null;
              const execItems = [
                { label: "Executive Summary", href: "/executive",            icon: BarChart3 },
                { label: "Shipments",          href: "/executive/shipments", icon: Package },
                { label: "Fleet",              href: "/executive/fleet",     icon: Truck },
                { label: "Drivers",            href: "/executive/drivers",   icon: Users },
                { label: "Operational",        href: "/executive/operational",icon: Activity },
                { label: "Risk",               href: "/executive/risk",      icon: AlertTriangle },
                { label: "Predictions",        href: "/executive/predictions",icon: TrendingUp },
              ];
              if (isSuperAdmin) execItems.push({ label: "Company", href: "/executive/company", icon: Building2 });
              return (
                <div className="mt-4">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest px-3 mb-2">Executive Analytics</p>
                  <div className="space-y-1">
                    {execItems.map((item) => {
                      const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                      return (
                        <Link key={item.href} href={item.href} onClick={onClose}>
                          <div className={cn(
                            "relative flex items-center gap-3 px-3 py-3 text-sm font-medium transition-all duration-200 rounded-lg overflow-hidden",
                            isActive
                              ? "bg-primary/10 text-primary font-semibold ring-1 ring-primary/20 shadow-sm"
                              : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                          )}>
                            {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
                            <item.icon className="w-4 h-4 shrink-0" />
                            {item.label}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-primary">
                {(user?.displayName ?? user?.email ?? "U")
                  .split(/[\s@.]+/)
                  .slice(0, 2)
                  .map((s: string) => s[0]?.toUpperCase() ?? "")
                  .join("") || "U"}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">
                {user?.displayName ?? user?.email ?? "User"}
              </p>
              {user?.email && user?.displayName && (
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              )}
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
  const { user } = useUser();
  const { isSuperAdmin, company, userRecord } = useCompany();

  const displayName = user?.displayName ?? user?.email ?? "User";
  const initials = displayName
    .split(/[\s@.]+/)
    .slice(0, 2)
    .map((s: string) => s[0]?.toUpperCase() ?? "")
    .join("") || "U";

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-border bg-sidebar hidden md:flex"
    >
      {/* ── Header: logo + collapse toggle ─────────────────────────────────── */}
      <SidebarHeader className="px-3 py-4 border-b border-border">
        {/* Expanded: full brand row with toggle on right */}
        <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:hidden">
          <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 shrink-0">
              <Route className="w-4 h-4 text-primary" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-sm text-foreground tracking-tight truncate">SentinelRoute</span>
              <span className="text-[9px] font-semibold text-primary uppercase tracking-widest leading-none">Intelligence</span>
            </div>
          </Link>
          <SidebarCollapseToggle />
        </div>

        {/* Collapsed: just the icon mark + toggle stacked */}
        <div className="hidden flex-col items-center gap-2 group-data-[collapsible=icon]:flex">
          <Link href="/dashboard" aria-label="SentinelRoute Dashboard">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 hover:border-primary/50 transition-colors">
              <Route className="w-4 h-4 text-primary" />
            </div>
          </Link>
          <SidebarCollapseToggle />
        </div>
      </SidebarHeader>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <SidebarContent className="px-2 py-3">

        {/* Main navigation */}
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="px-2 mb-1">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {userRecord?.role === "driver" && (
                <SidebarMenuItem key="driver-app">
                  <SidebarMenuButton
                    render={<Link href="/driver" />}
                    isActive={pathname === "/driver" || pathname.startsWith("/driver/")}
                    tooltip="Driver App"
                    className={cn(
                      "relative rounded-lg transition-all duration-200 py-3 overflow-hidden",
                      pathname.startsWith("/driver")
                        ? "bg-emerald-400/10 text-emerald-500 font-semibold ring-1 ring-emerald-400/20 shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                    )}
                  >
                    {pathname.startsWith("/driver") && <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />}
                    <Truck className="w-4 h-4 shrink-0" />
                    <span className="text-sm font-medium">Driver App</span>
                    {pathname.startsWith("/driver") && (
                      <ChevronRight className="ml-auto w-3.5 h-3.5 opacity-60" />
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {navItems.map((item) => {
                const isActive = pathname === item.href.split("?")[0] ||
                  pathname.startsWith(item.href.split("?")[0] + "/");
                const isCreateShipment = item.href === "/create-shipment";
                return (
                  <SidebarMenuItem key={item.href + item.label}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={isActive}
                      tooltip={item.label}
                      className={cn(
                        "relative rounded-md transition-colors duration-150 py-2 overflow-hidden",
                        isActive
                          ? "bg-primary/8 text-primary font-semibold"
                          : isCreateShipment
                          ? "text-primary border border-primary/20 hover:bg-primary/8 hover:border-primary/30"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/40",
                      )}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary group-data-[collapsible=icon]:hidden" />
                      )}
                      <item.icon className="w-4 h-4 shrink-0" />
                      <span className="text-sm">{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              {/* Admin */}
              {isSuperAdmin && (
                <SidebarMenuItem key="admin">
                  <SidebarMenuButton
                    render={<Link href="/admin/companies" />}
                    isActive={pathname.startsWith("/admin")}
                    tooltip="Admin Panel"
                    className={cn(
                      "relative rounded-md transition-colors duration-150 py-2 mt-1 overflow-hidden",
                      pathname.startsWith("/admin")
                        ? "bg-[var(--sr-amber)]/8 text-[var(--sr-amber)] font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/40",
                    )}
                  >
                    {pathname.startsWith("/admin") && (
                      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[var(--sr-amber)] group-data-[collapsible=icon]:hidden" />
                    )}
                    <Shield className="w-4 h-4 shrink-0" />
                    <span className="text-sm">Admin Panel</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ─── Workforce nav ──────────────────────────────────────────────── */}
        {(() => {
          const workforceNavRoles: UserRole[] = [
            "company_manager", "company_admin", "fleet_manager",
            "operations_manager", "dispatcher", "super_admin",
          ];
          const workforceItems = [
            { label: "Workforce",  href: "/workforce",          icon: Users },
            { label: "Drivers",    href: "/workforce/drivers",  icon: UserCheck },
            { label: "Vehicles",   href: "/workforce/vehicles", icon: Truck },
          ];
          const canSeeUsers =
            userRecord?.role === "company_manager" ||
            userRecord?.role === "company_admin" ||
            isSuperAdmin;
          if (!workforceNavRoles.includes(userRecord?.role as UserRole) && !isSuperAdmin) return null;

          return (
            <SidebarGroup className="p-0 mt-1">
              <SidebarGroupLabel className="px-2 mb-1">Workforce</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-0.5">
                  {workforceItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          render={<Link href={item.href} />}
                          isActive={isActive}
                          tooltip={item.label}
                          className={cn(
                            "relative rounded-md transition-colors duration-150 py-2 overflow-hidden",
                            isActive
                              ? "bg-primary/8 text-primary font-semibold"
                              : "text-muted-foreground hover:text-foreground hover:bg-accent/40",
                          )}
                        >
                          {isActive && (
                            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary group-data-[collapsible=icon]:hidden" />
                          )}
                          <item.icon className="w-4 h-4 shrink-0" />
                          <span className="text-sm">{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                  {canSeeUsers && (
                    <SidebarMenuItem key="/workforce/users">
                      <SidebarMenuButton
                        render={<Link href="/workforce/users" />}
                        isActive={pathname.startsWith("/workforce/users")}
                        tooltip="Users"
                        className={cn(
                          "relative rounded-md transition-colors duration-150 py-2 overflow-hidden",
                          pathname.startsWith("/workforce/users")
                            ? "bg-primary/8 text-primary font-semibold"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent/40",
                        )}
                      >
                        {pathname.startsWith("/workforce/users") && (
                          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary group-data-[collapsible=icon]:hidden" />
                        )}
                        <UserCog className="w-4 h-4 shrink-0" />
                        <span className="text-sm">Users</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })()}

        {/* ─── Operational Intelligence nav ───────────────────────────────── */}
        {(() => {
          const intellItems = [
            { label: "Command Center",  href: "/command-center",                   icon: ShieldAlert },
            { label: "Risk Center",     href: "/company/intelligence/risk-center", icon: Activity },
            { label: "Incident Center", href: "/company/intelligence/incidents",   icon: AlertTriangle },
            { label: "Heatmap",         href: "/company/intelligence/heatmap",     icon: Map },
            { label: "Corridors",       href: "/company/intelligence/corridors",   icon: TrendingUp },
          ];
          return (
            <SidebarGroup className="p-0 mt-1">
              <SidebarGroupLabel className="px-2 mb-1">Operational Intelligence</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-0.5">
                  {intellItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          render={<Link href={item.href} />}
                          isActive={isActive}
                          tooltip={item.label}
                          className={cn(
                            "relative rounded-md transition-colors duration-150 py-2 overflow-hidden",
                            isActive
                              ? "bg-primary/8 text-primary font-semibold"
                              : "text-muted-foreground hover:text-foreground hover:bg-accent/40",
                          )}
                        >
                          {isActive && (
                            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary group-data-[collapsible=icon]:hidden" />
                          )}
                          <item.icon className="w-4 h-4 shrink-0" />
                          <span className="text-sm">{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })()}

        {/* ─── Executive Analytics nav ────────────────────────────────────── */}
        {(() => {
          const execRoles: UserRole[] = ["company_admin", "operations_manager", "super_admin"];
          if (!execRoles.includes(userRecord?.role as UserRole)) return null;
          const execItems = [
            { label: "Executive Summary", href: "/executive",             icon: BarChart3 },
            { label: "Shipments",          href: "/executive/shipments",  icon: Package },
            { label: "Fleet",              href: "/executive/fleet",      icon: Truck },
            { label: "Drivers",            href: "/executive/drivers",    icon: Users },
            { label: "Operational",        href: "/executive/operational",icon: Activity },
            { label: "Risk",               href: "/executive/risk",       icon: AlertTriangle },
            { label: "Predictions",        href: "/executive/predictions",icon: TrendingUp },
          ];
          if (isSuperAdmin) execItems.push({ label: "Company", href: "/executive/company", icon: Building2 });
          return (
            <SidebarGroup className="p-0 mt-1">
              <SidebarGroupLabel className="px-2 mb-1">Executive Analytics</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-0.5">
                  {execItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          render={<Link href={item.href} />}
                          isActive={isActive}
                          tooltip={item.label}
                          className={cn(
                            "relative rounded-md transition-colors duration-150 py-2 overflow-hidden",
                            isActive
                              ? "bg-primary/8 text-primary font-semibold"
                              : "text-muted-foreground hover:text-foreground hover:bg-accent/40",
                          )}
                        >
                          {isActive && (
                            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary group-data-[collapsible=icon]:hidden" />
                          )}
                          <item.icon className="w-4 h-4 shrink-0" />
                          <span className="text-sm">{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })()}

      </SidebarContent>

      {/* ── Footer: company + user ───────────────────────────────────────────── */}
      <SidebarFooter className="px-3 py-4 border-t border-border">
        {/* Company block — hidden when collapsed */}
        {company && (
          <div className="px-2 py-2 mb-1 border border-border/40 rounded-lg bg-muted/10 group-data-[collapsible=icon]:hidden">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">Company</p>
            <p className="text-xs font-semibold text-foreground truncate">{company.companyName}</p>
          </div>
        )}
        {/* User area */}
        <div className="flex items-center gap-3 px-2 py-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          {/* Avatar — always visible, centered in collapsed */}
          <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-primary">{initials}</span>
          </div>
          {/* Name / email — hidden when collapsed */}
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
            {user?.email && user?.displayName && (
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            )}
          </div>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

// ─── Export mobile nav hook for AppHeader ─────────────────────────────────────
export { MobileNav };
