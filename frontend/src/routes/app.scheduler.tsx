import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageContainer, PageHeader, ErrorBox, LoadingSkeleton } from "@/components/page-parts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PlayCircle, Save, Clock } from "lucide-react";

export const Route = createFileRoute("/app/scheduler")({ component: SchedulerPage });

const DAYS = [
  ["MON", "Monday"],
  ["TUE", "Tuesday"],
  ["WED", "Wednesday"],
  ["THU", "Thursday"],
  ["FRI", "Friday"],
];

const TIMES = [
  ["9", "9:00 AM"],
  ["12", "12:00 PM"],
  ["17", "5:00 PM"],
];

function SchedulerPage() {
  const qc = useQueryClient();
  const status = useQuery<any>({ queryKey: ["scheduler-status"], queryFn: () => api("/scheduler/status") });
  const [day, setDay] = useState("MON");
  const [hour, setHour] = useState("9");
  const cron = `0 ${hour} * * ${day}`;

  useEffect(() => {
    if (status.data?.cron) {
      const parsed = parseWeeklyCron(status.data.cron);
      if (parsed) {
        setHour(parsed.hour);
        setDay(parsed.day);
      }
    }
  }, [status.data?.cron]);

  const updateCron = useMutation({
    mutationFn: () => api("/scheduler/config", { method: "PUT", body: JSON.stringify({ cron }) }),
    onSuccess: () => {
      toast.success("Schedule updated");
      qc.invalidateQueries({ queryKey: ["scheduler-status"] });
      qc.invalidateQueries({ queryKey: ["audit-log"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const runNow = useMutation({
    mutationFn: () => api("/scheduler/run-all-now", { method: "POST" }),
    onSuccess: () => {
      toast.success("Portfolio analysis completed");
      qc.invalidateQueries({ queryKey: ["scheduler-status"] });
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
      <PageHeader
        title="Scheduler"
        description="Run portfolio scoring on demand or on a weekly timetable."
        actions={<Button onClick={() => runNow.mutate()} disabled={runNow.isPending} className="gradient-brand text-white border-0"><PlayCircle className="h-4 w-4 mr-2" /> {runNow.isPending ? "Running..." : "Run portfolio analysis"}</Button>}
      />

      {status.error && <ErrorBox error={status.error} />}
      {status.isLoading && <LoadingSkeleton />}

      {status.data && (
        <div className="grid gap-4">
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatusTile label="Status" value={status.data.running ? "Running" : "Idle"} badge={status.data.running ? "Active" : "Ready"} />
            <StatusTile label="Next Run" value={formatDateTime(status.data.next_run_time)} />
            <StatusTile label="Last Run" value={formatDateTime(status.data.last_run_time)} />
            <StatusTile label="Last Result" value={formatRunResult(status.data.last_run_result)} />
          </div>

          <Card className="p-5">
            <h3 className="font-semibold mb-1">Weekly schedule</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Choose a day and time. PulsePoint will convert it into the backend schedule automatically.
            </p>
            <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
              <div>
                <Label>Run every</Label>
                <Select value={day} onValueChange={setDay}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAYS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>At</Label>
                <Select value={hour} onValueChange={setHour}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIMES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => updateCron.mutate()} disabled={updateCron.isPending}>
                <Save className="h-4 w-4 mr-2" /> {updateCron.isPending ? "Saving..." : "Save schedule"}
              </Button>
            </div>
            <div className="mt-4 rounded-md bg-muted p-3 text-sm">
              Current backend schedule: <b>{humanCron(cron)}</b>
              <span className="text-muted-foreground"> ({cron})</span>
            </div>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}

function StatusTile({ label, value, badge }: { label: string; value: string; badge?: string }) {
  return (
    <Card className="p-4 min-h-32">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs uppercase text-muted-foreground">{label}</span>
        {badge && <Badge variant="outline">{badge}</Badge>}
        {!badge && <Clock className="h-4 w-4 text-[var(--brand-2)]" />}
      </div>
      <div className="mt-3 text-lg font-semibold break-words leading-snug">{value}</div>
    </Card>
  );
}

function parseWeeklyCron(value: string) {
  const parts = value.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  return { hour: parts[1], day: parts[4].toUpperCase() };
}

function humanCron(value: string) {
  const parsed = parseWeeklyCron(value);
  if (!parsed) return value;
  const day = DAYS.find(([key]) => key === parsed.day)?.[1] || parsed.day;
  const time = TIMES.find(([key]) => key === parsed.hour)?.[1] || `${parsed.hour}:00`;
  return `Every ${day} at ${time}`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not scheduled yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function formatRunResult(value: any) {
  if (!value) return "No run yet";
  if (typeof value === "string") return value;
  const attempted = value.attempted ?? value.projects_attempted;
  const analyzed = value.analyzed ?? value.projects_analyzed;
  if (attempted !== undefined || analyzed !== undefined) return `${analyzed ?? 0} analyzed from ${attempted ?? 0} attempted`;
  return Object.entries(value).map(([key, item]) => `${label(key)}: ${item}`).join(", ");
}

function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
