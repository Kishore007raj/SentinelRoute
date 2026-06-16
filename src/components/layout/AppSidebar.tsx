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
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-auto px-3 py-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest px-3 mb-3">Navigation</p>
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href.split("?")[0] + "/");
              return (
                <Link key={item.href + item.label} href={item.href} onClick={onClose}>
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
            {isSuperAdmin && (
              <Link href="/admin/companies" onClick={onClose}>
                <div className={cn(
                  "flex items-center gap-3 px-3 py-3 text-sm font-medium transition-colors rounded-lg mt-2",
                  pathname.startsWith("/admin")
                    ? "bg-amber-400/10 text-amber-400 border border-amber-400/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent",
                )}>
                  <Shield className="w-4 h-4 shrink-0" />
                  Admin Panel
                  {pathname.startsWith("/admin") && <ChevronRight className="ml-auto w-3.5 h-3.5 opacity-60" />}
                </div>
              </Link>
            )}
            {/* ─── Workforce nav (Module 2) ────────────────────────────────── */}
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
                    {canSeeUsers && (
                      <Link href="/workforce/users" onClick={onClose}>
                        <div className={cn(
                          "flex items-center gap-3 px-3 py-3 text-sm font-medium transition-colors rounded-lg",
                          pathname.startsWith("/workforce/users")
                            ? "bg-primary/10 text-primary border border-primary/20"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent",
                        )}>
                          <UserCog className="w-4 h-4 shrink-0" />
                          Users
                          {pathname.startsWith("/workforce/users") && <ChevronRight className="ml-auto w-3.5 h-3.5 opacity-60" />}
                        </div>
                      </Link>
                    )}
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
    <Sidebar collapsible="offcanvas" className="border-r border-border bg-sidebar hidden md:flex">
      <SidebarHeader className="px-5 py-5 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 shrink-0">
            <Route className="w-4 h-4 text-primary" />
          </div>
          <span className="font-semibold text-sm text-foreground tracking-tight truncate">
            SentinelRoute
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="label-meta px-3 mb-2">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href.split("?")[0] || pathname.startsWith(item.href.split("?")[0] + "/");
                return (
                  <SidebarMenuItem key={item.href + item.label}>
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
                      {isActive && (
                        <ChevronRight className="ml-auto w-3.5 h-3.5 opacity-60" />
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              {isSuperAdmin && (
                <SidebarMenuItem key="admin">
                  <SidebarMenuButton
                    render={<Link href="/admin/companies" />}
                    isActive={pathname.startsWith("/admin")}
                    tooltip="Admin Panel"
                    className={cn(
                      "relative rounded-lg transition-all duration-150 py-3 mt-2",
                      pathname.startsWith("/admin")
                        ? "bg-amber-400/10 text-amber-400 border border-amber-400/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                  >
                    <Shield className="w-4 h-4 shrink-0" />
                    <span className="text-sm font-medium">Admin Panel</span>
                    {pathname.startsWith("/admin") && (
                      <ChevronRight className="ml-auto w-3.5 h-3.5 opacity-60" />
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ─── Workforce nav (Module 2) ───────────────────────────────────── */}
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
            <SidebarGroup>
              <SidebarGroupLabel className="label-meta px-3 mb-2">Workforce</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {workforceItems.map((item) => {
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
                          {isActive && <ChevronRight className="ml-auto w-3.5 h-3.5 opacity-60" />}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                  {canSeeUsers && (
                    <SidebarMenuItem key="/workforce/users">
                      <SidebarMenuButton
                        render={<Link href="/workforce/users" />}
                        isActive={pathname === "/workforce/users" || pathname.startsWith("/workforce/users/")}
                        tooltip="Users"
                        className={cn(
                          "relative rounded-lg transition-all duration-150 py-3",
                          pathname.startsWith("/workforce/users")
                            ? "bg-primary/10 text-primary border border-primary/20"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent"
                        )}
                      >
                        <UserCog className="w-4 h-4 shrink-0" />
                        <span className="text-sm font-medium">Users</span>
                        {pathname.startsWith("/workforce/users") && <ChevronRight className="ml-auto w-3.5 h-3.5 opacity-60" />}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })()}
      </SidebarContent>

      <SidebarFooter className="px-3 py-4 border-t border-border">
        {company && (
          <div className="px-2 py-2 mb-1 border border-border/40 rounded-lg bg-muted/10">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">Company</p>
            <p className="text-xs font-semibold text-foreground truncate">{company.companyName}</p>
          </div>
        )}
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-primary">{initials}</span>
          </div>
          <div className="min-w-0">
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
