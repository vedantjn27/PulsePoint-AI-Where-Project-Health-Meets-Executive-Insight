import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Activity, Brain, FileBarChart, Gauge, LineChart, ShieldCheck, Sparkles, Zap, ArrowRight, Bot, Users, ClipboardList, Layers } from "lucide-react";
import projectHealthHero from "@/assets/project-health-hero.png";
import feat1 from "@/assets/feature-insight.jpg";
import feat2 from "@/assets/feature-pulse.jpg";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PulsePoint AI — Where project health meets executive insight" },
      { name: "description", content: "Deterministic project health scoring, agentic reasoning, executive decks and portfolio insight — all in one platform." },
    ],
  }),
  component: BrandingPage,
});

function BrandingPage() {
  const { isAuthenticated } = useAuth();
  return (
    <div className="brand-page min-h-screen bg-background text-foreground overflow-hidden">
      {/* NAV */}
      <header className="fixed top-0 inset-x-0 z-50 glass">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <Logo />
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition">Features</a>
            <a href="#how" className="hover:text-foreground transition">How it works</a>
            <a href="#capabilities" className="hover:text-foreground transition">Capabilities</a>
            <a href="#demo" className="hover:text-foreground transition">Demo</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {isAuthenticated ? (
              <Button asChild size="sm"><Link to="/app/dashboard">Open App</Link></Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm"><Link to="/login">Log in</Link></Button>
                <Button asChild size="sm" className="gradient-brand text-white border-0">
                  <Link to="/signup">Get started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* HERO */}
      <section
        className="brand-hero relative pt-32 pb-24 px-4 sm:px-6"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(3, 7, 18, 0.78) 0%, rgba(3, 7, 18, 0.72) 46%, rgba(3, 7, 18, 0.94) 100%), url(${projectHealthHero})`,
        }}
      >
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse at 50% 16%, rgba(14, 165, 233, 0.18), transparent 52%)",
          }}
        />
        <div className="mx-auto max-w-6xl text-center animate-fade-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-slate-950/45 px-4 py-1.5 text-xs mb-6 backdrop-blur-xl">
            <Sparkles className="h-3.5 w-3.5 text-[var(--brand-2)]" />
            <span className="text-slate-200">Smart Project Health Monitoring</span>
          </div>
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.05] text-white">
            Where project health
            <br />
            meets <span className="text-gradient">executive insight</span>
          </h1>
          <p className="mt-6 max-w-2xl mx-auto text-lg text-slate-300">
            PulsePoint AI ingests plan files, scores portfolio health deterministically,
            and explains every number with an agentic reasoning trace.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="gradient-brand text-white border-0">
              <Link to={isAuthenticated ? "/app/dashboard" : "/signup"}>
                {isAuthenticated ? "Enter Dashboard" : "Start free"} <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#features">Explore features</a>
            </Button>
          </div>

          {/* Animated pulse waveform */}
          <div className="mt-16 mx-auto max-w-4xl relative">
            <div className="rounded-2xl border border-white/10 bg-slate-950/58 p-6 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center gap-2 mb-3 text-xs text-slate-300">
                <span className="h-2 w-2 rounded-full bg-[var(--rag-red)] animate-pulse-glow" />
                <span className="h-2 w-2 rounded-full bg-[var(--rag-amber)] animate-pulse-glow" />
                <span className="h-2 w-2 rounded-full bg-[var(--rag-green)] animate-pulse-glow" />
                <span className="ml-2">Live portfolio pulse</span>
              </div>
              <svg viewBox="0 0 800 120" className="w-full h-24">
                <defs>
                  <linearGradient id="pulseGrad" x1="0" x2="1">
                    <stop offset="0" stopColor="var(--brand)" />
                    <stop offset="1" stopColor="var(--brand-2)" />
                  </linearGradient>
                </defs>
                <path
                  d="M0 60 L100 60 L120 60 L140 20 L160 100 L180 60 L280 60 L300 60 L320 30 L340 90 L360 60 L500 60 L520 40 L540 80 L560 60 L800 60"
                  fill="none"
                  stroke="url(#pulseGrad)"
                  strokeWidth="2.5"
                  className="animate-pulse-glow"
                  style={{ filter: "drop-shadow(0 0 8px var(--brand))" }}
                />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* METRICS STRIP */}
      <section className="brand-ambient-section px-4 sm:px-6 py-16">
        <div className="mx-auto max-w-6xl grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Deterministic scoring", value: "100%", icon: Gauge },
            { label: "Signals analyzed", value: "5+", icon: Activity },
            { label: "Reasoning traceable", value: "Every step", icon: Brain },
            { label: "Export formats", value: "MD / PDF / PPTX", icon: FileBarChart },
          ].map((m) => (
            <Card key={m.label} className="p-5 glass border-0">
              <m.icon className="h-5 w-5 text-[var(--brand-2)]" />
              <div className="mt-3 text-2xl font-bold">{m.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{m.label}</div>
            </Card>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="brand-ambient-section px-4 sm:px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <div className="text-xs uppercase tracking-widest text-[var(--brand-2)]">Features</div>
            <h2 className="mt-2 text-4xl md:text-5xl font-bold">Not a black box.</h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Every RAG status, every score, every risk — auditable, versioned, and explainable.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <FeatureCard
              icon={Gauge}
              title="Deterministic RAG scoring"
              desc="Five signals — schedule, budget, milestones, blockers, sentiment — combined with weighted math you configure. Not vibes."
            />
            <FeatureCard
              icon={Brain}
              title="Agentic reasoning trace"
              desc="An LLM agent explains the score with a step-by-step trace. It never overrides the number — only illuminates it."
            />
            <FeatureCard
              icon={LineChart}
              title="Scenario simulator"
              desc="What if budget dropped 15%? See composite score and RAG shift instantly — without persisting anything."
            />
            <FeatureCard
              icon={FileBarChart}
              title="Executive deck generation"
              desc="One click generates a branded PowerPoint portfolio review with your client colors and logo."
            />
            <FeatureCard
              icon={ShieldCheck}
              title="Full audit log"
              desc="Every analyze, export, seed, and config change is timestamped and inspectable."
            />
            <FeatureCard
              icon={Zap}
              title="Auto-scheduled runs"
              desc="Configure a cron. PulsePoint scores your entire portfolio weekly and raises alerts."
            />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section
        id="how"
        className="brand-flow-section px-4 sm:px-6 py-24"
        style={{
          backgroundImage: `linear-gradient(90deg, color-mix(in oklab, var(--background) 94%, transparent) 0%, color-mix(in oklab, var(--background) 82%, transparent) 48%, color-mix(in oklab, var(--background) 96%, transparent) 100%), url(${projectHealthHero})`,
        }}
      >
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <div className="text-xs uppercase tracking-widest text-[var(--brand-2)]">Flow</div>
            <h2 className="mt-2 text-4xl md:text-5xl font-bold">From plan file to boardroom</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { n: "01", t: "Ingest", d: "Upload JSON, CSV or XLSX plans. We normalize + surface warnings.", icon: ClipboardList },
              { n: "02", t: "Score", d: "Deterministic scoring across five signals with configurable weights.", icon: Gauge },
              { n: "03", t: "Explain", d: "Agent generates narrative, risks, actions and reasoning trace.", icon: Bot },
              { n: "04", t: "Ship", d: "Export weekly PDF, monthly synthesis, branded exec deck.", icon: Layers },
            ].map((s, i) => (
              <div key={s.n} className="relative animate-fade-up" style={{ animationDelay: `${i * 100}ms` }}>
                <Card className="p-6 h-full glass border-0 hover:scale-[1.02] transition-transform">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-[var(--brand-2)]">{s.n}</span>
                    <s.icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <h3 className="mt-4 font-semibold">{s.t}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CAPABILITIES SPLIT */}
      <section id="capabilities" className="brand-ambient-section px-4 sm:px-6 py-24">
        <div className="mx-auto max-w-6xl grid md:grid-cols-2 gap-12 items-center">
          <div className="animate-fade-up">
            <div className="text-xs uppercase tracking-widest text-[var(--brand-2)]">Portfolio agent</div>
            <h2 className="mt-2 text-4xl font-bold">Ask anything. Get grounded answers.</h2>
            <p className="mt-4 text-muted-foreground">
              "Which project is most at risk and why?" "What changed since last week?"
              PulsePoint's portfolio agent answers with reasoning trace and citations to
              live snapshot data — never hallucinated.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {["Grounded in real snapshot data", "Reasoning trace on every answer", "LLM provider transparently displayed", "Portfolio-wide context"].map((x) => (
                <li key={x} className="flex gap-2"><Sparkles className="h-4 w-4 text-[var(--brand-2)] mt-0.5" /> {x}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl overflow-hidden glass p-2 animate-float">
            <img src={feat1} alt="Executives reviewing analytics" width={1400} height={900} loading="lazy" className="rounded-xl w-full h-auto" />
          </div>
        </div>

        <div className="mx-auto max-w-6xl grid md:grid-cols-2 gap-12 items-center mt-24">
          <div className="rounded-2xl overflow-hidden glass p-2 order-2 md:order-1 animate-float">
            <img src={feat2} alt="Pulse waveform to bars" width={1400} height={900} loading="lazy" className="rounded-xl w-full h-auto" />
          </div>
          <div className="order-1 md:order-2 animate-fade-up">
            <div className="text-xs uppercase tracking-widest text-[var(--brand-2)]">Confidence-aware</div>
            <h2 className="mt-2 text-4xl font-bold">Data confidence, not fake precision.</h2>
            <p className="mt-4 text-muted-foreground">
              When signals are missing, PulsePoint reweights transparently and reports lower
              data confidence — so executives never mistake a partial view for a full one.
            </p>
          </div>
        </div>
      </section>

      {/* DEMO CTA */}
      <section id="demo" className="brand-ambient-section px-4 sm:px-6 py-24">
        <div className="brand-cta-panel mx-auto max-w-4xl text-center rounded-3xl gradient-brand p-12 text-white shadow-2xl">
          <Users className="h-10 w-10 mx-auto opacity-90" />
          <h2 className="mt-4 text-3xl md:text-4xl font-bold">See it on your portfolio.</h2>
          <p className="mt-3 opacity-90 max-w-xl mx-auto">
            Sample workbook data auto-loads on first run. No setup required.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" variant="secondary">
              <Link to={isAuthenticated ? "/app/dashboard" : "/signup"}>
                {isAuthenticated ? "Open Dashboard" : "Create account"}
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="text-white hover:bg-white/10 hover:text-white">
              <Link to="/login">I have an account</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t px-4 sm:px-6 py-8">
        <div className="mx-auto max-w-6xl flex flex-wrap justify-between gap-4 text-sm text-muted-foreground">
          <Logo />
          <div>© 2026 PulsePoint AI. Where project health meets executive insight.</div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <Card className="p-6 glass border-0 hover:shadow-xl hover:-translate-y-1 transition-all">
      <div className="h-10 w-10 rounded-lg gradient-brand grid place-items-center text-white">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 font-semibold text-lg">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
    </Card>
  );
}
