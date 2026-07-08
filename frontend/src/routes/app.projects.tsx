import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Project } from "@/lib/api";
import { PageContainer, PageHeader, ErrorBox, LoadingSkeleton } from "@/components/page-parts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useState } from "react";
import { Plus, Trash2, ArrowRight } from "lucide-react";
import { ragBadgeClass } from "@/lib/rag";
import { toast } from "sonner";

export const Route = createFileRoute("/app/projects")({
  component: ProjectsPage,
});

function ProjectsPage() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: () => api("/projects"),
  });
  const [open, setOpen] = useState(false);

  const del = useMutation({
    mutationFn: (id: string) => api(`/projects/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast.success("Project deleted"); qc.invalidateQueries({ queryKey: ["projects"] }); qc.invalidateQueries({ queryKey: ["dashboard-summary"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (path !== "/app/projects") {
    return <Outlet />;
  }

  return (
    <PageContainer>
      <PageHeader
        title="Projects"
        description="Manage projects and open project-level workflows."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-brand text-white border-0"><Plus className="h-4 w-4 mr-1" /> New project</Button>
            </DialogTrigger>
            <CreateProjectDialog onClose={() => setOpen(false)} />
          </Dialog>
        }
      />
      {error && <ErrorBox error={error} />}
      {isLoading && <LoadingSkeleton rows={4} />}
      {data && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((p) => (
            <Card key={p.id} className="p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{p.name}</h3>
                  <p className="text-xs text-muted-foreground truncate">{p.client_name || "—"}</p>
                </div>
                {p.latest_health ? (
                  <Badge variant="outline" className={ragBadgeClass(p.latest_health.rag_status)}>{p.latest_health.rag_status}</Badge>
                ) : (
                  <Badge variant="outline">Not analyzed</Badge>
                )}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div><div>PM</div><div className="text-foreground">{p.pm_name || "—"}</div></div>
                <div><div>Budget</div><div className="text-foreground">{p.budget_total ? `$${p.budget_total.toLocaleString()}` : "—"}</div></div>
                {p.latest_health && (
                  <>
                    <div><div>Score</div><div className="text-foreground">{p.latest_health.composite_score.toFixed(1)}</div></div>
                    <div><div>Confidence</div><div className="text-foreground">{Math.round(p.latest_health.data_confidence * 100)}%</div></div>
                  </>
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <Button asChild size="sm" className="flex-1">
                  <Link to="/app/projects/$projectId" params={{ projectId: p.id }}>Open <ArrowRight className="h-3.5 w-3.5 ml-1" /></Link>
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="ghost" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {p.name}?</AlertDialogTitle>
                      <AlertDialogDescription>This cannot be undone. All snapshots will be lost.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => del.mutate(p.id)}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </Card>
          ))}
          {data.length === 0 && (
            <Card className="p-8 col-span-full text-center text-muted-foreground">
              No projects yet. Create one, or seed sample data from{" "}
              <Link to="/app/demo" className="text-[var(--brand-2)] underline">Demo Data</Link>.
            </Card>
          )}
        </div>
      )}
    </PageContainer>
  );
}

function CreateProjectDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    id: "", name: "", client_name: "", pm_name: "",
    start_date: "", planned_end_date: "", budget_total: "",
  });
  const create = useMutation({
    mutationFn: () => api("/projects", {
      method: "POST",
      body: JSON.stringify({
        ...(form.id ? { id: form.id } : {}),
        name: form.name,
        client_name: form.client_name || undefined,
        pm_name: form.pm_name || undefined,
        start_date: form.start_date || undefined,
        planned_end_date: form.planned_end_date || undefined,
        budget_total: form.budget_total ? Number(form.budget_total) : undefined,
      }),
    }),
    onSuccess: () => {
      toast.success("Project created");
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>Create project</DialogTitle></DialogHeader>
      <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-3">
        <div><Label>Name *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Project ID (optional)</Label><Input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} placeholder="auto" /></div>
          <div><Label>Client</Label><Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} /></div>
        </div>
        <div><Label>PM name</Label><Input value={form.pm_name} onChange={(e) => setForm({ ...form, pm_name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Start</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
          <div><Label>Planned end</Label><Input type="date" value={form.planned_end_date} onChange={(e) => setForm({ ...form, planned_end_date: e.target.value })} /></div>
        </div>
        <div><Label>Budget total</Label><Input type="number" value={form.budget_total} onChange={(e) => setForm({ ...form, budget_total: e.target.value })} /></div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={create.isPending} className="gradient-brand text-white border-0">
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
