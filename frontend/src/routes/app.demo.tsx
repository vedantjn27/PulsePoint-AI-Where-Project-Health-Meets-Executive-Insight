import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageContainer, PageHeader } from "@/components/page-parts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Database, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/demo")({ component: DemoPage });

function DemoPage() {
  const qc = useQueryClient();
  const seed = useMutation({
    mutationFn: () => api("/demo/seed", { method: "POST" }),
    onSuccess: () => {
      toast.success("Sample data reloaded");
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries({ queryKey: ["synthesis"] });
      qc.invalidateQueries({ queryKey: ["audit-log"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <PageContainer>
      <PageHeader title="Demo Data" description="Sample projects for quick demonstration." />
      <Card className="p-6">
        <Database className="h-8 w-8 text-[var(--brand-2)]" />
        <h3 className="mt-3 font-semibold text-lg">Sample workbook data</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
          The dashboard auto-loads sample data on first run. Sample projects are based on internship-provided XLSX workbooks.
          Use the button below to reset and reload sample data at any time.
        </p>
        <Button className="mt-4 gradient-brand text-white border-0" onClick={() => seed.mutate()} disabled={seed.isPending}>
          <RefreshCw className={`h-4 w-4 mr-2 ${seed.isPending ? "animate-spin" : ""}`} /> {seed.isPending ? "Seeding…" : "Reload sample workbook data"}
        </Button>
      </Card>
    </PageContainer>
  );
}
