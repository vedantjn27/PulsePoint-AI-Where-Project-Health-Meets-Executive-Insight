import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Alert } from "@/lib/api";
import { PageContainer, PageHeader, ErrorBox, LoadingSkeleton } from "@/components/page-parts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useState } from "react";
import { toast } from "sonner";
import { Check, AlertTriangle, ArrowRight, BellRing, CircleCheck } from "lucide-react";

export const Route = createFileRoute("/app/alerts")({ component: AlertsPage });

function AlertsPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery<Alert[]>({ queryKey: ["alerts"], queryFn: () => api("/alerts") });
  const [tab, setTab] = useState("all");

  const ack = useMutation({
    mutationFn: (id: number) => api(`/alerts/${id}/acknowledge`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Acknowledged");
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      qc.invalidateQueries({ queryKey: ["audit-log"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = (data || []).filter((a) =>
    tab === "all" ? true : tab === "open" ? !a.acknowledged : a.acknowledged
  );

  return (
    <PageContainer>
      <PageHeader title="Alerts" description="Health-change and critical operational alerts." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap justify-start gap-2 rounded-xl border bg-card/70 p-2">
          <TabsTrigger className="min-h-10 px-4" value="all">All ({data?.length ?? 0})</TabsTrigger>
          <TabsTrigger className="min-h-10 px-4" value="open">Open ({(data || []).filter(a => !a.acknowledged).length})</TabsTrigger>
          <TabsTrigger className="min-h-10 px-4" value="acknowledged">Acknowledged ({(data || []).filter(a => a.acknowledged).length})</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          {error && <ErrorBox error={error} />}
          {isLoading && <LoadingSkeleton />}
          <div className="space-y-3">
            {filtered.map((a) => (
              <Card key={a.id} className={`p-5 flex items-start gap-4 flex-wrap sm:flex-nowrap ${a.acknowledged ? "bg-muted/20" : "border-[var(--rag-red)]/25"}`}>
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${a.acknowledged ? "bg-muted text-muted-foreground" : "bg-[var(--rag-red)]/10 text-[var(--rag-red)]"}`}>
                  {a.acknowledged ? <CircleCheck className="h-5 w-5" /> : <BellRing className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">{prettyAlertType(a.alert_type)}</Badge>
                    {a.acknowledged && <Badge variant="secondary">Acknowledged</Badge>}
                    <span className="text-sm text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-[15px] leading-relaxed mt-2">{a.message}</p>
                  <Button asChild variant="link" size="sm" className="px-0 h-auto mt-2 text-[15px]">
                    <Link to="/app/projects/$projectId" params={{ projectId: a.project_id }}>
                      View project <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Link>
                  </Button>
                </div>
                {!a.acknowledged && (
                  <Button size="sm" variant="outline" onClick={() => ack.mutate(a.id)} disabled={ack.isPending}>
                    <Check className="h-4 w-4 mr-1" /> Acknowledge
                  </Button>
                )}
              </Card>
            ))}
            {filtered.length === 0 && !isLoading && (
              <Card className="p-10 text-center text-[15px] text-muted-foreground">No alerts here.</Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

function prettyAlertType(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
