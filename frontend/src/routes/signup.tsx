import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { AuthShell } from "./login";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const nav = useNavigate();
  const { signup } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    setBusy(true);
    try {
      await signup(name, email, password);
      toast.success("Account created");
      nav({ to: "/app/dashboard" });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return <AuthShell title="Create your account" subtitle="Get started with PulsePoint AI in seconds">
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="name">Full name</Label>
        <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5" />
      </div>
      <Button type="submit" disabled={busy} className="w-full gradient-brand text-white border-0">
        {busy ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-sm text-center text-muted-foreground">
        Already have an account? <Link to="/login" className="text-[var(--brand-2)] hover:underline">Sign in</Link>
      </p>
    </form>
  </AuthShell>;
}
