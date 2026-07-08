import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Activity, BarChart3, FileSpreadsheet, LineChart, Presentation, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";

const search = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/login")({
  validateSearch: search,
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const { redirect } = useSearch({ from: "/login" });
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      toast.success("Welcome back!");
      nav({ to: redirect || "/app/dashboard" });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return <AuthShell title="Welcome back" subtitle="Sign in to your PulsePoint AI workspace">
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5" />
      </div>
      <Button type="submit" disabled={busy} className="w-full gradient-brand text-white border-0">
        {busy ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-sm text-center text-muted-foreground">
        No account? <Link to="/signup" className="text-[var(--brand-2)] hover:underline">Sign up</Link>
      </p>
    </form>
  </AuthShell>;
}

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="auth-brand-panel hidden md:flex flex-col justify-between p-10 text-white relative overflow-hidden">
        <Link to="/" className="auth-logo-on-brand relative z-10"><Logo showText /></Link>
        <AuthVisual />
        <div className="relative text-sm opacity-80">© 2026 PulsePoint AI</div>
      </div>
      <div className="flex flex-col">
        <div className="flex justify-between p-4">
          <Link to="/" className="md:hidden"><Logo /></Link>
          <div className="ml-auto flex gap-2">
            <Button asChild variant="ghost" size="sm"><Link to="/">Back home</Link></Button>
            <ThemeToggle />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="w-full max-w-md p-8">
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-muted-foreground text-sm mt-1 mb-6">{subtitle}</p>
            {children}
          </Card>
        </div>
      </div>
    </div>
  );
}

function AuthVisual() {
  const steps = [
    { label: "Plan file", icon: FileSpreadsheet },
    { label: "Scoring", icon: Activity },
    { label: "Insight", icon: TrendingUp },
    { label: "Deck", icon: Presentation },
  ];

  return (
    <div className="auth-visual relative z-10">
      <div className="auth-orbit-card auth-orbit-left">
        <FileSpreadsheet className="h-5 w-5" />
        <span>Workbook</span>
      </div>
      <div className="auth-orbit-card auth-orbit-right">
        <Presentation className="h-5 w-5" />
        <span>Client deck</span>
      </div>

      <div className="auth-cockpit">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-cyan-100/80">
              <Sparkles className="h-3.5 w-3.5" />
              Executive cockpit
            </div>
            <div className="mt-2 text-xl font-bold">Portfolio health</div>
          </div>
          <div className="auth-score-dial">
            <span>82</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {steps.map((step) => (
            <div key={step.label} className="auth-process-chip">
              <step.icon className="h-4 w-4" />
              <span>{step.label}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-[1.15fr_0.85fr] gap-3">
          <div className="auth-chart-panel">
            <div className="flex items-center justify-between text-xs text-cyan-50/70">
              <span>Trend confidence</span>
              <LineChart className="h-4 w-4" />
            </div>
            <svg viewBox="0 0 280 92" className="mt-2 h-16 w-full overflow-visible">
              <defs>
                <linearGradient id="authLine" x1="0" x2="1">
                  <stop offset="0" stopColor="#a7f3d0" />
                  <stop offset="1" stopColor="#67e8f9" />
                </linearGradient>
              </defs>
              <path d="M8 70 C42 58 52 34 82 42 S126 78 156 50 202 24 232 36 256 58 274 30" fill="none" stroke="url(#authLine)" strokeWidth="5" strokeLinecap="round" />
              <path d="M8 70 C42 58 52 34 82 42 S126 78 156 50 202 24 232 36 256 58 274 30 L274 90 L8 90 Z" fill="rgba(103, 232, 249, 0.13)" />
            </svg>
          </div>
          <div className="auth-risk-panel">
            <div className="flex items-center justify-between text-xs text-cyan-50/70">
              <span>RAG mix</span>
              <BarChart3 className="h-4 w-4" />
            </div>
            <div className="mt-4 space-y-2.5">
              <div className="auth-bar bg-emerald-300/25"><span className="w-[74%] bg-emerald-300" /></div>
              <div className="auth-bar bg-amber-300/25"><span className="w-[42%] bg-amber-300" /></div>
              <div className="auth-bar bg-red-300/25"><span className="w-[24%] bg-red-300" /></div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="auth-rag-pill bg-emerald-300/18 text-emerald-100">Green</div>
          <div className="auth-rag-pill bg-amber-300/18 text-amber-100">Amber</div>
          <div className="auth-rag-pill bg-red-300/18 text-red-100">Red</div>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-sm text-cyan-50/85">
          <span>Boardroom-ready recommendations generated</span>
          <ShieldCheck className="h-5 w-5 text-emerald-200" />
        </div>
      </div>
    </div>
  );
}
