"use client";
import { useState } from "react";
import { Bell, ChevronRight, Menu } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MobileNav } from "@/components/layout/AppSidebar";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useUser } from "@/lib/auth-context";

const routeLabels: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/shipments": "Shipments",
  "/create-shipment": "Create Shipment",
  "/your-orders": "Your Orders",
  "/route-intelligence": "Route Intelligence",
  "/analytics": "Analytics",
  "/settings": "Settings",
  "/routes": "Route Comparison",
  "/demo": "Demo",
};

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const segments = pathname.split("/").filter(Boolean);
  const pageTitle = routeLabels[pathname] ?? segments[segments.length - 1] ?? "Dashboard";

  const handleSignOut = async () => {
    await signOut(auth);
    // Clear session cookie
    document.cookie = "sr_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push("/auth/signin");
  };

  // Derive initials from email or display name
  const displayName = user?.displayName ?? user?.email ?? "User";
  const initials = displayName
    .split(/[\s@.]+/)
    .slice(0, 2)
    .map((s: string) => s[0]?.toUpperCase() ?? "")
    .join("") || "U";

  return (
    <>
      <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      <header className="h-14 flex items-center gap-3 sm:gap-4 px-4 sm:px-6 lg:px-8 border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-30">
        {/* Mobile hamburger — only on small screens */}
        <button
          className="md:hidden text-muted-foreground hover:text-foreground p-1.5 -ml-1 rounded-md hover:bg-accent transition-colors"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Desktop sidebar trigger */}
        <SidebarTrigger className="hidden md:flex text-muted-foreground hover:text-foreground -ml-1" />
        <Separator orientation="vertical" className="h-5 opacity-30 hidden md:block" />

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="text-muted-foreground hidden sm:block shrink-0">SentinelRoute</span>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 hidden sm:block shrink-0" />
          <span className="font-semibold text-foreground truncate">{pageTitle}</span>
        </div>

        <div className="flex-1" />

        {/* Shipments quick-link — navigates to shipments list */}
        <Link
          href="/shipments"
          className="hidden md:flex items-center gap-2 h-9 px-4 rounded-lg border border-border bg-muted/30 text-muted-foreground text-sm hover:bg-muted/50 hover:text-foreground transition-colors"
        >
          <span>Shipments</span>
        </Link>

        {/* Notifications — not yet implemented; tooltip explains why */}
        <Tooltip>
          <TooltipTrigger
            aria-label="Notifications"
            className="relative h-9 w-9 inline-flex items-center justify-center rounded-lg text-muted-foreground opacity-40 cursor-not-allowed"
          >
            <Bell className="w-4 h-4" />
          </TooltipTrigger>
          <TooltipContent>Notifications coming soon</TooltipContent>
        </Tooltip>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none shrink-0"
            aria-label="User menu"
          >
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-primary/20 text-primary text-[10px] font-bold">{initials}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-semibold truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email ?? ""}</p>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/settings" />}>
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive cursor-pointer"
              onClick={handleSignOut}
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
    </>
  );
}
