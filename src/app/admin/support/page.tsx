"use client";

import { Wrench, Terminal, Database, Key } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SupportToolsCenter() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Wrench className="w-6 h-6 text-stone-500" />
            Support & Developer Tools
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Advanced tooling for L3 support and platform engineering.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-border/50 shadow-sm border-l-4 border-l-red-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-red-500" />
              Force State Reset
            </CardTitle>
            <CardDescription>Emergency tool to forcefully unstick shipments in deadlocked states.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" className="w-full">Initialize Reset Protocol</Button>
            <p className="text-xs text-muted-foreground mt-3 text-center">Requires biometric authorization</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-amber-500" />
              API Key Management
            </CardTitle>
            <CardDescription>Issue and revoke global platform integration keys.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">Manage Keys</Button>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm md:col-span-2 min-h-[200px] flex items-center justify-center bg-muted/10">
          <div className="text-center text-muted-foreground">
            <Terminal className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="font-mono">admin@sentinel-route:~$ _</p>
            <p className="text-xs mt-2 opacity-70">Web CLI Console Offline</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
