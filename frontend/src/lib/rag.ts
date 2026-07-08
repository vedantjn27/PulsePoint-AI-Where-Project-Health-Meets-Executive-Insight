export function ragColor(status?: string) {
  const s = (status || "").toLowerCase();
  if (s === "green") return "var(--rag-green)";
  if (s === "amber") return "var(--rag-amber)";
  if (s === "red") return "var(--rag-red)";
  return "var(--muted-foreground)";
}
export function ragBadgeClass(status?: string) {
  const s = (status || "").toLowerCase();
  if (s === "green") return "bg-[var(--rag-green)]/15 text-[var(--rag-green)] border-[var(--rag-green)]/30";
  if (s === "amber") return "bg-[var(--rag-amber)]/15 text-[var(--rag-amber)] border-[var(--rag-amber)]/30";
  if (s === "red") return "bg-[var(--rag-red)]/15 text-[var(--rag-red)] border-[var(--rag-red)]/30";
  return "bg-muted text-muted-foreground border-border";
}
