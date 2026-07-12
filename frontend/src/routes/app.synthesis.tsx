import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { downloadBackendFile } from "@/lib/download";
import { PageContainer, PageHeader, StatCard, ErrorBox, LoadingSkeleton } from "@/components/page-parts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, CheckCircle2, FileDown, GitCompareArrows, Presentation, RefreshCw, Calendar, TrendingUp, TrendingDown, Minus, ShieldAlert } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import { ragColor } from "@/lib/rag";

export const Route = createFileRoute("/app/synthesis")({ component: SynthesisPage });

function SynthesisPage() {
  const qc = useQueryClient();
  const synthesis = useQuery<any>({ queryKey: ["synthesis"], queryFn: () => api("/synthesis/monthly") });
  const history = useQuery<any[]>({ queryKey: ["deck-history"], queryFn: () => api("/synthesis/history") });
  const [downloadingDeck, setDownloadingDeck] = useState<string | null>(null);

  async function downloadDeck(deck: { filename: string; download_url?: string }) {
    setDownloadingDeck(deck.filename);
    try {
      await downloadBackendFile(deck.download_url || `/synthesis/decks/${deck.filename}/download`, {
        filename: deck.filename,
        accept: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      });
      toast.success("Deck downloaded");
    } catch (error: any) {
      toast.error(error.message || "Deck download failed");
    } finally {
      setDownloadingDeck(null);
    }
  }

  const genDefault = useMutation({
    mutationFn: () => api("/synthesis/generate-deck", { method: "POST", body: JSON.stringify({}) }),
    onSuccess: (d: any) => { toast.success(`Deck generated: ${d.filename}`); qc.invalidateQueries({ queryKey: ["deck-history"] }); qc.invalidateQueries({ queryKey: ["audit-log"] }); downloadDeck(d); },
    onError: (e: any) => toast.error(e.message),
  });

  const [brandOpen, setBrandOpen] = useState(false);

  return (
    <PageContainer>
      <PageHeader
        title="Monthly Synthesis"
        description="Portfolio-wide executive insights and boardroom deck generation."
        actions={
          <>
            <Button variant="outline" onClick={() => synthesis.refetch()}><RefreshCw className={`h-4 w-4 mr-2 ${synthesis.isFetching ? "animate-spin" : ""}`} /> Refresh</Button>
            <Button onClick={() => genDefault.mutate()} disabled={genDefault.isPending}>
              <Presentation className="h-4 w-4 mr-2" /> {genDefault.isPending ? "Generating…" : "Default deck"}
            </Button>
            <Dialog open={brandOpen} onOpenChange={setBrandOpen}>
              <DialogTrigger asChild><Button className="gradient-brand text-white border-0"><Presentation className="h-4 w-4 mr-2" /> Branded deck</Button></DialogTrigger>
              <BrandedDialog onClose={() => setBrandOpen(false)} />
            </Dialog>
          </>
        }
      />

      {synthesis.error && <ErrorBox error={synthesis.error} />}
      {synthesis.isLoading && <LoadingSkeleton />}

      {synthesis.data && <SynthesisBody s={synthesis.data} />}

      <Card className="p-5 mt-6">
        <h3 className="font-semibold mb-3">Deck history</h3>
        {history.isLoading && <LoadingSkeleton rows={2} />}
        {history.error && <ErrorBox error={history.error} />}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-muted-foreground border-b">
              <th className="py-2 px-2">Filename</th><th className="py-2 px-2">Size</th><th className="py-2 px-2">Modified</th><th className="py-2 px-2">Download</th>
            </tr></thead>
            <tbody>
              {(history.data || []).map((d: any, i: number) => (
                <tr key={i} className="border-b">
                  <td className="py-2 px-2 font-mono text-xs">{d.filename || d.name}</td>
                  <td className="py-2 px-2">{d.size_bytes ? `${Math.round(d.size_bytes / 1024)} KB` : "N/A"}</td>
                  <td className="py-2 px-2">{d.modified_at ? new Date(Number(d.modified_at) * 1000).toLocaleString() : "N/A"}</td>
                  <td className="py-2 px-2">
                    <Button size="sm" variant="outline" onClick={() => downloadDeck(d)} disabled={downloadingDeck === d.filename}>
                      <FileDown className="h-3.5 w-3.5 mr-1.5" /> {downloadingDeck === d.filename ? "Downloading..." : "Download"}
                    </Button>
                  </td>
                </tr>
              ))}
              {(!history.data || history.data.length === 0) && <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">No decks generated yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </PageContainer>
  );
}

function SynthesisBody({ s }: { s: any }) {
  const trendIcon = s.portfolio_trend === "improving" ? TrendingUp : s.portfolio_trend === "declining" ? TrendingDown : Minus;
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Period" value={s.period} icon={Calendar} />
        <StatCard label="Total projects" value={s.total_projects} tone="brand" />
        <StatCard label="Avg confidence" value={`${Math.round((s.average_confidence ?? 0) * 100)}%`} tone="brand" />
        <StatCard label="Portfolio trend" value={s.portfolio_trend} icon={trendIcon} tone={s.portfolio_trend === "improving" ? "green" : s.portfolio_trend === "declining" ? "red" : undefined} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-semibold mb-2">RAG distribution</h3>
          <div className="h-56">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={[
                  { name: "Green", value: s.rag_distribution?.Green ?? 0 },
                  { name: "Amber", value: s.rag_distribution?.Amber ?? 0 },
                  { name: "Red", value: s.rag_distribution?.Red ?? 0 },
                ]} dataKey="value" nameKey="name" outerRadius={80} label>
                  {["Green", "Amber", "Red"].map((k) => <Cell key={k} fill={ragColor(k)} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold mb-2">Trend points</h3>
          <div className="h-56">
            {(s.trend_points || []).length > 0 ? (
              <ResponsiveContainer>
                <LineChart data={s.trend_points}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="run_date" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
                  <Line type="monotone" dataKey="average_score" stroke="var(--brand)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">No trend data yet.</div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ListCard title="Movers" items={s.movers} variant="movers" />
        <ListCard title="Systemic themes" items={s.systemic_themes} variant="themes" />
        <ListCard title="Emerging risks" items={s.emerging_risks} variant="risks" />
        <ListCard title="Recommendations" items={s.recommendations} variant="actions" />
      </div>
    </div>
  );
}

function ListCard({ title, items, variant }: { title: string; items?: any[]; variant: "movers" | "themes" | "risks" | "actions" }) {
  const styles = {
    movers: { color: "var(--brand-2)", bg: "bg-[var(--brand-2)]/10", icon: GitCompareArrows },
    themes: { color: "var(--brand)", bg: "bg-[var(--brand)]/10", icon: ShieldAlert },
    risks: { color: "var(--rag-red)", bg: "bg-[var(--rag-red)]/10", icon: AlertTriangle },
    actions: { color: "var(--rag-green)", bg: "bg-[var(--rag-green)]/10", icon: CheckCircle2 },
  }[variant];
  const Icon = styles.icon;
  const visibleItems = (items && items.length > 0) ? items.slice(0, 5) : [];

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b bg-muted/30 p-5">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${styles.bg}`} style={{ color: styles.color }}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold" style={{ color: styles.color }}>{title}</h3>
            <p className="text-xs text-muted-foreground">{sectionSubtitle(variant, visibleItems.length)}</p>
          </div>
        </div>
      </div>
      <div className="grid gap-3 p-5">
        {visibleItems.length > 0 ? visibleItems.map((item, i) => (
          <InsightRow key={i} index={i + 1} item={item} variant={variant} color={styles.color} />
        )) : (
          <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">{emptyText(variant)}</div>
        )}
      </div>
    </Card>
  );
}

function InsightRow({ index, item, variant, color }: { index: number; item: any; variant: "movers" | "themes" | "risks" | "actions"; color: string }) {
  if (variant === "movers" && item && typeof item === "object") {
    return (
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold" style={{ backgroundColor: `${color}22`, color }}>{index}</span>
          <span className="font-semibold">{item.project_name || item.project_id || "Project"}</span>
          <span className="text-xs text-muted-foreground">{item.from_status || "Previous"} to {item.to_status || "Current"}</span>
          {typeof item.score_delta === "number" && <span className="ml-auto text-xs font-semibold" style={{ color }}>{item.score_delta > 0 ? "+" : ""}{item.score_delta.toFixed(1)}</span>}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{cleanInsightText(item.reason || "Status changed based on the latest scoring evidence.")}</p>
      </div>
    );
  }

  return (
    <div className="flex gap-3 rounded-xl border bg-card p-4 text-sm leading-relaxed">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold" style={{ backgroundColor: `${color}22`, color }}>{index}</span>
      <span className="min-w-0 break-words">{cleanInsightText(item)}</span>
      {variant === "actions" && <ArrowRight className="ml-auto mt-0.5 h-4 w-4 shrink-0" style={{ color }} />}
    </div>
  );
}

function cleanInsightText(value: any): string {
  const parsed = parseJsonLike(value);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const direct = parsed.message || parsed.reason || parsed.description || parsed.recommendation || parsed.action || parsed.summary || parsed.project_name;
    if (direct) return cleanInsightText(direct);
    return Object.entries(parsed)
      .filter(([, item]) => item !== null && item !== undefined && item !== "")
      .map(([key, item]) => `${label(key)}: ${cleanInsightText(item)}`)
      .join(" | ");
  }
  if (Array.isArray(parsed)) return parsed.map(cleanInsightText).join("; ");
  return String(parsed ?? "")
    .replace(/\bsub-score\b/gi, "signal score")
    .replace(/\bcomposite score\b/gi, "overall health score")
    .replace(/\bSchedule variance is\b/gi, "Schedule progress is")
    .replace(/\bpercentage points against expected progress\b/gi, "points behind the expected plan")
    .replace(/_/g, " ");
}

function parseJsonLike(value: any): any {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!/^[\[{]/.test(trimmed)) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function sectionSubtitle(variant: "movers" | "themes" | "risks" | "actions", count: number) {
  if (variant === "movers") return count ? `${count} status movement insight(s)` : "No status movement this cycle";
  if (variant === "themes") return "Patterns across the portfolio";
  if (variant === "risks") return "Issues that may affect delivery";
  return "Executive next steps";
}

function emptyText(variant: "movers" | "themes" | "risks" | "actions") {
  if (variant === "movers") return "No project changed RAG status in the current comparison window.";
  if (variant === "themes") return "No systemic themes are visible from the latest scored snapshots.";
  if (variant === "risks") return "No emerging risks were reported.";
  return "No recommendations were generated yet.";
}

function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
function BrandedDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ use_default_branding: false, client_name: "", primary_color: "#5b6ee1", accent_color: "#22c1c3", logo_path: "" });
  const gen = useMutation({
    mutationFn: () => api("/synthesis/generate-deck", { method: "POST", body: JSON.stringify({ branding: { ...form, logo_path: form.logo_path || undefined } }) }),
    onSuccess: async (d: any) => {
      toast.success(`Branded deck generated: ${d.filename}`);
      qc.invalidateQueries({ queryKey: ["deck-history"] });
      qc.invalidateQueries({ queryKey: ["audit-log"] });
      onClose();
      try {
        await downloadBackendFile(d.download_url || `/synthesis/decks/${d.filename}/download`, {
          filename: d.filename,
          accept: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        });
      } catch (error: any) {
        toast.error(error.message || "Deck download failed");
      }
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Generate branded deck</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="flex items-center justify-between"><Label>Use default branding</Label><Switch checked={form.use_default_branding} onCheckedChange={(v) => setForm({ ...form, use_default_branding: v })} /></div>
        <div><Label>Client name</Label><Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Primary color</Label><Input type="color" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} /></div>
          <div><Label>Accent color</Label><Input type="color" value={form.accent_color} onChange={(e) => setForm({ ...form, accent_color: e.target.value })} /></div>
        </div>
        <div><Label>Logo path (optional)</Label><Input value={form.logo_path} onChange={(e) => setForm({ ...form, logo_path: e.target.value })} placeholder="path/to/logo.png" /></div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => gen.mutate()} disabled={gen.isPending} className="gradient-brand text-white border-0">{gen.isPending ? "Generating…" : "Generate"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

