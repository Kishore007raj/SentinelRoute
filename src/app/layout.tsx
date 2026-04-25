import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { StoreProvider } from "@/lib/store";
import { UserProvider } from "@/lib/auth-context";
import { logEnvStatus } from "@/lib/env";

// Runs once on server cold-start — confirms all env vars are present
logEnvStatus();

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SentinelRoute — Logistics Decision Intelligence",
  description:
    "Compare shipment routes, assess operational risk, and make routing decisions you can defend.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark`}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning className="min-h-screen bg-background text-foreground antialiased">
        <UserProvider>
          <StoreProvider>
            <TooltipProvider delayDuration={300}>
              {children}
            </TooltipProvider>
            <Toaster position="bottom-right" theme="dark" richColors />
          </StoreProvider>
        </UserProvider>
      </body>
    </html>
  );
}
