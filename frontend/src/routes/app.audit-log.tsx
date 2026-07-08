import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageContainer, PageHeader, ErrorBox, LoadingSkeleton } from "@/components/page-parts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useMemo, useState } from "react";
import { Activity, Filter, RefreshCw, Search, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/app/audit-log")({ component: AuditLogPage });

function AuditLogPage() {
  const [eventFilter, setEventFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [query, setQuery] = useState("");
  const { data, isLoading, error, refetch, isFetching } = useQuery<any[]>({
    queryKey: ["audit-log"], queryFn: () => api("/audit-log?limit=200"),
  });

  const eventTypes = useMemo(() => uniqueValues(data || [], "event_type"), [data]);
  const entityTypes = useMemo(() => uniqueValues(data || [], "entity_type"), [data]);
  const filtered = (data || []).filter((event) => {
    const matchesEvent = eventFilter === "all" || event.event_type === eventFilter;
    const matchesEntity = entityFilter === "all" || event.entity_type === entityFilter;
    const haystack = `${event.event_type} ${event.entity_type} ${event.entity_id} ${event.message} ${JSON.stringify(event.details || {})}`.toLowerCase();
    const matchesQuery = !query.trim() || haystack.includes(query.trim().toLowerCase());
    return matchesEvent && matchesEntity && matchesQuery;
  });

  return (
    <PageContainer>
      <PageHeader
        title="Audit Log"
        description="Every analyze, export, seed, and config action is recorded."
        actions={<Button variant="outline" onClick={() => refetch()}><RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} /> Refresh</Button>}
      />
      {error && <ErrorBox error={error} />}
      {isLoading && <LoadingSkeleton />}
      {data && (
        <div className="grid gap-4">
          <Card className="p-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search audit events, projects, files, or messages" className="pl-9 text-[15px]" />
              </div>
              <Select value={eventFilter} onValueChange={setEventFilter}>
                <SelectTrigger><Filter className="h-4 w-4 mr-2" /><SelectValue placeholder="Event type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All events</SelectItem>
                  {eventTypes.map((type) => <SelectItem key={type} value={type}>{prettyKey(type)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger><ShieldCheck className="h-4 w-4 mr-2" /><SelectValue placeholder="Entity type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All entities</SelectItem>
                  {entityTypes.map((type) => <SelectItem key={type} value={type}>{prettyKey(type)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              Showing {filtered.length} of {data.length} recorded event{data.length === 1 ? "" : "s"}.
            </div>
          </Card>

          <Card className="p-3">
            <Accordion type="multiple" className="space-y-3">
              {filtered.map((event) => (
                <AccordionItem key={event.id} value={`e-${event.id}`} className="rounded-xl border px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex w-full items-start gap-4 text-left">
                      <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-2)]/10 text-[var(--brand-2)]">
                        <Activity className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{prettyKey(event.event_type)}</Badge>
                          <span className="text-sm text-muted-foreground">{prettyKey(event.entity_type || "entity")} / {event.entity_id || "N/A"}</span>
                        </div>
                        <p className="mt-2 text-[15px] leading-relaxed">{event.message}</p>
                      </div>
                      <span className="hidden shrink-0 text-sm text-muted-foreground md:block">{new Date(event.created_at).toLocaleString()}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <AuditDetails details={event.details} />
                  </AccordionContent>
                </AccordionItem>
              ))}
              {filtered.length === 0 && <p className="p-6 text-center text-[15px] text-muted-foreground">No events match the current filters.</p>}
            </Accordion>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}

function AuditDetails({ details }: { details: any }) {
  if (!details || (typeof details === "object" && Object.keys(details).length === 0)) {
    return <p className="p-3 text-sm text-muted-foreground">No additional details recorded.</p>;
  }
  return (
    <div className="grid gap-3 rounded-xl bg-muted/40 p-3 sm:grid-cols-2">
      {Object.entries(details).map(([key, value]) => (
        <div key={key} className="rounded-xl border bg-card p-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{prettyKey(key)}</div>
          <AuditValue value={value} />
        </div>
      ))}
    </div>
  );
}

function AuditValue({ value }: { value: any }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-sm text-muted-foreground">Not available</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-sm text-muted-foreground">None</span>;
    return (
      <div className="grid gap-1 text-sm">
        {value.map((item, index) => <div key={index} className="rounded bg-muted/50 p-2">{formatValue(item)}</div>)}
      </div>
    );
  }
  if (typeof value === "object") {
    return (
      <div className="grid gap-2">
        {Object.entries(value).map(([key, nested]) => (
          <div key={key} className="rounded bg-muted/50 p-2">
            <div className="text-xs text-muted-foreground">{prettyKey(key)}</div>
            <div className="text-sm leading-relaxed">{formatValue(nested)}</div>
          </div>
        ))}
      </div>
    );
  }
  return <span className="text-sm leading-relaxed">{String(value)}</span>;
}

function formatValue(value: any): string {
  if (value === null || value === undefined || value === "") return "Not available";
  if (Array.isArray(value)) return value.map(formatValue).join("; ");
  if (typeof value === "object") return Object.entries(value).map(([key, nested]) => `${prettyKey(key)}: ${formatValue(nested)}`).join("; ");
  return String(value);
}

function uniqueValues(items: any[], key: string) {
  return Array.from(new Set(items.map((item) => item[key]).filter(Boolean))).sort();
}

function prettyKey(key: string) {
  return String(key)
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
