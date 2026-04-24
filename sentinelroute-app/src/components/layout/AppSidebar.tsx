"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  PlusSquare,
  MapPin,
  BarChart3,
  Settings,
  Route,
  ChevronRight,
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

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Shipments", href: "/shipments", icon: Package },
  { label: "Create Shipment", href: "/create-shipment", icon: PlusSquare },
  { label: "Route Intelligence", href: "/route-intelligence", icon: MapPin },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-sidebar">
      <SidebarHeader className="px-4 py-4 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center justify-center w-7 h-7 rounded bg-primary/10 border border-primary/30 shrink-0">
            <Route className="w-3.5 h-3.5 text-primary" />
          </div>
          {!collapsed && (
            <span className="font-semibold text-sm text-foreground tracking-tight truncate">
              SentinelRoute
            </span>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          <SidebarGroupLabel className="label-meta px-2 mb-1">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={isActive}
                      tooltip={item.label}
                      className={cn(
                        "relative rounded-md transition-all duration-150",
                        isActive
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent"
                      )}
                    >
                      <item.icon className="w-4 h-4 shrink-0" />
                      <span className="text-sm font-medium">{item.label}</span>
                      {isActive && !collapsed && (
                        <ChevronRight className="ml-auto w-3 h-3 opacity-60" />
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-2 py-3 border-t border-border">
        <div className={cn("flex items-center gap-2.5 px-2 py-1.5", collapsed && "justify-center")}>
          <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-primary">OP</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">Ops Manager</p>
              <p className="text-[0.65rem] text-muted-foreground truncate">FleetCo Logistics</p>
            </div>
          )}
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
