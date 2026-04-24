import { cookies } from "next/headers";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { PageTransition } from "@/components/layout/PageTransition";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const sidebarState = cookieStore.get("sidebar_state");
  const defaultOpen = sidebarState ? sidebarState.value === "true" : true;

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar />
      <SidebarInset className="flex flex-col min-h-screen overflow-hidden">
        <AppHeader />
        <main className="flex-1 overflow-auto px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
          <PageTransition>{children}</PageTransition>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
