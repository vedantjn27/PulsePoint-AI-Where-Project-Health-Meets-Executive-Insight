import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type DashboardSummary } from "@/lib/api";
import { PageContainer, PageHeader, StatCard, ErrorBox, LoadingSkeleton } from "@/components/page-parts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Activity, AlertTriangle, Gauge, FolderKanban, ArrowRight } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { ragBadgeClass, ragColor } from "@/lib/rag";

export const Route = createFileRoute("/app/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const qc = useQueryClient();
  const { data, isLoading, error, refetch, isFetching } = useQuery<DashboardSummary>({
    queryKey: ["dashboard-summary"],
    queryFn: () => api("/dashboard/summary"),
  });

  return (
    <div className="dashboard-stage">
      <div className="dashboard-grid-layer" />
      <div className="dashboard-signal-layer" />
      <PageContainer>
        <div className="relative z-10">
          <PageHeader
            title="Portfolio Dashboard"
            description="Executive at-a-glance portfolio health. Sample data auto-loads on first run."
            actions={
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} /> Refresh
              </Button>
            }
          />

          {error && <ErrorBox error={error} />}
          {isLoading && <LoadingSkeleton rows={4} />}

          {data && (
            <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total projects" value={data.total_projects} icon={FolderKanban} tone="brand" />
            <StatCard label="Avg data confidence" value={`${Math.round(data.average_data_confidence * 100)}%`} icon={Gauge} tone="brand" />
            <StatCard label="Open critical alerts" value={data.open_critical_alerts} icon={AlertTriangle} tone={data.open_critical_alerts > 0 ? "red" : "green"} />
            <StatCard label="Total signals" value="5" icon={Activity} tone="brand" hint="Schedule · Budget · Milestones · Blockers · Sentiment" />
          </div>

          <div className="grid lg:grid-cols-3 gap-4 mt-6">
            <Card className="p-5 lg:col-span-1">
              <h3 className="font-semibold mb-2">RAG distribution</h3>
              <div className="h-64">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Green", value: data.rag_counts.Green, color: "var(--rag-green)" },
                        { name: "Amber", value: data.rag_counts.Amber, color: "var(--rag-amber)" },
                        { name: "Red", value: data.rag_counts.Red, color: "var(--rag-red)" },
                      ]}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={3}
                    >
                      {["var(--rag-green)", "var(--rag-amber)", "var(--rag-red)"].map((c, i) => (
                        <Cell key={i} fill={c} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 text-sm">
                {(["Green", "Amber", "Red"] as const).map((k) => (
                  <div key={k} className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full" style={{ background: ragColor(k) }} />
                    {k}: <b>{data.rag_counts[k]}</b>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5 lg:col-span-2">
              <h3 className="font-semibold mb-2">Composite scores</h3>
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={data.latest_projects.map(p => ({ name: p.project_name, score: p.composite_score ?? 0, rag: p.rag_status }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} domain={[0, 100]} />
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                    <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                      {data.latest_projects.map((p, i) => (
                        <Cell key={i} fill={ragColor(p.rag_status || "Unknown")} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card className="mt-6 p-5">
            <h3 className="font-semibold mb-3">Latest project health</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-muted-foreground border-b">
                    <th className="py-2 px-2">Project</th>
                    <th className="py-2 px-2">RAG</th>
                    <th className="py-2 px-2">Composite</th>
                    <th className="py-2 px-2">Confidence</th>
                    <th className="py-2 px-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.latest_projects.map((p) => (
                    <tr key={p.project_id} className="border-b hover:bg-accent/50">
                      <td className="py-3 px-2 font-medium">{p.project_name}</td>
                      <td className="py-3 px-2"><Badge variant="outline" className={p.rag_status ? ragBadgeClass(p.rag_status) : ""}>{p.rag_status || "Not analyzed"}</Badge></td>
                      <td className="py-3 px-2">{p.composite_score == null ? "N/A" : p.composite_score.toFixed(1)}</td>
                      <td className="py-3 px-2">{p.data_confidence == null ? "N/A" : `${Math.round(p.data_confidence * 100)}%`}</td>
                      <td className="py-3 px-2 text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link to="/app/projects/$projectId" params={{ projectId: p.project_id }}>
                            Open <ArrowRight className="h-3.5 w-3.5 ml-1" />
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {data.latest_projects.length === 0 && (
                    <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No projects yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
            </>
          )}
        </div>
      </PageContainer>
    </div>
  );
}
