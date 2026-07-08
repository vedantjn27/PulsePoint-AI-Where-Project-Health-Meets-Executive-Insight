import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageContainer, PageHeader, ErrorBox, LoadingSkeleton } from "@/components/page-parts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/app/scoring-config")({ component: ScoringConfigPage });

const SIGNALS = ["schedule", "budget", "milestones", "blockers", "sentiment"] as const;

function ScoringConfigPage() {
  const qc = useQueryClient();
  const current = useQuery<any>({ queryKey: ["scoring-config"], queryFn: () => api("/scoring-config") });
  const history = useQuery<any[]>({ queryKey: ["scoring-config-history"], queryFn: () => api("/scoring-config/history") });
  const [config, setConfig] = useState<any>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (current.data && !config) setConfig(current.data);
  }, [current.data, config]);

  const weightSum = config?.weights ? SIGNALS.reduce((sum, key) => sum + Number(config.weights[key] || 0), 0) : null;

  const save = useMutation({
    mutationFn: () => {
      if (!reason.trim()) throw new Error("Change reason is required");
      return api("/scoring-config", { method: "PUT", body: JSON.stringify({ config, change_reason: reason.trim() }) });
    },
    onSuccess: (saved) => {
      toast.success("Configuration saved");
      setConfig(saved);
      setReason("");
      qc.invalidateQueries({ queryKey: ["scoring-config"] });
      qc.invalidateQueries({ queryKey: ["scoring-config-history"] });
      qc.invalidateQueries({ queryKey: ["audit-log"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <PageContainer>
      <PageHeader title="Scoring Configuration" description="Readable controls for the deterministic scoring model." />
      <Card className="p-4 mb-4 border-[var(--rag-amber)]/40 bg-[var(--rag-amber)]/10 text-sm">
        <div className="flex gap-2"><AlertTriangle className="h-4 w-4 text-[var(--rag-amber)] mt-0.5" />
          Changes affect future scoring runs. This is a methodology change, so always add a reason.
        </div>
      </Card>

      {current.error && <ErrorBox error={current.error} />}
      {current.isLoading && <LoadingSkeleton />}

      {config && (
        <div className="grid gap-4">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
              <h3 className="font-semibold">Current Methodology Version {config.version ?? "?"}</h3>
              <Badge variant={weightSum !== null && Math.abs(weightSum - 1) < 0.001 ? "secondary" : "destructive"}>
                Weights total: {weightSum?.toFixed(3)}
              </Badge>
            </div>

            <div className="grid lg:grid-cols-2 gap-5">
              <ConfigSection title="Signal Weights" description="How much each signal contributes to the final project score. Total must be 1.0.">
                {SIGNALS.map((key) => (
                  <NumberField key={key} label={label(key)} value={config.weights?.[key]} step="0.01" onChange={(value) => updateConfig(setConfig, ["weights", key], value)} />
                ))}
              </ConfigSection>

              <ConfigSection title="RAG Thresholds" description="The final score bands used to classify Green, Amber, or Red.">
                <NumberField label="Green starts at" value={config.rag_thresholds?.green_min} onChange={(value) => updateConfig(setConfig, ["rag_thresholds", "green_min"], value)} />
                <NumberField label="Amber starts at" value={config.rag_thresholds?.amber_min} onChange={(value) => updateConfig(setConfig, ["rag_thresholds", "amber_min"], value)} />
              </ConfigSection>

              <ConfigSection title="Schedule Rules" description="How far ahead or behind expected progress a project can be.">
                <NumberField label="Green variance" value={config.schedule?.variance_green} onChange={(value) => updateConfig(setConfig, ["schedule", "variance_green"], value)} />
                <NumberField label="Red variance" value={config.schedule?.variance_red} onChange={(value) => updateConfig(setConfig, ["schedule", "variance_red"], value)} />
              </ConfigSection>

              <ConfigSection title="Budget Rules" description="Budget burn compares money spent against work completed.">
                <NumberField label="Healthy burn ratio" value={config.budget?.burn_ratio_green} step="0.01" onChange={(value) => updateConfig(setConfig, ["budget", "burn_ratio_green"], value)} />
                <NumberField label="Red burn ratio" value={config.budget?.burn_ratio_red} step="0.01" onChange={(value) => updateConfig(setConfig, ["budget", "burn_ratio_red"], value)} />
              </ConfigSection>

              <ConfigSection title="Milestone Rules" description="Penalties applied when milestones are overdue, at risk, or missing dates.">
                <NumberField label="Overdue penalty" value={config.milestones?.overdue_penalty} onChange={(value) => updateConfig(setConfig, ["milestones", "overdue_penalty"], value)} />
                <NumberField label="At-risk penalty" value={config.milestones?.at_risk_penalty} onChange={(value) => updateConfig(setConfig, ["milestones", "at_risk_penalty"], value)} />
                <NumberField label="Missing due-date penalty" value={config.milestones?.missing_due_date_penalty} onChange={(value) => updateConfig(setConfig, ["milestones", "missing_due_date_penalty"], value)} />
              </ConfigSection>

              <ConfigSection title="Override Rules" description="Hard guardrails that can force Red or cap Green as Amber.">
                <NumberField label="Budget burn forces Red at" value={config.overrides?.budget_burn_ratio_red} step="0.01" onChange={(value) => updateConfig(setConfig, ["overrides", "budget_burn_ratio_red"], value)} />
                <NumberField label="Critical blocker Red after days" value={config.overrides?.critical_blocker_open_days_red} onChange={(value) => updateConfig(setConfig, ["overrides", "critical_blocker_open_days_red"], value)} />
                <NumberField label="High blocker caps Green after days" value={config.overrides?.high_blocker_open_days_cap_amber} onChange={(value) => updateConfig(setConfig, ["overrides", "high_blocker_open_days_cap_amber"], value)} />
              </ConfigSection>
            </div>

            <div className="mt-5">
              <Label>Change reason *</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Example: Make blockers more important for executive escalation" className="mt-1.5" />
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={() => save.mutate()} disabled={save.isPending || weightSum === null || Math.abs(weightSum - 1) > 0.001} className="gradient-brand text-white border-0">
                <Save className="h-4 w-4 mr-2" /> {save.isPending ? "Saving..." : "Save configuration"}
              </Button>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold mb-3">Version History</h3>
            {history.isLoading && <LoadingSkeleton rows={2} />}
            {history.error && <ErrorBox error={history.error} />}
            <Accordion type="multiple">
              {(history.data || []).map((item: any, i: number) => (
                <AccordionItem key={i} value={`h-${i}`}>
                  <AccordionTrigger>
                    <div className="flex gap-3 items-center text-sm min-w-0">
                      <Badge variant="outline">Version {item.version ?? i + 1}</Badge>
                      <span className="text-muted-foreground">{item.created_at ? new Date(item.created_at).toLocaleString() : ""}</span>
                      <span className="truncate">{item.change_reason || "Initial methodology snapshot"}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ConfigSummary config={item.config || item} />
                  </AccordionContent>
                </AccordionItem>
              ))}
              {(!history.data || history.data.length === 0) && <p className="text-sm text-muted-foreground">No history yet.</p>}
            </Accordion>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}

function ConfigSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border p-4">
      <h4 className="font-medium">{title}</h4>
      <p className="text-xs text-muted-foreground mt-1 mb-3">{description}</p>
      <div className="grid sm:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function NumberField({ label, value, onChange, step = "1" }: { label: string; value: any; onChange: (value: number) => void; step?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input className="mt-1.5" type="number" step={step} value={value ?? ""} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function ConfigSummary({ config }: { config: any }) {
  return (
    <div className="grid md:grid-cols-3 gap-3">
      <SummaryBlock title="Weights" items={config.weights} percent />
      <SummaryBlock title="RAG Thresholds" items={config.rag_thresholds} />
      <SummaryBlock title="Overrides" items={config.overrides} />
    </div>
  );
}

function SummaryBlock({ title, items, percent = false }: { title: string; items: Record<string, any>; percent?: boolean }) {
  return (
    <div className="rounded-md bg-muted/60 p-3">
      <div className="font-medium text-sm mb-2">{title}</div>
      {Object.entries(items || {}).map(([key, value]) => (
        <div key={key} className="flex justify-between gap-3 text-sm py-1">
          <span className="text-muted-foreground">{label(key)}</span>
          <b>{percent ? `${Math.round(Number(value) * 100)}%` : String(value)}</b>
        </div>
      ))}
    </div>
  );
}

function updateConfig(setConfig: React.Dispatch<React.SetStateAction<any>>, path: string[], value: number) {
  setConfig((prev: any) => {
    const next = structuredClone(prev);
    let cursor = next;
    for (const key of path.slice(0, -1)) cursor = cursor[key] ||= {};
    cursor[path[path.length - 1]] = value;
    return next;
  });
}

function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
