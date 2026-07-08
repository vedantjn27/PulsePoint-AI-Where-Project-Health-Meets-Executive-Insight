import { createFileRoute, Link, Outlet, useLocation, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  LayoutDashboard, FolderKanban, CalendarClock, MessageSquare, FileText,
  Bell, Sliders, Timer, ScrollText, Database, HeartPulse, LogOut, Home, Menu,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

const NAV = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/projects", label: "Projects", icon: FolderKanban },
  { to: "/app/synthesis", label: "Monthly Synthesis", icon: CalendarClock },
  { to: "/app/ask", label: "Ask Agent", icon: MessageSquare },
  { to: "/app/reports", label: "Reports & Exports", icon: FileText },
  { to: "/app/alerts", label: "Alerts", icon: Bell },
  { to: "/app/scoring-config", label: "Scoring Config", icon: Sliders },
  { to: "/app/scheduler", label: "Scheduler", icon: Timer },
  { to: "/app/audit-log", label: "Audit Log", icon: ScrollText },
  { to: "/app/demo", label: "Demo Data", icon: Database },
  { to: "/app/health", label: "System Health", icon: HeartPulse },
];

function AppLayout() {
  const { isAuthenticated, ready, user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (ready && !isAuthenticated) {
      nav({ to: "/login", search: { redirect: loc.pathname } });
    }
  }, [ready, isAuthenticated, nav, loc.pathname]);

  if (!ready || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading workspace…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar */}
      {sidebarOpen && (
        <aside className="hidden lg:flex w-72 flex-col border-r bg-card/60 backdrop-blur sticky top-0 h-screen">
          <div className="p-5 flex items-center justify-between gap-3">
            <Link to="/"><Logo size={52} /></Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(false)}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </div>
          <ScrollArea className="flex-1 px-2">
            <SidebarNav />
          </ScrollArea>
          <div className="p-3 border-t">
            <Button asChild variant="ghost" size="sm" className="w-full justify-start">
              <Link to="/"><Home className="h-4 w-4 mr-2" /> Back to Home</Link>
            </Button>
          </div>
        </aside>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b flex items-center gap-2 px-4 sticky top-0 bg-background/80 backdrop-blur z-40">
          {!sidebarOpen && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              className="hidden lg:inline-flex"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          )}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden"><Menu className="h-5 w-5" /></Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72">
              <div className="p-5"><Logo size={52} /></div>
              <ScrollArea className="h-[calc(100vh-8rem)] px-2"><SidebarNav /></ScrollArea>
              <div className="p-3 border-t">
                <Button asChild variant="ghost" size="sm" className="w-full justify-start">
                  <Link to="/"><Home className="h-4 w-4 mr-2" /> Home</Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          <div className="lg:hidden"><Logo size={38} showText={false} /></div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Avatar className="h-7 w-7"><AvatarFallback className="text-xs gradient-brand text-white">{user?.name?.[0]?.toUpperCase() || "U"}</AvatarFallback></Avatar>
                  <span className="hidden sm:inline text-sm">{user?.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled>{user?.email}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link to="/">Home page</Link></DropdownMenuItem>
                <DropdownMenuItem onClick={() => { logout(); nav({ to: "/" }); }}>
                  <LogOut className="h-4 w-4 mr-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 min-w-0"><Outlet /></main>
      </div>
    </div>
  );
}

function SidebarNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="py-2 space-y-0.5">
      {NAV.map((item) => {
        const active = path === item.to || path.startsWith(item.to + "/");
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
              active ? "gradient-brand text-white shadow-md" : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
