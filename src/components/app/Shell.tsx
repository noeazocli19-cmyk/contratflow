"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useStore, ViewKey } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  FileText,
  FileSpreadsheet,
  PenTool,
  FolderKanban,
  Receipt,
  CreditCard,
  FolderArchive,
  BarChart3,
  Bell,
  Settings as SettingsIcon,
  Menu,
  ChevronDown,
  LogOut,
  Search,
  Sparkles,
  LayoutTemplate,
  ScrollText,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { initials } from "@/lib/format";

type NavItem = {
  key: ViewKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
};

const NAV: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Pilotage" },
  { key: "prospects", label: "Prospects", icon: UserPlus, group: "Vente" },
  { key: "clients", label: "Clients", icon: Users, group: "Vente" },
  { key: "proposals", label: "Propositions", icon: FileText, group: "Vente" },
  { key: "quotes", label: "Devis", icon: FileSpreadsheet, group: "Vente" },
  { key: "contracts", label: "Contrats", icon: PenTool, group: "Vente" },
  { key: "projects", label: "Projets", icon: FolderKanban, group: "Exécution" },
  { key: "invoices", label: "Factures", icon: Receipt, group: "Finance" },
  { key: "payments", label: "Paiements", icon: CreditCard, group: "Finance" },
  { key: "documents", label: "Documents", icon: FolderArchive, group: "Finance" },
  { key: "reports", label: "Rapports", icon: BarChart3, group: "Pilotage" },
  { key: "templates", label: "Modèles", icon: LayoutTemplate, group: "Pilotage" },
  { key: "audit", label: "Journal", icon: ScrollText, group: "Pilotage" },
];

const NAV_GROUPS = ["Pilotage", "Vente", "Exécution", "Finance"];

export default function Shell({ children }: { children: React.ReactNode }) {
  const { user, org, view, navigate, sidebarOpen, setSidebarOpen, logout } = useStore();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    fetch("/api/notifications?count=true")
      .then((r) => r.json())
      .then((d) => setNotifCount(d.count ?? 0))
      .catch(() => {});
  }, [view]);

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center gap-2 px-4 border-b border-sidebar-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">
          CF
        </div>
        <div className="font-semibold leading-tight">
          <div className="text-sm">ContractFlow</div>
          <div className="text-[11px] text-sidebar-foreground/70 truncate max-w-[160px]">
            {org?.name || "Organisation"}
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {NAV_GROUPS.map((group) => (
          <div key={group}>
            <div className="px-2 mb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
              {group}
            </div>
            <div className="space-y-0.5">
              {NAV.filter((n) => n.group === group).map((item) => {
                const Icon = item.icon;
                const active = view === item.key || view === `${item.key}-detail`;
                return (
                  <button
                    key={item.key}
                    onClick={() => navigate(item.key)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors text-left",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-2 space-y-0.5">
        <button
          onClick={() => navigate("notifications")}
          className={cn(
            "w-full flex items-center gap-3 rounded-md px-2.5 py-2 text-sm",
            view === "notifications"
              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
              : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50",
          )}
        >
          <Bell className="h-4 w-4" />
          Notifications
          {notifCount > 0 && (
            <Badge className="ml-auto h-5 min-w-5 px-1.5 text-[10px] bg-rose-500 text-white">
              {notifCount}
            </Badge>
          )}
        </button>
        <button
          onClick={() => navigate("settings")}
          className={cn(
            "w-full flex items-center gap-3 rounded-md px-2.5 py-2 text-sm",
            view === "settings"
              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
              : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50",
          )}
        >
          <SettingsIcon className="h-4 w-4" />
          Paramètres
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
        {sidebar}
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-72 p-0">
          {sidebar}
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 flex-col md:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 backdrop-blur px-4">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <h1 className="text-base font-semibold capitalize hidden sm:block">
            {view.replace(/-/g, " ")}
          </h1>

          <div className="ml-auto flex items-center gap-2">
            <GlobalSearch />

            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("notifications")}
              className="relative"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {notifCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center">
                  {notifCount > 9 ? "9+" : notifCount}
                </span>
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {user ? initials(user.name) : "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:block text-left">
                    <div className="text-xs font-medium leading-tight">{user?.name}</div>
                    <div className="text-[10px] text-muted-foreground leading-tight">
                      {user?.role === "OWNER" ? "Propriétaire" : user?.role}
                    </div>
                  </div>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="font-medium">{user?.name}</div>
                  <div className="text-xs text-muted-foreground font-normal">{user?.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("settings")}>
                  <SettingsIcon className="h-4 w-4 mr-2" /> Paramètres
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("reports")}>
                  <BarChart3 className="h-4 w-4 mr-2" /> Rapports
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-rose-600" onClick={logout}>
                  <LogOut className="h-4 w-4 mr-2" /> Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 flex flex-col">{children}</main>

        <footer className="border-t bg-background px-4 py-3 text-xs text-muted-foreground flex flex-wrap items-center gap-2">
          <span>ContractFlow</span>
          <span className="text-muted-foreground/40">·</span>
          <span>De la proposition au paiement</span>
          {org?.name && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span>{org.name}</span>
            </>
          )}
          <span className="ml-auto inline-flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Plan {org ? "PRO" : ""}
          </span>
        </footer>
      </div>
    </div>
  );
}

function GlobalSearch() {
  const navigate = useStore((s) => s.navigate);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<null | {
    clients: { id: string; name: string }[];
    prospects: { id: string; name: string }[];
    invoices: { id: string; number: string; clientId: string }[];
    contracts: { id: string; number: string }[];
    proposals: { id: string; number: string }[];
    projects: { id: string; name: string }[];
  }>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!q.trim()) {
        setResults(null);
        return;
      }
      fetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => setResults(d))
        .catch(() => setResults(null));
    }, 150);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="relative hidden sm:block">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Rechercher…"
          className="w-56 pl-8 h-8 text-sm"
        />
      </div>
      {open && results && (
        <div className="absolute top-10 right-0 w-80 bg-popover border rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
          {results.clients.length === 0 &&
          results.prospects.length === 0 &&
          results.invoices.length === 0 &&
          results.contracts.length === 0 &&
          results.proposals.length === 0 &&
          results.projects.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">Aucun résultat.</div>
          ) : (
            <div className="p-1">
              {results.clients.length > 0 && (
                <Section title="Clients">
                  {results.clients.map((c) => (
                    <ResultItem
                      key={c.id}
                      label={c.name}
                      onClick={() => {
                        navigate("client-detail", { id: c.id });
                        setOpen(false);
                        setQ("");
                      }}
                    />
                  ))}
                </Section>
              )}
              {results.prospects.length > 0 && (
                <Section title="Prospects">
                  {results.prospects.map((p) => (
                    <ResultItem
                      key={p.id}
                      label={p.name}
                      onClick={() => {
                        navigate("prospects", { id: p.id });
                        setOpen(false);
                        setQ("");
                      }}
                    />
                  ))}
                </Section>
              )}
              {results.invoices.length > 0 && (
                <Section title="Factures">
                  {results.invoices.map((i) => (
                    <ResultItem
                      key={i.id}
                      label={i.number}
                      onClick={() => {
                        navigate("invoice-detail", { id: i.id });
                        setOpen(false);
                        setQ("");
                      }}
                    />
                  ))}
                </Section>
              )}
              {results.contracts.length > 0 && (
                <Section title="Contrats">
                  {results.contracts.map((c) => (
                    <ResultItem
                      key={c.id}
                      label={c.number}
                      onClick={() => {
                        navigate("contract-detail", { id: c.id });
                        setOpen(false);
                        setQ("");
                      }}
                    />
                  ))}
                </Section>
              )}
              {results.proposals.length > 0 && (
                <Section title="Propositions">
                  {results.proposals.map((p) => (
                    <ResultItem
                      key={p.id}
                      label={p.number}
                      onClick={() => {
                        navigate("proposal-detail", { id: p.id });
                        setOpen(false);
                        setQ("");
                      }}
                    />
                  ))}
                </Section>
              )}
              {results.projects.length > 0 && (
                <Section title="Projets">
                  {results.projects.map((p) => (
                    <ResultItem
                      key={p.id}
                      label={p.name}
                      onClick={() => {
                        navigate("project-detail", { id: p.id });
                        setOpen(false);
                        setQ("");
                      }}
                    />
                  ))}
                </Section>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}

function ResultItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onMouseDown={onClick}
      className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-accent"
    >
      {label}
    </button>
  );
}
