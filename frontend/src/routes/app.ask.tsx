import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageContainer, PageHeader } from "@/components/page-parts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useState } from "react";
import { AlertTriangle, ArrowRight, BrainCircuit, CheckCircle2, Database, FileSearch, Lightbulb, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

const STARTERS = [
  { q: "Which project is most at risk and why?", tone: "risk" },
  { q: "What changed since last week?", tone: "trend" },
  { q: "Which risks need leadership attention?", tone: "risk" },
  { q: "Are there systemic issues across the portfolio?", tone: "system" },
];

export const Route = createFileRoute("/app/ask")({ component: AskPage });

function AskPage() {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<any>(null);
  const [lastQuestion, setLastQuestion] = useState("");

  const ask = useMutation({
    mutationFn: (question: string) => api("/ask", { method: "POST", body: JSON.stringify({ question }) }),
    onSuccess: (d, question) => {
      setAnswer(d);
      setLastQuestion(question);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const submit = () => {
    if (!q.trim()) return;
    ask.mutate(q.trim());
  };

  return (
    <PageContainer>
      <PageHeader title="Ask Portfolio Agent" description="Grounded answers across your entire portfolio." />

      <Card className="overflow-hidden">
        <div className="border-b bg-muted/30 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl gradient-brand text-white">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold">Ask an executive portfolio question</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                The agent checks project history, similar risk patterns, and latest health scores before answering.
              </p>
            </div>
          </div>
        </div>

        <div className="p-5">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4 mb-4">
            {STARTERS.map((starter) => (
              <button
                key={starter.q}
                type="button"
                onClick={() => { setQ(starter.q); ask.mutate(starter.q); }}
                className="rounded-xl border bg-card p-3 text-left text-sm transition hover:bg-muted/50 hover:shadow-sm"
              >
                <Sparkles className="mb-2 h-4 w-4 text-[var(--brand-2)]" />
                {starter.q}
              </button>
            ))}
          </div>
          <Textarea
            rows={4}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ask anything about project health, risk, blockers, trends, or executive actions..."
            className="resize-none text-base leading-relaxed"
          />
          <div className="mt-3 flex justify-end">
            <Button onClick={submit} disabled={ask.isPending || !q.trim()} className="gradient-brand text-white border-0">
              <Send className="h-4 w-4 mr-2" /> {ask.isPending ? "Thinking..." : "Ask"}
            </Button>
          </div>
        </div>
      </Card>

      {ask.isPending && <ThinkingCard />}
      {answer && !ask.isPending && <AnswerPanel answer={answer} question={lastQuestion} />}
    </PageContainer>
  );
}

function ThinkingCard() {
  return (
    <Card className="mt-4 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand-2)]/10 text-[var(--brand-2)]">
          <Sparkles className="h-5 w-5 animate-pulse" />
        </div>
        <div>
          <h3 className="font-semibold">Checking portfolio evidence</h3>
          <p className="text-sm text-muted-foreground">Reviewing latest scores, trends, and historical patterns...</p>
        </div>
      </div>
    </Card>
  );
}

function AnswerPanel({ answer, question }: { answer: any; question: string }) {
  const parsed = normalizeAnswer(answer.answer);
  const cards = buildAnswerCards(parsed);

  return (
    <div className="mt-4 grid gap-4">
      <Card className="overflow-hidden">
        <div className="border-b bg-muted/30 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">Portfolio agent response</h3>
              {question && <p className="mt-1 text-sm text-muted-foreground">Question: {question}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Projects considered: {answer.projects_considered ?? "?"}</Badge>
              <Badge variant="outline">Provider: {answer.llm_provider_used ?? "unknown"}</Badge>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-5">
          {cards.summary.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              {cards.summary.map((item, i) => <AnswerCard key={i} index={i + 1} text={item} />)}
            </div>
          )}

          {(cards.risks.length > 0 || cards.actions.length > 0) && (
            <div className="grid gap-4 lg:grid-cols-2">
              <InsightBlock title="Key risks" icon={AlertTriangle} tone="risk" items={cards.risks} fallback="No specific risk items were returned." />
              <InsightBlock title="Recommended actions" icon={CheckCircle2} tone="good" items={cards.actions} fallback="No specific action items were returned." />
            </div>
          )}

          {cards.other.length > 0 && (
            <InsightBlock title="Additional evidence" icon={Lightbulb} tone="neutral" items={cards.other} fallback="" />
          )}
        </div>
      </Card>

      {answer.reasoning_trace?.length > 0 && <TraceTimeline trace={answer.reasoning_trace} />}
    </div>
  );
}

function AnswerCard({ index, text }: { index: number; text: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 text-[15px] leading-relaxed shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand-2)]/10 text-[var(--brand-2)]">{index}</span>
        Takeaway
      </div>
      {text}
    </div>
  );
}

function InsightBlock({ title, icon: Icon, tone, items, fallback }: { title: string; icon: any; tone: "risk" | "good" | "neutral"; items: string[]; fallback: string }) {
  const color = tone === "risk" ? "var(--rag-red)" : tone === "good" ? "var(--rag-green)" : "var(--brand-2)";
  const visible = items.length ? items : fallback ? [fallback] : [];
  return (
    <div className="rounded-xl border bg-card p-4">
      <h4 className="mb-3 flex items-center gap-2 font-semibold" style={{ color }}>
        <Icon className="h-4 w-4" /> {title}
      </h4>
      <div className="grid gap-2">
        {visible.map((item, i) => (
          <div key={i} className="flex gap-3 rounded-lg bg-muted/40 p-3 text-sm leading-relaxed">
            <ArrowRight className="mt-0.5 h-4 w-4 shrink-0" style={{ color }} />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TraceTimeline({ trace }: { trace: any[] }) {
  return (
    <Card className="p-5">
      <h3 className="mb-1 flex items-center gap-2 font-semibold">
        <FileSearch className="h-4 w-4 text-[var(--brand-2)]" /> Evidence trail
      </h3>
      <p className="mb-5 text-sm text-muted-foreground">What the agent checked before answering.</p>
      <div className="relative">
        <div className="absolute bottom-0 left-[18px] top-0 w-px bg-border" />
        <Accordion type="single" collapsible className="space-y-3">
          {trace.map((step, i) => (
            <AccordionItem key={i} value={`trace-${i}`} className="relative flex gap-4 border-none">
              <div className="z-10 mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-background bg-[var(--brand-2)]/10 text-xs font-bold text-[var(--brand-2)] ring-1 ring-[var(--brand-2)]/30">
                {i + 1}
              </div>
              <div className="mb-1 flex-1 overflow-hidden rounded-2xl border bg-muted/30">
                <AccordionTrigger className="px-5 py-4 text-left hover:bg-muted/50 hover:no-underline">
                  <div>
                    <div className="text-base font-semibold">{traceTitle(step, i)}</div>
                    <div className="text-sm font-normal leading-relaxed text-muted-foreground">{traceSummary(step)}</div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="border-t bg-card/50 px-5 py-4">
                  <div className="grid gap-3">
                    {Object.entries(step || {}).map(([key, value]) => (
                      <div key={key} className="rounded-xl border bg-background/60 p-3 text-sm">
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label(key)}</div>
                        <div className="break-words leading-relaxed">{formatValue(value)}</div>
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
  );
}

function normalizeAnswer(value: any): any {
  const parsed = parseJsonLike(value);
  return parsed ?? value;
}

function buildAnswerCards(value: any) {
  const summary: string[] = [];
  const risks: string[] = [];
  const actions: string[] = [];
  const other: string[] = [];

  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    for (const [key, item] of Object.entries(value)) {
      const normalizedKey = key.toLowerCase();
      const list = toTextList(item);
      if (/risk|issue|blocker|concern/.test(normalizedKey)) risks.push(...list);
      else if (/action|recommend|next|step/.test(normalizedKey)) actions.push(...list);
      else if (/answer|summary|narrative|insight|takeaway|response/.test(normalizedKey)) summary.push(...list);
      else other.push(...list.map((text) => `${label(key)}: ${text}`));
    }
  } else {
    summary.push(...splitReadableText(String(value ?? "")));
  }

  if (summary.length === 0 && other.length > 0) summary.push(other.shift() as string);
  return {
    summary: summary.slice(0, 6),
    risks: risks.slice(0, 5),
    actions: actions.slice(0, 5),
    other: other.slice(0, 5),
  };
}

function toTextList(value: any): string[] {
  const parsed = parseJsonLike(value);
  if (Array.isArray(parsed)) return parsed.flatMap(toTextList);
  if (parsed && typeof parsed === "object") {
    const direct = parsed.text || parsed.message || parsed.description || parsed.answer || parsed.summary || parsed.reason || parsed.action || parsed.recommendation;
    if (direct) return toTextList(direct);
    return Object.entries(parsed).map(([key, item]) => `${label(key)}: ${formatValue(item)}`);
  }
  return splitReadableText(String(parsed ?? ""));
}

function splitReadableText(text: string) {
  const cleaned = cleanText(text);
  if (!cleaned) return [];
  const bulletParts = cleaned.split(/\n+|(?:^|\s)[-*]\s+/).map((part) => part.trim()).filter(Boolean);
  if (bulletParts.length > 1) return bulletParts.slice(0, 8);
  const sentences = cleaned.split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean);
  if (sentences.length > 1) return sentences.slice(0, 8);
  return [cleaned];
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

function formatValue(value: any): string {
  const parsed = parseJsonLike(value);
  if (parsed === null || parsed === undefined) return "Not available";
  if (Array.isArray(parsed)) return parsed.map(formatValue).join("; ");
  if (typeof parsed === "object") {
    return Object.entries(parsed)
      .filter(([, item]) => item !== null && item !== undefined && item !== "")
      .map(([key, item]) => `${label(key)}: ${formatValue(item)}`)
      .join("; ");
  }
  return cleanText(String(parsed));
}

function cleanText(text: string) {
  return text
    .replace(/\bsub-score\b/gi, "signal score")
    .replace(/\bcomposite score\b/gi, "overall health score")
    .replace(/\bpercentage points against expected progress\b/gi, "points behind expected progress")
    .replace(/_/g, " ")
    .trim();
}

function traceTitle(step: any, index: number) {
  return label(step?.tool || step?.step || `Evidence check ${index + 1}`);
}

function traceSummary(step: any) {
  const tool = String(step?.tool || step?.step || "").toLowerCase();
  if (tool.includes("history")) return "Reviewed recent project health history.";
  if (tool.includes("similar")) return "Compared against projects with similar risk patterns.";
  if (step?.why) return cleanText(String(step.why));
  return "Evidence check completed.";
}

function label(value: string) {
  return String(value)
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
