import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api, apiUrl, type Project } from "@/lib/api";
import { PageContainer, PageHeader, ErrorBox, LoadingSkeleton } from "@/components/page-parts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { FileDown, FileText, ArrowRight, History } from "lucide-react";

export const Route = createFileRoute("/app/reports")({ component: ReportsPage });

function ReportsPage() {
  const projects = useQuery<Project[]>({ queryKey: ["projects"], queryFn: () => api("/projects") });
  const history = useQuery<any[]>({ queryKey: ["audit-log"], queryFn: () => api("/audit-log?limit=200") });
  const [selected, setSelected] = useState<string>("");
  const reportHistory = (history.data || []).filter((event: any) =>
    ["weekly_pdf_exported", "weekly_markdown_exported"].includes(event.event_type)
  );

  return (
    <PageContainer>
      <PageHeader title="Reports & Exports" description="Weekly project reports and monthly portfolio decks." />

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-semibold mb-1">Weekly project report</h3>
          <p className="text-sm text-muted-foreground mb-4">Markdown or PDF weekly export per project.</p>
          {projects.isLoading && <LoadingSkeleton rows={1} />}
          {projects.error && <ErrorBox error={projects.error} />}
          {projects.data && (
            <div className="space-y-3">
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger><SelectValue placeholder="Select a project" /></SelectTrigger>
                <SelectContent>
                  {projects.data.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex gap-2 flex-wrap">
                <Button asChild variant="outline" disabled={!selected}>
                  <a href={selected ? apiUrl(`/projects/${selected}/export`) : "#"} target="_blank" rel="noreferrer">
                    <FileText className="h-4 w-4 mr-2" /> Markdown
                  </a>
                </Button>
                <Button asChild disabled={!selected} className="gradient-brand text-white border-0">
                  <a href={selected ? apiUrl(`/projects/${selected}/export/pdf`) : "#"} target="_blank" rel="noreferrer" download>
                    <FileDown className="h-4 w-4 mr-2" /> Download PDF
                  </a>
                </Button>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold mb-1">Monthly portfolio deck</h3>
          <p className="text-sm text-muted-foreground mb-4">Generate default or branded decks in the Monthly Synthesis section.</p>
          <Button asChild variant="outline"><Link to="/app/synthesis">Open Monthly Synthesis <ArrowRight className="h-4 w-4 ml-1" /></Link></Button>
        </Card>
      </div>

      <Card className="p-5 mt-4">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand-2)]/10 text-[var(--brand-2)]">
            <History className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold">Report generation history</h3>
            <p className="text-sm text-muted-foreground">Weekly Markdown and PDF exports recorded by the audit log.</p>
          </div>
        </div>
        {history.isLoading && <LoadingSkeleton rows={2} />}
        {history.error && <ErrorBox error={history.error} />}
        <div className="overflow-x-auto">
          <table className="w-full text-[15px]">
            <thead><tr className="text-left text-xs uppercase text-muted-foreground border-b">
              <th className="py-3 px-2">Report</th><th className="py-3 px-2">Format</th><th className="py-3 px-2">Project</th><th className="py-3 px-2">Generated</th>
            </tr></thead>
            <tbody>
              {reportHistory.map((event: any) => (
                <tr key={event.id} className="border-b">
                  <td className="py-3 px-2 font-medium">{event.message}</td>
                  <td className="py-3 px-2">
                    <span className="rounded-full border px-2.5 py-1 text-xs font-medium">
                      {event.event_type === "weekly_pdf_exported" ? "PDF" : "Markdown"}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-muted-foreground">{event.details?.project_id || "N/A"}</td>
                  <td className="py-3 px-2 text-muted-foreground">{event.created_at ? new Date(event.created_at).toLocaleString() : "N/A"}</td>
                </tr>
              ))}
              {reportHistory.length === 0 && !history.isLoading && <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">No report exports recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </PageContainer>
  );
}
