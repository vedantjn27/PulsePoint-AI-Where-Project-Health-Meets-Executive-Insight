import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Project, type Snapshot, type AnalyzeResult, type ScoreBreakdown, type ProjectOverviewTable, type ProjectOverviewRow, type UploadValidationResult } from "@/lib/api";
import { downloadBackendFile } from "@/lib/download";
import { PageContainer, PageHeader, StatCard, ErrorBox, LoadingSkeleton } from "@/components/page-parts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useState, useRef } from "react";
import { ragBadgeClass, ragColor } from "@/lib/rag";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  FileDown,
  FileSearch,
  FileText,
  Flag,
  Gauge,
  LayoutDashboard,
  Layers,
  PlayCircle,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Upload,
  Zap,
} from "lucide-react";
import { RadarChart, PolarAngleAxis, PolarGrid, Radar, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid, BarChart, Bar, Cell } from "recharts";

export const Route = createFileRoute("/app/projects/$projectId")({
  component: ProjectDetailPage,
});

function ProjectDetailPage() {
  const { projectId } = Route.useParams();
  const qc = useQueryClient();

  const project = useQuery<Project>({ queryKey: ["project", projectId], queryFn: () => api(`/projects/${projectId}`) });
  const latest = useQuery<Snapshot | null>({
    queryKey: ["latest", projectId],
    queryFn: () => api<Snapshot>(`/projects/${projectId}/snapshots/latest`).then(normalizeSnapshot).catch(() => null),
  });

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["project", projectId] });
    qc.invalidateQueries({ queryKey: ["latest", projectId] });
    qc.invalidateQueries({ queryKey: ["snapshots", projectId] });
    qc.invalidateQueries({ queryKey: ["breakdown", projectId] });
    qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    qc.invalidateQueries({ queryKey: ["alerts"] });
    qc.invalidateQueries({ queryKey: ["audit-log"] });
  };

  if (project.error) return <PageContainer><ErrorBox error={project.error} /></PageContainer>;

  return (
    <PageContainer>
      <PageHeader
        title={project.data?.name || projectId}
        description={project.data?.client_name ? `Client: ${project.data.client_name}` : "Project detail"}
        actions={latest.data?.score && <Badge variant="outline" className={ragBadgeClass(latest.data.score.rag_status)}>{latest.data.score.rag_status}</Badge>}
      />

      {project.isLoading && <LoadingSkeleton rows={3} />}

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 rounded-2xl border bg-muted/50 p-2 shadow-sm">
          {(
            [
              { value: "overview",  label: "Overview",         icon: LayoutDashboard },
              { value: "upload",    label: "Upload & Analyze", icon: Upload },
              { value: "breakdown", label: "Score Breakdown",  icon: Activity },
              { value: "snapshots", label: "Snapshots",        icon: Layers },
              { value: "simulate",  label: "Scenario Sim",     icon: Target },
              { value: "reasoning", label: "Agent Reasoning",  icon: BrainCircuit },
              { value: "exports",   label: "Exports",          icon: FileDown },
            ] as { value: string; label: string; icon: any }[]
          ).map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all min-h-[44px]"
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab project={project.data} latest={latest.data} projectId={projectId} onDone={refreshAll} />
        </TabsContent>
        <TabsContent value="upload" className="mt-4">
          <UploadTab projectId={projectId} onDone={refreshAll} />
        </TabsContent>
        <TabsContent value="breakdown" className="mt-4">
          <BreakdownTab projectId={projectId} />
        </TabsContent>
        <TabsContent value="snapshots" className="mt-4">
          <SnapshotsTab projectId={projectId} />
        </TabsContent>
        <TabsContent value="simulate" className="mt-4">
          <SimulateTab projectId={projectId} />
        </TabsContent>
        <TabsContent value="reasoning" className="mt-4">
          <ReasoningTab projectId={projectId} />
        </TabsContent>
        <TabsContent value="exports" className="mt-4">
          <ExportsTab projectId={projectId} />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

function OverviewTab({ project, latest, projectId, onDone }: { project?: Project; latest?: Snapshot | null; projectId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const overview = useQuery<ProjectOverviewTable>({
    queryKey: ["project-overview-table", projectId],
    queryFn: () => api<ProjectOverviewTable>(`/projects/${projectId}/overview-table`),
    retry: false,
  });
  const toggleCritical = useMutation({
    mutationFn: (row: ProjectOverviewRow) =>
      api<ProjectOverviewTable>(`/projects/${projectId}/tasks/${row.index}/critical`, {
        method: "PATCH",
        body: JSON.stringify({ critical: !row.critical }),
      }),
    onSuccess: () => {
      toast.success("Critical path updated");
      qc.invalidateQueries({ queryKey: ["project-overview-table", projectId] });
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="RAG" value={latest?.rag_status || "—"} tone={(latest?.rag_status?.toLowerCase() as any) || undefined} icon={Gauge} />
        <StatCard label="Composite" value={latest && latest.composite_score != null ? latest.composite_score.toFixed(1) : "—"} tone="brand" />
        <StatCard label="Confidence" value={latest && latest.data_confidence != null ? `${Math.round(latest.data_confidence * 100)}%` : "—"} tone="brand" />
        <StatCard label="Last run" value={latest?.run_date || "—"} />
      </div>
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
          <div>
            <h3 className="font-semibold">Project workstream health table</h3>
            <p className="text-sm text-muted-foreground">
              Rows come from the latest normalized snapshot. Toggle task criticality to test delivery focus.
            </p>
          </div>
          <Badge variant="secondary">{overview.data?.rows.length ?? 0} rows</Badge>
        </div>

        {overview.error && <ErrorBox error={overview.error} />}
        {overview.isLoading && <LoadingSkeleton rows={4} />}
        {overview.data && (
          <WorkstreamHealthTable
            rows={overview.data.rows}
            onToggleCritical={(row) => toggleCritical.mutate(row)}
            isUpdating={toggleCritical.isPending}
          />
        )}
      </Card>
      {!latest && (
        <Card className="p-6 border-dashed">
          <p className="text-sm text-muted-foreground">No snapshot yet. Go to <b>Upload & Analyze</b> to upload a project plan file and run the first analysis.</p>
        </Card>
      )}
    </div>
  );
}

function WorkstreamHealthTable({ rows, onToggleCritical, isUpdating }: { rows: ProjectOverviewRow[]; onToggleCritical: (row: ProjectOverviewRow) => void; isUpdating: boolean }) {
  const [page, setPage] = useState(0);
  const PAGE = 15;
  const totalPages = Math.ceil(rows.length / PAGE);
  const visible = rows.slice(page * PAGE, page * PAGE + PAGE);

  return (
    <div className="space-y-3">
      {visible.map((row, i) => {
        const overallTone = [
          signalTone(row.schedule_slippage),
          signalTone(row.budget_burn),
          signalTone(row.milestone_health),
          signalTone(row.blockers),
          signalTone(row.stakeholder_sentiment),
        ].includes("risk") ? "risk" : [
          signalTone(row.schedule_slippage),
          signalTone(row.budget_burn),
          signalTone(row.milestone_health),
          signalTone(row.blockers),
          signalTone(row.stakeholder_sentiment),
        ].includes("watch") ? "watch" : "good";
        const leftBorder = overallTone === "risk"
          ? "border-l-[var(--rag-red)]"
          : overallTone === "watch"
          ? "border-l-[var(--rag-amber)]"
          : "border-l-[var(--rag-green)]";

        return (
          <div
            key={`${row.row_type}-${row.index}-${i}`}
            className={`rounded-2xl border-l-4 border border-border bg-card shadow-sm hover:shadow-md transition-all overflow-hidden ${leftBorder}`}
          >
            {/* Card header */}
            <div className="flex items-start justify-between gap-4 px-5 py-4 bg-muted/20 border-b">
              <div className="flex items-start gap-3 min-w-0">
                <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  row.row_type === "task"
                    ? "bg-[var(--brand)]/10 text-[var(--brand)]"
                    : "bg-[var(--brand-2)]/10 text-[var(--brand-2)]"
                }`}>
                  {row.row_type === "task" ? <ClipboardCheck className="h-4 w-4" /> : <Target className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold leading-snug">{row.name}</p>
                    <Badge variant="outline" className="capitalize text-[10px] py-0">{row.row_type}</Badge>
                    {row.critical && (
                      <Badge className="gradient-brand text-white border-0 text-[10px] py-0">
                        <Flag className="h-2.5 w-2.5 mr-0.5" /> Critical
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{formatDateRange(row.start_date, row.end_date)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                <Badge variant="outline" className={`text-xs ${statusBadgeClass(row.status)}`}>{row.status || "Not updated"}</Badge>
                {row.row_type === "task" ? (
                  <Button
                    size="sm"
                    variant={row.critical ? "default" : "ghost"}
                    onClick={() => onToggleCritical(row)}
                    disabled={isUpdating}
                    className={`h-7 text-xs px-2.5 ${row.critical ? "gradient-brand text-white border-0" : "text-muted-foreground border"}`}
                  >
                    <Flag className="h-3 w-3 mr-1" />
                    {row.critical ? "Critical" : "Mark critical"}
                  </Button>
                ) : (
                  <Badge variant={row.critical ? "default" : "secondary"} className="text-xs">
                    {row.critical ? "Critical" : "Normal"}
                  </Badge>
                )}
              </div>
            </div>

            {/* Card body */}
            <div className="px-5 py-4 space-y-4">
              <CompletionCell value={row.percent_complete} />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                <SignalPill label="Schedule"  value={row.schedule_slippage}      tone={signalTone(row.schedule_slippage)} />
                <SignalPill label="Budget"    value={row.budget_burn}            tone={signalTone(row.budget_burn)} />
                <SignalPill label="Milestone" value={row.milestone_health}       tone={signalTone(row.milestone_health)} />
                <SignalPill label="Blockers"  value={row.blockers}               tone={signalTone(row.blockers)} />
                <SignalPill label="Sentiment" value={row.stakeholder_sentiment}  tone={signalTone(row.stakeholder_sentiment)} />
              </div>
            </div>
          </div>
        );
      })}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted-foreground">
            Showing {page * PAGE + 1}–{Math.min((page + 1) * PAGE, rows.length)} of {rows.length} items
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setPage(p => p - 1)} disabled={page === 0}>Previous</Button>
            <Button size="sm" variant="outline" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}


function CompletionCell({ value }: { value?: number | null }) {
  if (value == null) return <span className="text-muted-foreground">Not available</span>;
  const normalized = Math.max(0, Math.min(100, value));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold">{normalized.toFixed(0)}%</span>
        <span className="text-muted-foreground">{completionLabel(normalized)}</span>
      </div>
      <Progress value={normalized} className="h-2.5" />
    </div>
  );
}

function SignalPill({ label, value, tone, className = "" }: { label: string; value: string; tone: "good" | "watch" | "risk" | "neutral"; className?: string }) {
  const toneClass = {
    good: "border-[var(--rag-green)]/25 bg-[var(--rag-green)]/10 text-[var(--rag-green)]",
    watch: "border-[var(--rag-amber)]/25 bg-[var(--rag-amber)]/10 text-[var(--rag-amber)]",
    risk: "border-[var(--rag-red)]/25 bg-[var(--rag-red)]/10 text-[var(--rag-red)]",
    neutral: "border-border bg-muted/50 text-muted-foreground",
  }[tone];
  return (
    <div className={`rounded-lg border p-2.5 ${toneClass} ${className}`}>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-xs leading-relaxed text-foreground">{friendlySignalText(value)}</div>
    </div>
  );
}

function UploadTab({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadValidationResult | null>(null);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Select a file first");
      const fd = new FormData(); fd.append("file", file);
      return api<UploadValidationResult>(`/projects/${projectId}/upload`, { method: "POST", body: fd });
    },
    onSuccess: (d) => { setUploadResult(d); toast.success("Uploaded and normalized"); },
    onError: (e: any) => toast.error(e.message),
  });

  const analyze = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Select a file first");
      const fd = new FormData(); fd.append("file", file);
      return api<AnalyzeResult>(`/projects/${projectId}/analyze`, { method: "POST", body: fd });
    },
    onSuccess: (d) => { setAnalyzeResult(d); toast.success("Analysis complete"); onDone(); localStorage.setItem(`pp_last_analysis_${projectId}`, JSON.stringify(d)); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="grid gap-4">
      <Card className="p-6">
        <h3 className="font-semibold mb-2">Upload project plan</h3>
        <p className="text-sm text-muted-foreground mb-4">Accepts .json, .csv, or .xlsx.</p>
        <div className="flex flex-wrap gap-3 items-center">
          <input ref={inputRef} type="file" accept=".json,.csv,.xlsx"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:px-3 file:py-1.5 file:text-sm" />
          <Button variant="outline" onClick={() => upload.mutate()} disabled={!file || upload.isPending}>
            <Upload className="h-4 w-4 mr-2" /> {upload.isPending ? "Validating…" : "Validate upload"}
          </Button>
          <Button onClick={() => analyze.mutate()} disabled={!file || analyze.isPending} className="gradient-brand text-white border-0">
            <PlayCircle className="h-4 w-4 mr-2" /> {analyze.isPending ? "Analyzing…" : "Analyze & score"}
          </Button>
        </div>
      </Card>

      {uploadResult && (
        <UploadValidationCard result={uploadResult} />
      )}

      {analyzeResult && <AnalyzeResultCard r={analyzeResult} />}
    </div>
  );
}

function UploadValidationCard({ result }: { result: UploadValidationResult }) {
  const counts = Object.entries(result.normalized_counts || {}).filter(([, v]) => Number(v) > 0);
  const visibleWarnings = friendlyParserWarnings(result);
  const totalRows = counts.reduce((sum, [, v]) => sum + Number(v), 0);
  const conf = Math.round(result.data_confidence * 100);
  const confColor = conf >= 75 ? "var(--rag-green)" : conf >= 50 ? "var(--rag-amber)" : "var(--rag-red)";
  const confBg   = conf >= 75 ? "bg-[var(--rag-green)]/10 border-[var(--rag-green)]/30" : conf >= 50 ? "bg-[var(--rag-amber)]/10 border-[var(--rag-amber)]/30" : "bg-[var(--rag-red)]/10 border-[var(--rag-red)]/30";

  return (
    <div className="space-y-4">
      {/* Header card */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-stretch">
          {/* Left: confidence */}
          <div className={`flex flex-col items-center justify-center px-8 py-6 border-r border ${confBg}`}>
            <div className="text-4xl font-bold tabular-nums" style={{ color: confColor }}>{conf}%</div>
            <div className="text-xs uppercase tracking-widest mt-1 text-muted-foreground">Data confidence</div>
          </div>
          {/* Right: summary */}
          <div className="flex-1 p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-lg">File validated successfully</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {totalRows > 0
                    ? `Found ${totalRows} usable row${totalRows !== 1 ? "s" : ""} across ${counts.length} data type${counts.length !== 1 ? "s" : ""}.`
                    : "No usable project rows detected in this file."}
                </p>
              </div>
              <Badge variant="outline" className="capitalize shrink-0">{result.source_type} file</Badge>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <div className="rounded-xl border px-4 py-2 text-center min-w-[80px]">
                <div className="text-xl font-bold">{totalRows}</div>
                <div className="text-xs text-muted-foreground">Total rows</div>
              </div>
              <div className="rounded-xl border px-4 py-2 text-center min-w-[80px]">
                <div className="text-xl font-bold">{visibleWarnings.length}</div>
                <div className="text-xs text-muted-foreground">Warnings</div>
              </div>
              <div className="rounded-xl border px-4 py-2 text-center min-w-[80px]">
                <div className="text-xl font-bold">{result.missing_fields?.length ?? 0}</div>
                <div className="text-xs text-muted-foreground">Missing fields</div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Row type breakdown */}
      {counts.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {counts.map(([key, value]) => (
            <Card key={key} className="p-4 text-center">
              <div className="text-3xl font-bold text-[var(--brand-2)]">{value}</div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mt-1">{prettyKey(key)}</div>
            </Card>
          ))}
        </div>
      )}

      {/* Warnings */}
      {visibleWarnings.length > 0 && (
        <Card className="p-4 border-[var(--rag-amber)]/30 bg-[var(--rag-amber)]/5">
          <h4 className="font-medium text-sm mb-3 flex items-center gap-2 text-[var(--rag-amber)]">
            <AlertTriangle className="h-4 w-4" /> {visibleWarnings.length} item{visibleWarnings.length > 1 ? "s" : ""} to review
          </h4>
          <ul className="space-y-2">
            {visibleWarnings.map((w, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <ChevronRight className="h-4 w-4 shrink-0 mt-0.5 text-[var(--rag-amber)]" />
                {w}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Missing fields */}
      {(result.missing_fields?.length ?? 0) > 0 && (
        <Card className="p-4">
          <h4 className="font-medium text-sm mb-2">Missing fields — lower confidence</h4>
          <div className="flex flex-wrap gap-2">
            {result.missing_fields.map(f => <Badge key={f} variant="secondary">{prettyKey(f)}</Badge>)}
          </div>
        </Card>
      )}
    </div>
  );
}


function AnalyzeResultCard({ r }: { r: AnalyzeResult }) {
  const signals = Object.entries(r.sub_scores).map(([k, v]) => ({ label: signalLabel(k), score: v }));
  const ragColors = {
    Red:   { bg: "bg-[var(--rag-red)]/15 border-[var(--rag-red)]/40",   text: "text-[var(--rag-red)]",   dot: "var(--rag-red)" },
    Amber: { bg: "bg-[var(--rag-amber)]/15 border-[var(--rag-amber)]/40", text: "text-[var(--rag-amber)]", dot: "var(--rag-amber)" },
    Green: { bg: "bg-[var(--rag-green)]/15 border-[var(--rag-green)]/40", text: "text-[var(--rag-green)]", dot: "var(--rag-green)" },
  } as Record<string, { bg: string; text: string; dot: string }>;
  const rc = ragColors[r.rag_status] ?? { bg: "bg-muted", text: "text-foreground", dot: "var(--muted-foreground)" };

  return (
    <div className="space-y-4">
      {/* Score banner */}
      <Card className={`overflow-hidden border-2 ${rc.bg}`}>
        <div className="p-6 flex flex-wrap items-center justify-between gap-6">
          <div>
            {/* RAG pill — colour-coded */}
            <div className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 font-bold text-base mb-4 ${rc.bg} ${rc.text}`}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: rc.dot }} />
              {r.rag_status} Status
            </div>
            <div className="text-6xl font-bold tabular-nums">{(r.composite_score ?? 0).toFixed(1)}<span className="text-2xl font-normal opacity-50 ml-1">/100</span></div>
            <div className="mt-2 text-sm text-muted-foreground">
              Data confidence: <b>{Math.round(r.data_confidence * 100)}%</b>&nbsp;·&nbsp;
              Trend: <b>{friendlyTrend(r.trend_vs_last_week)}</b>&nbsp;·&nbsp;
              <span className="opacity-70">{r.run_date}</span>
            </div>
          </div>
          <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${rc.bg} shrink-0`}>
            <Gauge className={`h-8 w-8 ${rc.text}`} />
          </div>
        </div>
      </Card>

      {/* Signal bars */}
      <Card className="p-5">
        <h4 className="mb-4 flex items-center gap-2 font-semibold"><Activity className="h-4 w-4 text-[var(--brand-2)]" /> Signal Scores</h4>
        <div className="space-y-3">
          {signals.map(({ label, score }) => {
            const s = score ?? 0;
            const color = s >= 75 ? "var(--rag-green)" : s >= 50 ? "var(--rag-amber)" : "var(--rag-red)";
            return (
              <div key={label}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium">{label}</span>
                  <span className="font-bold" style={{ color }}>{s.toFixed(1)}</span>
                </div>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(2, s)}%`, backgroundColor: color }} />
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Open the <b>Agent Reasoning</b> tab for the full AI analysis, risks, and recommended actions.</p>
      </Card>
    </div>
  );
}



function BreakdownTab({ projectId }: { projectId: string }) {
  const { data, isLoading, error } = useQuery<ScoreBreakdown>({
    queryKey: ["breakdown", projectId],
    queryFn: () => api<ScoreBreakdown>(`/projects/${projectId}/score-breakdown`).then(normalizeScoreBreakdown),
    retry: false,
  });
  if (error) return <ErrorBox error={error} />;
  if (isLoading) return <LoadingSkeleton />;
  if (!data) return null;
  const chartData = Object.entries(data.breakdown).map(([signal, item]) => ({
    signal: signalLabel(signal),
    score: item.score ?? 0,
    weight: Math.round(item.adjusted_weight * 100),
  }));

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="RAG" value={data.rag_status} tone={data.rag_status.toLowerCase() as any} />
        <StatCard label="Composite" value={data.composite_score.toFixed(1)} tone="brand" />
        <StatCard label="Scope penalty" value={data.scope_penalty.toFixed(1)} tone={data.scope_penalty < 0 ? "red" : undefined} />
        <StatCard label="Confidence" value={`${Math.round(data.data_confidence * 100)}%`} tone="brand" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-semibold mb-3">Signal strength</h3>
          <div className="h-72">
            <ResponsiveContainer>
              <RadarChart data={chartData}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="signal" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                <Radar dataKey="score" stroke="var(--brand)" fill="var(--brand)" fillOpacity={0.35} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold mb-3">Score by signal</h3>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="signal" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} domain={[0, 100]} />
                <RTooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                  {chartData.map((d) => <Cell key={d.signal} fill={ragColor(d.score >= 75 ? "Green" : d.score >= 50 ? "Amber" : "Red")} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="font-semibold mb-4">Signal explanations</h3>
        <div className="space-y-3">
          {Object.entries(data.breakdown).map(([sig, b]) => (
            <div key={sig} className="rounded-lg border p-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="font-semibold capitalize">{sig}</div>
                  {!b.available && <Badge variant="outline" className="text-[var(--rag-amber)] border-[var(--rag-amber)]/40">Missing</Badge>}
                </div>
                <div className="text-sm flex gap-4">
                  <span>Score: <b>{b.score.toFixed(1)}</b></span>
                  <span className="text-muted-foreground">weight {(b.weight * 100).toFixed(0)}% → adj {(b.adjusted_weight * 100).toFixed(0)}%</span>
                </div>
              </div>
              <Progress value={b.score} className="mt-2 h-2" />
              <p className="text-sm text-muted-foreground mt-2">{friendlySignalReason(sig, b.reason)}</p>
            </div>
          ))}
        </div>
        {data.override_reasons.length > 0 && (
          <div className="mt-4 rounded bg-muted p-3 text-sm">
            <b>Override reasons:</b>
            <ul className="list-disc ml-5">{data.override_reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
          </div>
        )}
      </Card>
    </div>
  );
}

function SnapshotsTab({ projectId }: { projectId: string }) {
  const { data, isLoading, error } = useQuery<Snapshot[]>({
    queryKey: ["snapshots", projectId],
    queryFn: () => api<Snapshot[]>(`/projects/${projectId}/snapshots`).then((snapshots) => snapshots.map(normalizeSnapshot)),
  });
  if (error) return <ErrorBox error={error} />;
  if (isLoading) return <LoadingSkeleton />;
  const trend = (data || []).slice().sort((a, b) => a.run_date.localeCompare(b.run_date));
  return (
    <div className="grid gap-4">
      <Card className="p-5">
        <h3 className="font-semibold mb-3">Composite score history</h3>
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="run_date" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis domain={[0, 100]} stroke="var(--muted-foreground)" fontSize={11} />
              <RTooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Line type="monotone" dataKey="composite_score" stroke="var(--brand)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--brand-2)" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card className="p-5">
        <h3 className="font-semibold mb-3">Snapshot history</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-muted-foreground border-b">
              <th className="py-2 px-2">Run date</th><th className="py-2 px-2">RAG</th><th className="py-2 px-2">Composite</th><th className="py-2 px-2">Confidence</th>
            </tr></thead>
            <tbody>
              {trend.slice().reverse().map((s) => (
                <tr key={s.id} className="border-b">
                  <td className="py-2 px-2">{s.run_date}</td>
                  <td className="py-2 px-2"><Badge variant="outline" className={ragBadgeClass(s.rag_status)}>{s.rag_status}</Badge></td>
                  <td className="py-2 px-2">{s.composite_score != null ? s.composite_score.toFixed(1) : "N/A"}</td>
                  <td className="py-2 px-2">{Math.round(s.data_confidence * 100)}%</td>
                </tr>
              ))}
              {trend.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">No snapshots yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

const SIGNALS = ["schedule", "budget", "milestones", "blockers", "sentiment"] as const;

function signalLabel(signal: string) {
  return ({
    schedule: "Schedule",
    budget: "Budget",
    milestones: "Milestones",
    blockers: "Blockers",
    sentiment: "Sentiment",
  } as Record<string, string>)[signal] || signal;
}

function friendlySignalReason(signal: string, reason: string) {
  if (signal === "schedule") {
    const match = reason.match(/(-?\d+(\.\d+)?) percentage points/);
    if (match) {
      const value = Number(match[1]);
      if (value < -5) return `The project is behind the expected pace by about ${Math.abs(value).toFixed(1)} points. Leadership should check whether critical-path work is slipping.`;
      if (value > 5) return `The project is ahead of the expected pace by about ${value.toFixed(1)} points. Current delivery speed looks healthy.`;
      return "The project is broadly tracking the expected schedule.";
    }
  }
  if (signal === "budget") {
    const match = reason.match(/(\d+(\.\d+)?)x/);
    if (match) {
      const ratio = Number(match[1]);
      return ratio > 1.1
        ? `Spend is moving faster than delivery progress at roughly ${ratio.toFixed(2)}x, so budget needs attention.`
        : `Spend is broadly aligned with completed work at roughly ${ratio.toFixed(2)}x.`;
    }
  }
  if (signal === "milestones") return reason.replace("overdue", "overdue milestone(s)").replace("near-term at risk", "near-term at-risk milestone(s)");
  if (signal === "blockers") return reason.replace("weighted severity and age penalty", "priority based on severity and how long blockers have been open");
  if (signal === "sentiment") return reason.replace("Rule-based sentiment classified commentary as", "Project notes currently read as");
  return reason;
}

function normalizeSnapshot(snapshot: Snapshot): Snapshot {
  return {
    ...snapshot,
    id: snapshot.snapshot_id,
    rag_status: snapshot.score?.rag_status || "N/A",
    composite_score: snapshot.score?.composite_score ?? 0,
  };
}

function normalizeScoreBreakdown(breakdown: ScoreBreakdown): ScoreBreakdown {
  return {
    ...breakdown,
    breakdown: Object.fromEntries(
      Object.entries(breakdown.breakdown).map(([signal, item]) => [
        signal,
        { ...item, score: item.score ?? 0 },
      ]),
    ),
  };
}

function SimulateTab({ projectId }: { projectId: string }) {
  const [signal, setSignal] = useState<typeof SIGNALS[number]>("budget");
  const [budgetIncrease, setBudgetIncrease] = useState(15000);
  const [budgetMove, setBudgetMove] = useState("increase");
  const [delayDays, setDelayDays] = useState(10);
  const [scheduleMove, setScheduleMove] = useState("delay");
  const [milestoneCount, setMilestoneCount] = useState(1);
  const [milestoneMove, setMilestoneMove] = useState("add");
  const [blockerSeverity, setBlockerSeverity] = useState("high");
  const [blockerMove, setBlockerMove] = useState("add");
  const [sentimentMove, setSentimentMove] = useState("worse");
  const [result, setResult] = useState<any>(null);
  const project = useQuery<Project>({ queryKey: ["project", projectId], queryFn: () => api(`/projects/${projectId}`) });
  const delta = scenarioDelta(signal, {
    budgetIncrease,
    budgetMove,
    budgetTotal: project.data?.budget_total,
    delayDays,
    scheduleMove,
    milestoneCount,
    milestoneMove,
    blockerSeverity,
    blockerMove,
    sentimentMove,
  });

  const run = useMutation({
    mutationFn: () => api(`/projects/${projectId}/simulate`, { method: "POST", body: JSON.stringify({ signal, delta }) }),
    onSuccess: (d) => setResult(d),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="grid gap-4">
      <Card className="p-5">
        <h3 className="font-semibold mb-1">Scenario simulator</h3>
        <p className="text-sm text-muted-foreground mb-4">What-if only — changes are not persisted.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Signal</Label>
            <Select value={signal} onValueChange={(v) => setSignal(v as any)}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>{SIGNALS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <ScenarioInput
            signal={signal}
            budgetIncrease={budgetIncrease}
            setBudgetIncrease={setBudgetIncrease}
            budgetMove={budgetMove}
            setBudgetMove={setBudgetMove}
            delayDays={delayDays}
            setDelayDays={setDelayDays}
            scheduleMove={scheduleMove}
            setScheduleMove={setScheduleMove}
            milestoneCount={milestoneCount}
            setMilestoneCount={setMilestoneCount}
            milestoneMove={milestoneMove}
            setMilestoneMove={setMilestoneMove}
            blockerSeverity={blockerSeverity}
            setBlockerSeverity={setBlockerSeverity}
            blockerMove={blockerMove}
            setBlockerMove={setBlockerMove}
            sentimentMove={sentimentMove}
            setSentimentMove={setSentimentMove}
          />
        </div>
        <div className="mt-4 rounded-md bg-muted p-3 text-sm">
          Simulation will move the {signalLabel(signal).toLowerCase()} signal by <b>{delta > 0 ? "+" : ""}{delta.toFixed(1)} points</b>.
        </div>
        <Button onClick={() => run.mutate()} disabled={run.isPending} className="mt-4 gradient-brand text-white border-0">
          {run.isPending ? "Simulating…" : "Run simulation"}
        </Button>
      </Card>

      {result && (
        <Card className="p-5">
          <h3 className="font-semibold mb-4">Simulation result</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-lg border p-4">
              <div className="text-xs uppercase text-muted-foreground">Current</div>
              <div className="mt-2 text-3xl font-bold">{result.current_composite_score?.toFixed?.(1)}</div>
              <Badge variant="outline" className={ragBadgeClass(result.current_rag_status)}>{result.current_rag_status}</Badge>
              <div className="mt-2 text-xs text-muted-foreground">{result.signal} score: {result.current_signal_score?.toFixed?.(1)}</div>
            </div>
            <div className="rounded-lg border-2 border-[var(--brand)] p-4">
              <div className="text-xs uppercase text-[var(--brand-2)]">Simulated</div>
              <div className="mt-2 text-3xl font-bold text-gradient">{result.simulated_composite_score?.toFixed?.(1)}</div>
              <Badge variant="outline" className={ragBadgeClass(result.simulated_rag_status)}>{result.simulated_rag_status}</Badge>
              <div className="mt-2 text-xs">Movement: <b style={{ color: result.movement < 0 ? "var(--rag-red)" : "var(--rag-green)" }}>{result.movement > 0 ? "+" : ""}{result.movement?.toFixed?.(2)}</b></div>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{result.note}</p>
        </Card>
      )}
    </div>
  );
}

function ScenarioInput(props: {
  signal: typeof SIGNALS[number];
  budgetIncrease: number;
  setBudgetIncrease: (value: number) => void;
  budgetMove: string;
  setBudgetMove: (value: string) => void;
  delayDays: number;
  setDelayDays: (value: number) => void;
  scheduleMove: string;
  setScheduleMove: (value: string) => void;
  milestoneCount: number;
  setMilestoneCount: (value: number) => void;
  milestoneMove: string;
  setMilestoneMove: (value: string) => void;
  blockerSeverity: string;
  setBlockerSeverity: (value: string) => void;
  blockerMove: string;
  setBlockerMove: (value: string) => void;
  sentimentMove: string;
  setSentimentMove: (value: string) => void;
}) {
  if (props.signal === "budget") {
    return (
      <div className="grid gap-2">
        <Label>Budget change</Label>
        <Select value={props.budgetMove} onValueChange={props.setBudgetMove}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="increase">Spend increases</SelectItem>
            <SelectItem value="decrease">Spend reduces / savings found</SelectItem>
          </SelectContent>
        </Select>
        <Input type="number" min={0} step={1000} value={props.budgetIncrease} onChange={(e) => props.setBudgetIncrease(Number(e.target.value || 0))} />
      </div>
    );
  }
  if (props.signal === "schedule") {
    return (
      <div className="grid gap-2">
        <Label>Schedule change</Label>
        <Select value={props.scheduleMove} onValueChange={props.setScheduleMove}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="delay">Critical work slips</SelectItem>
            <SelectItem value="recover">Team recovers days</SelectItem>
          </SelectContent>
        </Select>
        <Input type="number" min={0} max={60} value={props.delayDays} onChange={(e) => props.setDelayDays(Number(e.target.value || 0))} />
      </div>
    );
  }
  if (props.signal === "milestones") {
    return (
      <div className="grid gap-2">
        <Label>Milestone change</Label>
        <Select value={props.milestoneMove} onValueChange={props.setMilestoneMove}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="add">Milestones become at risk</SelectItem>
            <SelectItem value="resolve">At-risk milestones recover</SelectItem>
          </SelectContent>
        </Select>
        <Input type="number" min={0} max={10} value={props.milestoneCount} onChange={(e) => props.setMilestoneCount(Number(e.target.value || 0))} />
      </div>
    );
  }
  if (props.signal === "blockers") {
    return (
      <div className="grid gap-2">
        <Label>Blocker change</Label>
        <Select value={props.blockerMove} onValueChange={props.setBlockerMove}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="add">New blocker appears</SelectItem>
            <SelectItem value="resolve">Blocker gets resolved</SelectItem>
          </SelectContent>
        </Select>
        <Select value={props.blockerSeverity} onValueChange={props.setBlockerSeverity}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low impact</SelectItem>
            <SelectItem value="medium">Medium impact</SelectItem>
            <SelectItem value="high">High impact</SelectItem>
            <SelectItem value="critical">Critical impact</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }
  return (
    <div>
      <Label>Stakeholder tone change</Label>
      <Select value={props.sentimentMove} onValueChange={props.setSentimentMove}>
        <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="better">Improves materially</SelectItem>
          <SelectItem value="worse">Worsens materially</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function scenarioDelta(signal: typeof SIGNALS[number], values: {
  budgetIncrease: number;
  budgetMove: string;
  budgetTotal?: number;
  delayDays: number;
  scheduleMove: string;
  milestoneCount: number;
  milestoneMove: string;
  blockerSeverity: string;
  blockerMove: string;
  sentimentMove: string;
}) {
  if (signal === "budget") {
    const base = values.budgetTotal && values.budgetTotal > 0 ? values.budgetTotal : 100000;
    const movement = Math.min(60, (values.budgetIncrease / base) * 100);
    return values.budgetMove === "decrease" ? movement : -movement;
  }
  if (signal === "schedule") {
    const movement = Math.min(60, values.delayDays * 2);
    return values.scheduleMove === "recover" ? movement : -movement;
  }
  if (signal === "milestones") {
    const movement = Math.min(70, values.milestoneCount * 12);
    return values.milestoneMove === "resolve" ? movement : -movement;
  }
  if (signal === "blockers") {
    const movement = ({ low: 8, medium: 18, high: 32, critical: 50 } as Record<string, number>)[values.blockerSeverity] ?? 20;
    return values.blockerMove === "resolve" ? movement : -movement;
  }
  return values.sentimentMove === "better" ? 20 : -25;
}

function ReasoningTab({ projectId }: { projectId: string }) {
  const [r, setR] = useState<AnalyzeResult | null>(() => {
    try { const raw = localStorage.getItem(`pp_last_analysis_${projectId}`); return raw ? JSON.parse(raw) : null; } catch { return null; }
  });

  if (!r) {
    return (
      <Card className="p-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl gradient-brand text-white mx-auto mb-4">
          <BrainCircuit className="h-8 w-8" />
        </div>
        <h3 className="font-semibold text-lg">No analysis yet</h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
          Go to <b>Upload &amp; Analyze</b>, upload a plan file and click <b>Analyze &amp; score</b>.
        </p>
      </Card>
    );
  }

  const signals = Object.entries(r.sub_scores).map(([k, v]) => ({ label: signalLabel(k), score: v }));
  const sentences = splitNarrative(r.narrative).filter(Boolean).slice(0, 6);
  const trace = r.reasoning_trace || [];

  const ragColors = {
    Red:   { bg: "bg-[var(--rag-red)]/15 border-[var(--rag-red)]/40",   text: "text-[var(--rag-red)]",   dot: "var(--rag-red)" },
    Amber: { bg: "bg-[var(--rag-amber)]/15 border-[var(--rag-amber)]/40", text: "text-[var(--rag-amber)]", dot: "var(--rag-amber)" },
    Green: { bg: "bg-[var(--rag-green)]/15 border-[var(--rag-green)]/40", text: "text-[var(--rag-green)]", dot: "var(--rag-green)" },
  } as Record<string, { bg: string; text: string; dot: string }>;
  const rc = ragColors[r.rag_status] ?? { bg: "bg-muted", text: "text-foreground", dot: "var(--muted-foreground)" };

  return (
    <div className="space-y-5">
      {/* Hero Score Banner */}
      <div className={`relative overflow-hidden rounded-2xl p-7 shadow-xl border-2 ${rc.bg}`}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 10% 60%, var(--foreground), transparent 50%), radial-gradient(circle at 90% 10%, var(--foreground), transparent 45%)" }} />
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-bold tracking-wide mb-3 ${rc.bg} ${rc.text}`}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: rc.dot }} />
              {r.rag_status} Status
            </div>
            <div className="text-6xl font-bold tracking-tight tabular-nums">
              {(r.composite_score ?? 0).toFixed(1)}<span className="text-2xl font-normal opacity-60 ml-2">/100</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm opacity-90">
              <span>Data confidence: <b>{Math.round(r.data_confidence * 100)}%</b></span>
              <span>Trend: <b>{friendlyTrend(r.trend_vs_last_week)}</b></span>
              <span className="opacity-75">Scored {r.run_date}</span>
            </div>
          </div>
          <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${rc.bg} shrink-0`}>
            <BrainCircuit className={`h-8 w-8 ${rc.text}`} />
          </div>
        </div>
      </div>

      {/* Signal Performance */}
      <Card className="p-6">
        <h3 className="font-semibold mb-5 flex items-center gap-2">
          <Activity className="h-4 w-4 text-[var(--brand-2)]" /> How Each Signal Performed
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {signals.map(({ label, score }) => {
            const s = score ?? 0;
            const color = s >= 75 ? "var(--rag-green)" : s >= 50 ? "var(--rag-amber)" : "var(--rag-red)";
            const bg = s >= 75 ? "bg-[var(--rag-green)]/10" : s >= 50 ? "bg-[var(--rag-amber)]/10" : "bg-[var(--rag-red)]/10";
            return (
              <div key={label} className={`rounded-2xl border p-4 ${bg}`}>
                <div className="text-xs font-semibold uppercase tracking-widest mb-2 text-muted-foreground">{label}</div>
                <div className="text-3xl font-bold tabular-nums" style={{ color }}>{s.toFixed(0)}</div>
                <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(2, s)}%`, backgroundColor: color }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Plain-English Readout */}
      {sentences.length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold mb-5 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--brand-2)]" /> What the AI Found — in Plain English
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sentences.map((s, i) => (
              <div key={i} className="flex gap-3 rounded-2xl border bg-muted/30 p-4 text-sm leading-relaxed">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--brand-2)]/10 text-[var(--brand-2)] text-xs font-bold">{i + 1}</span>
                <span className="text-foreground">{friendlySentence(s)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Risks + Actions */}
      <div className="grid md:grid-cols-2 gap-5">
        <div className="rounded-2xl border bg-card p-5 space-y-3">
          <h3 className="font-semibold flex items-center gap-2 text-[var(--rag-red)]">
            <AlertTriangle className="h-4 w-4" /> Top Risks Identified
          </h3>
          {(r.top_risks?.length ? r.top_risks : ["No material risks identified."]).slice(0, 5).map((item, i) => (
            <div key={i} className="flex gap-3 rounded-xl bg-[var(--rag-red)]/5 border border-[var(--rag-red)]/15 p-4 text-[15px] leading-relaxed">
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[var(--rag-red)]" />
              <span>{formatInsightItem(item)}</span>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border bg-card p-5 space-y-3">
          <h3 className="font-semibold flex items-center gap-2 text-[var(--rag-green)]">
            <CheckCircle2 className="h-4 w-4" /> Recommended Actions
          </h3>
          {(r.recommended_actions?.length ? r.recommended_actions : ["No specific actions recommended."]).slice(0, 5).map((item, i) => (
            <div key={i} className="flex gap-3 rounded-xl bg-[var(--rag-green)]/5 border border-[var(--rag-green)]/15 p-4 text-[15px] leading-relaxed">
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-[var(--rag-green)]" />
              <span>{formatInsightItem(item)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Reasoning Timeline */}
      {trace.length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold mb-1 flex items-center gap-2">
            <FileSearch className="h-4 w-4 text-[var(--brand-2)]" /> AI Reasoning Timeline
          </h3>
          <p className="text-sm text-muted-foreground mb-6">Step-by-step evidence checks the agent ran to explain this score.</p>
          <div className="relative">
            <div className="absolute left-[17px] top-0 bottom-0 w-px bg-border" />
            <Accordion type="single" collapsible className="space-y-4">
              {trace.map((step, i) => (
                <AccordionItem key={i} value={`s-${i}`} className="relative flex gap-4 border-none">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand-2)]/10 border-2 border-background ring-1 ring-[var(--brand-2)]/30 text-xs font-bold text-[var(--brand-2)] z-10 mt-1">
                    {i + 1}
                  </div>
                  <div className="flex-1 rounded-2xl border bg-muted/30 p-0 mb-1 overflow-hidden">
                    <AccordionTrigger className="px-5 py-4 hover:bg-muted/50 transition-colors text-left hover:no-underline border-b-0">
                      <div>
                        <div className="font-semibold text-base mb-1">{prettyKey(step.step || step.tool || `Step ${i + 1}`)}</div>
                        <div className="text-sm text-muted-foreground leading-relaxed font-normal">{friendlySentence(traceSummary(step))}</div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-5 py-4 border-t bg-card/50">
                      <div className="space-y-3">
                        {Object.entries(step).filter(([k]) => !["step","tool"].includes(k)).map(([k,v]) => v && (
                          <div key={k} className="rounded-xl border bg-background/60 p-3 text-sm">
                            <span className="font-semibold uppercase tracking-wide text-muted-foreground block mb-1">{prettyKey(k)}</span>
                            <span className="text-foreground leading-relaxed break-words">{formatTraceValue(v)}</span>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </div>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </Card>
      )}
    </div>
  );
}

function splitNarrative(text: string) {
  const parts = text.split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean);
  return parts.length ? parts : [text];
}

function InsightList({ title, icon: Icon, tone, items }: { title: string; icon: any; tone: "risk" | "good"; items?: any[] }) {
  const color = tone === "risk" ? "var(--rag-red)" : "var(--rag-green)";
  const fallback = tone === "risk" ? "No material risks returned." : "No recommended action returned.";
  return (
    <div className="rounded-xl border bg-card p-4">
      <h4 className="mb-3 flex items-center gap-2 font-semibold" style={{ color }}><Icon className="h-4 w-4" /> {title}</h4>
      <div className="grid gap-2">
        {(items?.length ? items : [fallback]).slice(0, 5).map((item, i) => (
          <div key={i} className="flex gap-2 rounded-lg bg-muted/40 p-3 text-sm leading-relaxed">
            {tone === "risk" ? <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" style={{ color }} /> : <ArrowRight className="mt-0.5 h-4 w-4 shrink-0" style={{ color }} />}
            <span>{formatInsightItem(item)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReasoningTile({ index, text }: { index: number; text: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 text-sm leading-relaxed shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand-2)]/10 text-[var(--brand-2)]">{index}</span>
        Evidence point
      </div>
      {text}
    </div>
  );
}

function TraceCard({ step }: { step: Record<string, any> }) {
  const entries = Object.entries(step || {}).filter(([, value]) => value !== null && value !== undefined && value !== "");
  return (
    <div className="grid gap-3 rounded-xl bg-muted/50 p-3">
      {entries.map(([key, value]) => (
        <div key={key} className="grid gap-2 rounded-lg bg-card p-3 text-sm sm:grid-cols-[170px_1fr]">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{prettyKey(key)}</div>
          <div className="leading-relaxed text-foreground">{formatTraceValue(value)}</div>
        </div>
      ))}
    </div>
  );
}

function statusBadgeClass(status?: string | null) {
  const normalized = (status || "").toLowerCase();
  if (normalized.includes("complete") || normalized.includes("done")) return "border-[var(--rag-green)]/40 text-[var(--rag-green)]";
  if (normalized.includes("risk") || normalized.includes("delay") || normalized.includes("block")) return "border-[var(--rag-red)]/40 text-[var(--rag-red)]";
  if (normalized.includes("progress") || normalized.includes("started")) return "border-[var(--rag-amber)]/40 text-[var(--rag-amber)]";
  return "";
}

function formatDateRange(start?: string | null, end?: string | null) {
  if (!start && !end) return "No dates available";
  if (start && end) return `${start} to ${end}`;
  return start ? `Starts ${start}` : `Ends ${end}`;
}

function completionLabel(value: number) {
  if (value >= 100) return "Done";
  if (value <= 0) return "Not started";
  if (value < 35) return "Early";
  if (value < 75) return "In motion";
  return "Nearly done";
}

function signalTone(value?: string | null): "good" | "watch" | "risk" | "neutral" {
  const text = (value || "").toLowerCase();
  if (!text || text.includes("not available") || text.includes("missing") || text.includes("unknown")) return "neutral";
  if (text.includes("weak") || text.includes("overdue") || text.includes("risk") || text.includes("blocked") || text.includes("negative") || text.includes("behind") || text.includes("slippage")) return "risk";
  if (text.includes("watch") || text.includes("at risk") || text.includes("planned") || text.includes("monitor")) return "watch";
  if (text.includes("complete") || text.includes("healthy") || text.includes("no active") || text.includes("positive")) return "good";
  return "neutral";
}

function friendlySignalText(value?: string | null) {
  if (!value) return "No signal available.";
  return friendlySentence(value);
}

function friendlyParserWarnings(result: UploadValidationResult) {
  const warnings = result.parse_warnings || [];
  const counts = result.normalized_counts || {};
  const totalRows = Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);
  return warnings
    .filter((warning) => {
      // If we found data rows, suppress generic "no rows" messages — they are misleading
      if (totalRows > 0 && /no rows found|no task, milestone, risk, or scope rows/i.test(warning)) return false;
      // Suppress "no milestone rows" when milestones count is 0 (expected, not an error)
      if (Number(counts.milestones ?? 0) === 0 && /milestones?.*no milestone/i.test(warning)) return false;
      // Suppress "no risk rows" when risks is 0
      if (Number(counts.risks ?? 0) === 0 && /risks?.*no risk/i.test(warning)) return false;
      // Suppress "no scope" when scope_changes is 0
      if (Number(counts.scope_changes ?? 0) === 0 && /scope.*no scope/i.test(warning)) return false;
      return true;
    })
    .map((warning) => friendlyWarning(warning));
}

function friendlyWarning(warning: string) {
  return warning
    .replace(/^milestones:\s*/i, "No milestone rows detected: ")
    .replace(/^risks:\s*/i, "No risk rows detected: ")
    .replace(/^scope_changes:\s*/i, "No scope-change rows detected: ")
    .replace(/_/g, " ");
}

function friendlyWarningSummary(warnings: string[]) {
  const friendly = warnings.map(friendlyWarning);
  if (friendly.length <= 2) return friendly.join(" ");
  return `${friendly.slice(0, 2).join(" ")} ${friendly.length - 2} more item(s) need review.`;
}

function friendlySentence(text: unknown) {
  return String(text ?? "")
    .replace(/\bsub-score\b/gi, "signal score")
    .replace(/\bcomposite score\b/gi, "overall health score")
    .replace(/\bSchedule variance is\b/gi, "Schedule progress is")
    .replace(/\bpercentage points against expected progress\b/gi, "points behind the expected plan")
    .replace(/_/g, " ");
}

function formatInsightItem(value: unknown) {
  const parsed = parseJsonLike(value);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, any>;
    const direct =
      obj.text ??
      obj.message ??
      obj.description ??
      obj.risk ??
      obj.action ??
      obj.recommendation ??
      obj.summary ??
      obj.reason ??
      obj.title;
    if (direct) return friendlySentence(direct);
    return Object.entries(obj)
      .filter(([, item]) => item !== null && item !== undefined && item !== "")
      .map(([key, item]) => `${prettyKey(key)}: ${formatTraceValue(item)}`)
      .join(" | ");
  }
  if (Array.isArray(parsed)) return parsed.map(formatInsightItem).join(" ");
  return friendlySentence(parsed ?? value);
}

function parseJsonLike(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || !/^[\[{]/.test(trimmed)) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function friendlyTrend(value?: string) {
  if (!value) return "No prior comparison";
  return friendlySentence(value);
}

function traceSummary(step: Record<string, any>) {
  const t = String(step.tool || step.step || "").toLowerCase();
  if (t.includes("history")) return "Fetched historical performance data for the project.";
  if (t.includes("config")) return "Loaded current scoring rules and threshold configurations.";
  if (t.includes("similar") || t.includes("past")) return "Searched historical database for projects with similar risk patterns.";
  if (t.includes("raw") || t.includes("data")) return "Retrieved raw task and milestone data from the snapshot.";
  if (t.includes("score")) return "Calculated signal metrics and composite health score.";
  if (t) return `Executed ${prettyKey(t).toLowerCase()} evidence check.`;
  
  return "Completed evidence check and data validation.";
}

function prettyKey(key: string) {
  return String(key)
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatTraceValue(value: any): string {
  const parsed = parseJsonLike(value);
  if (parsed === null || parsed === undefined) return "Not available";
  if (Array.isArray(parsed)) return parsed.map(formatTraceValue).join("; ");
  if (typeof parsed === "object") {
    return Object.entries(parsed)
      .filter(([, item]) => item !== null && item !== undefined && item !== "")
      .map(([key, item]) => `${prettyKey(key)}: ${formatTraceValue(item)}`)
      .join("; ");
  }
  return friendlySentence(parsed);
}

function ExportsTab({ projectId }: { projectId: string }) {
  const [md, setMd] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const load = useMutation({
    mutationFn: () => api<string>(`/projects/${projectId}/export`),
    onSuccess: (d) => setMd(typeof d === "string" ? d : JSON.stringify(d, null, 2)),
    onError: (e: any) => toast.error(e.message),
  });

  async function downloadPdf() {
    setDownloadingPdf(true);
    try {
      await downloadBackendFile(`/projects/${projectId}/export/pdf`, {
        filename: `${projectId}_weekly_status_report.pdf`,
        accept: "application/pdf",
      });
      toast.success("Weekly PDF downloaded");
    } catch (error: any) {
      toast.error(error.message || "Download failed");
    } finally {
      setDownloadingPdf(false);
    }
  }

  return (
    <div className="grid gap-4">
      <Card className="p-5">
        <h3 className="font-semibold mb-3">Weekly project report</h3>
        <div className="flex gap-3 flex-wrap">
          <Button onClick={() => load.mutate()} variant="outline" disabled={load.isPending}>
            <FileText className="h-4 w-4 mr-2" /> {load.isPending ? "Loading…" : "View Markdown report"}
          </Button>
          <Button className="gradient-brand text-white border-0" onClick={downloadPdf} disabled={downloadingPdf}>
            <FileDown className="h-4 w-4 mr-2" /> {downloadingPdf ? "Downloading..." : "Download weekly PDF"}
          </Button>
        </div>
      </Card>
      {md && (
        <Card className="p-5">
          <h3 className="font-semibold mb-2">Markdown preview</h3>
          <pre className="whitespace-pre-wrap text-sm bg-muted rounded p-4 max-h-[500px] overflow-auto">{md}</pre>
        </Card>
      )}
    </div>
  );
}


