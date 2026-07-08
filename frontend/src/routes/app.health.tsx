import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api, getApiBase, setApiBase } from "@/lib/api";
import { PageContainer, PageHeader, ErrorBox, StatCard } from "@/components/page-parts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";
import { HeartPulse, Database, Save } from "lucide-react";

export const Route = createFileRoute("/app/health")({ component: HealthPage });

function HealthPage() {
  const [base, setBase] = useState(getApiBase());
  const { data, isLoading, error, refetch } = useQuery<any>({
    queryKey: ["health"], queryFn: () => api("/health"), refetchInterval: 30000, retry: false,
  });

  return (
    <PageContainer>
      <PageHeader title="System Health" description="Backend connectivity and database readiness." />

      <Card className="p-5 mb-4">
        <Label>Backend API base URL</Label>
        <div className="mt-2 flex gap-2 flex-wrap">
          <Input value={base} onChange={(e) => setBase(e.target.value)} className="font-mono max-w-xl" />
          <Button onClick={() => { setApiBase(base); toast.success("API base updated"); refetch(); }}>
            <Save className="h-4 w-4 mr-2" /> Save
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Default: http://127.0.0.1:8000</p>
      </Card>

      {error && <ErrorBox error={error} />}

      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Service" value={data.service || "—"} icon={HeartPulse} tone="brand" />
          <StatCard label="Status" value={<Badge variant="outline" className={data.status === "ok" ? "text-[var(--rag-green)] border-[var(--rag-green)]/40" : "text-[var(--rag-red)]"}>{data.status}</Badge>} />
          <StatCard label="Database" value={data.database ? "Connected" : "Down"} icon={Database} tone={data.database ? "green" : "red"} />
          <StatCard label="Version" value={data.version || "—"} />
        </div>
      )}
      {isLoading && <div className="text-sm text-muted-foreground">Checking…</div>}
    </PageContainer>
  );
}
