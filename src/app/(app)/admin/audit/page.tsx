"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/lib/auth-context";
import { useCompany } from "@/lib/company-context";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Search, ChevronLeft, ChevronRight, Activity, ShieldAlert } from "lucide-react";

export default function AuditViewerPage() {
  const { user } = useUser();
  const { status, isSuperAdmin } = useCompany();
  
  const [audits, setAudits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const limit = 50;

  useEffect(() => {
    if (status === "loading") return;
    
    if (!isSuperAdmin) {
      setError("Unauthorized. You must be a Super Admin to view this page.");
      setLoading(false);
      return;
    }

    const fetchAudits = async () => {
      try {
        setLoading(true);
        const token = await user?.getIdToken();
        const res = await fetch(`/api/admin/audit?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!res.ok) {
          throw new Error("Failed to load audits");
        }
        const json = await res.json();
        setAudits(json.logs || json.audits || []);
        setTotalCount(json.total || json.totalCount || 0);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    // Add debounce for search typing
    const timeout = setTimeout(() => {
      fetchAudits();
    }, 400);
    
    return () => clearTimeout(timeout);
  }, [user, status, isSuperAdmin, page, search]);

  if (status === "loading") return (
    <div className="max-w-7xl mx-auto w-full p-4 md:p-8 space-y-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-[400px] w-full" />
    </div>
  );
  if (error) return <div className="p-8 text-destructive text-center">{error}</div>;

  const totalPages = Math.ceil(totalCount / limit) || 1;

  return (
    <div className="max-w-7xl mx-auto w-full p-4 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-primary" />
            Platform Audit Center
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Global view of all system and tenant activities.
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <Input 
            placeholder="Search audits..."
            className="pl-9 h-10"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      <Card className="bg-card border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-40">Timestamp</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>IP Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && audits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <Activity className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : audits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No audits found.
                  </TableCell>
                </TableRow>
              ) : (
                audits.map((a, i) => (
                  <TableRow key={i}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {format(new Date(a.timestamp || a.generatedAt), "MMM d, yyyy HH:mm:ss")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
                        {a.tenantName || a.companyId || "System"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {a.eventType || "Unknown"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {a.description || a.details?.message || "-"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {a.performedBy || a.actorId || "System"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {a.ipAddress || "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
      
      <div className="flex items-center justify-between text-sm">
        <p className="text-muted-foreground">
          Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, totalCount)} of {totalCount} entries
        </p>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Prev
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
          >
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
