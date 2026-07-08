import { Card } from "@/components/ui/card";
import { ReactNode } from "react";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight truncate">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, icon: Icon, tone }: {
  label: string; value: ReactNode; hint?: string; icon?: any; tone?: "green" | "amber" | "red" | "brand";
}) {
  const toneClass = tone === "green" ? "text-[var(--rag-green)]" :
    tone === "amber" ? "text-[var(--rag-amber)]" :
    tone === "red" ? "text-[var(--rag-red)]" :
    tone === "brand" ? "text-[var(--brand-2)]" : "text-foreground";
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        {Icon && <Icon className={`h-4 w-4 ${toneClass}`} />}
      </div>
      <div className={`mt-2 text-3xl font-bold ${toneClass}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    <Card className="p-4 border-destructive/40 bg-destructive/10 text-destructive text-sm">
      <div className="font-semibold">Request failed</div>
      <div className="mt-1 opacity-90 break-words">{msg}</div>
    </Card>
  );
}

export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 rounded-lg bg-muted/50 animate-pulse" />
      ))}
    </div>
  );
}

export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">{children}</div>;
}
