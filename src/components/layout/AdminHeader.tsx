"use client";

import { useState } from "react";
import { ChevronRight, Menu, Shield, ArrowUpRight } from "lucide-react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useUser } from "@/lib/auth-context";
import { AdminMobileNav } from "@/components/layout/AdminSidebar";

const routeLabels: Record<string, string> = {
  "/admin":             "Platform Command Center",
  "/admin/companies":   "Tenant Management",
  "/admin/operational": "Global Operational Monitor",
  "/admin/audit":       "Platform Audit Center",
  "/admin/health":      "Platform Health Center",
  "/admin/analytics":   "Platform Analytics",
  "/admin/support":     "Support Tools",
};

export function AdminHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const segments = pathname.split("/").filter(Boolean);

  const pageTitle = (() => {
    if (routeLabels[pathname]) return routeLabels[pathname];
    if (segments[0] === "admin" && segments[1] === "companies" && segments.length >= 3) return "Company Inspection";
    const last = segments[segments.length - 1] ?? "Admin";
    return last.charAt(0).toUpperCase() + last.slice(1).replace(/-/g, " ");
  })();

  const handleSignOut = async () => {
    await signOut(auth);
    document.cookie = "sr_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push("/auth/signin");
  };

  const displayName = user?.displayName ?? user?.email ?? "Super Admin";
  const initials = "SA";

  return (
    <>
      <AdminMobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      <header className="h-[72px] flex items-center gap-3 sm:gap-4 px-4 sm:px-6 lg:px-8 border-b border-border bg-background/95 backdrop-blur-md shadow-sm sticky top-0 z-30">
        <button
          className="md:hidden text-muted-foreground hover:text-foreground p-1.5 -ml-1 rounded-md hover:bg-accent transition-colors"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <SidebarTrigger className="hidden md:flex text-muted-foreground hover:text-foreground -ml-1" />
        <Separator orientation="vertical" className="h-5 opacity-30 hidden md:block" />

        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="text-muted-foreground hidden sm:block shrink-0">SentinelRoute Admin</span>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 hidden sm:block shrink-0" />
          <span className="font-semibold text-foreground truncate">{pageTitle}</span>
        </div>

        <div className="flex-1" />

        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
          <Shield className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-xs font-semibold text-amber-500 uppercase tracking-widest">Super Admin</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            className="inline-flex h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none shrink-0"
            aria-label="User menu"
          >
            <Avatar className="h-7 w-7 ring-1 ring-border">
              <AvatarFallback className="bg-amber-500/20 text-amber-500 text-[10px] font-bold">{initials}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 bg-popover border-border">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal p-3">
                <p className="text-sm font-semibold truncate text-foreground">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate font-mono mt-0.5">{user?.email ?? ""}</p>
                <span className="inline-block mt-2 text-[10px] font-semibold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">Super Admin</span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="border-border" />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive cursor-pointer px-3 py-2 text-xs"
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
