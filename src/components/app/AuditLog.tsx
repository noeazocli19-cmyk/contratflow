"use client";

import { useEffect, useState } from "react";
import {
  ScrollText,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Filter,
  AlertCircle,
  User as UserIcon,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";

type AuditEntry = {
  id: string;
  organizationId: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  action: string;
  target: string | null;
  message: string;
  metadata: string | null;
  createdAt: string;
};

type AuditPage = {
  items: AuditEntry[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type AuditStats = {
  total: number;
  byAction: { action: string; count: number }[];
};

const KNOWN_ACTIONS: { value: string; label: string; tone: string }[] = [
  { value: "CLIENT_CREATED", label: "Client créé", tone: "emerald" },
  { value: "CLIENT_DELETED", label: "Client supprimé", tone: "rose" },
  { value: "PROPOSAL_CREATED", label: "Proposition créée", tone: "cyan" },
  { value: "CONTRACT_CREATED", label: "Contrat créé", tone: "cyan" },
  { value: "CONTRACT_SENT", label: "Contrat envoyé", tone: "amber" },
  { value: "CONTRACT_SIGNED", label: "Contrat signé", tone: "emerald" },
  { value: "PROJECT_CREATED", label: "Projet créé", tone: "violet" },
  { value: "INVOICE_CREATED", label: "Facture créée", tone: "cyan" },
  { value: "INVOICE_SENT", label: "Facture envoyée", tone: "amber" },
  { value: "PAYMENT_RECORDED", label: "Paiement enregistré", tone: "emerald" },
  { value: "USER_LOGIN", label: "Connexion", tone: "neutral" },
  { value: "USER_REGISTERED", label: "Compte créé", tone: "emerald" },
  { value: "MEMBER_INVITED", label: "Membre invité", tone: "violet" },
  { value: "PLAN_CHANGED", label: "Plan changé", tone: "amber" },
];

const ACTION_TONE: Record<string, string> = {
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  cyan: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  neutral: "bg-muted text-muted-foreground",
};

function actionLabel(action: string): string {
  return KNOWN_ACTIONS.find((a) => a.value === action)?.label ?? action;
}

function actionToneClass(action: string): string {
  const known = KNOWN_ACTIONS.find((a) => a.value === action);
  return known ? ACTION_TONE[known.tone] || ACTION_TONE.neutral : ACTION_TONE.neutral;
}

export default function AuditLog() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<string>("ALL");
  const [data, setData] = useState<AuditPage | null>(null);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch the current page whenever `page` or `action` changes.
  useEffect(() => {
    let active = true;
    const url =
      action === "ALL"
        ? `/api/audit?page=${page}`
        : `/api/audit?page=${page}&action=${encodeURIComponent(action)}`;
    api
      .get<AuditPage>(url)
      .then((d) => {
        if (!active) return;
        setData(d);
      })
      .catch((e) => {
        if (!active) return;
        if (e instanceof ApiError && e.status === 401) return;
        setError(e?.message || "Erreur de chargement");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, action]);

  // Fetch the action breakdown only once on mount.
  useEffect(() => {
    let active = true;
    api
      .get<AuditStats>("/api/audit/stats")
      .then((d) => {
        if (!active) return;
        setStats(d);
      })
      .catch(() => {
        // ignore — chips just won't show
      })
      .finally(() => {
        if (active) setStatsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function changeAction(next: string) {
    setAction(next);
    setPage(1);
    setError(null);
    setLoading(true);
  }

  function changePage(next: number) {
    setPage(next);
    setError(null);
    setLoading(true);
  }

  function exportCsv() {
    if (!data || data.items.length === 0) return;
    try {
      const header = [
        "Date",
        "Action",
        "Libelle",
        "Utilisateur",
        "Email",
        "Cible",
        "Message",
      ];
      const rows = data.items.map((it) =>
        [
          new Date(it.createdAt).toISOString(),
          it.action,
          `"${actionLabel(it.action).replace(/"/g, '""')}"`,
          `"${(it.userName || "Système").replace(/"/g, '""')}"`,
          `"${(it.userEmail || "").replace(/"/g, '""')}"`,
          `"${(it.target || "").replace(/"/g, '""')}"`,
          `"${(it.message || "").replace(/"/g, '""')}"`,
        ].join(","),
      );
      const csv = [header.join(","), ...rows].join("\n");
      const blob = new Blob([`\uFEFF${csv}`], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `journal-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }

  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const fromIdx = total === 0 ? 0 : (page - 1) * (data?.pageSize ?? 50) + 1;
  const toIdx = Math.min(total, page * (data?.pageSize ?? 50));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Journal d&apos;audit</h2>
          <p className="text-sm text-muted-foreground">
            Historique des actions effectuées dans votre organisation.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={action} onValueChange={changeAction}>
              <SelectTrigger className="w-56 h-9 text-sm">
                <SelectValue placeholder="Toutes les actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Toutes les actions</SelectItem>
                {KNOWN_ACTIONS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            disabled={!data || data.items.length === 0}
          >
            <Download className="h-3.5 w-3.5" />
            Exporter CSV
          </Button>
        </div>
      </div>

      {/* Quick stats by action (clickable chips) */}
      {!statsLoading && stats && stats.byAction.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-muted-foreground" />
              Répartition
              <Badge variant="outline" className="ml-1 font-mono text-[11px]">
                {stats.total} évènement{stats.total > 1 ? "s" : ""}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {stats.byAction.slice(0, 12).map((row) => {
                const active = action === row.action;
                return (
                  <button
                    key={row.action}
                    type="button"
                    onClick={() => changeAction(active ? "ALL" : row.action)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors border ${
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    <span className="font-medium">{actionLabel(row.action)}</span>
                    <span className="font-mono text-[10px] opacity-70">{row.count}</span>
                  </button>
                );
              })}
              {action !== "ALL" && (
                <button
                  type="button"
                  onClick={() => changeAction("ALL")}
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  × Effacer le filtre
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <AlertCircle className="h-8 w-8 text-rose-500 mb-2" />
          <p className="text-sm text-muted-foreground mb-3">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setError(null);
              changePage(1);
            }}
          >
            Réessayer
          </Button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && data && data.items.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
              <ScrollText className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-base font-medium">Aucune entrée</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              {action === "ALL"
                ? "Aucune action n'a encore été enregistrée. Les actions que vous effectuez (création de clients, signatures de contrats, paiements…) apparaîtront ici."
                : `Aucune entrée pour le filtre « ${actionLabel(action)} ».`}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Table (desktop) */}
      {!loading && !error && data && data.items.length > 0 && (
        <>
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">Date</TableHead>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead className="w-[180px]">Action</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(it.createdAt, true)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {it.userName ? (
                          <div className="flex items-center gap-2">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                              {it.userName
                                .split(" ")
                                .slice(0, 2)
                                .map((p) => p[0]?.toUpperCase())
                                .join("")}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate">{it.userName}</div>
                              {it.userEmail && (
                                <div className="text-[11px] text-muted-foreground truncate">
                                  {it.userEmail}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                            <UserIcon className="h-3.5 w-3.5" />
                            Système
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-[11px] ${actionToneClass(it.action)}`}>
                          {actionLabel(it.action)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{it.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Cards (mobile) */}
          <div className="md:hidden space-y-2">
            {data.items.map((it) => (
              <Card key={it.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge className={`text-[11px] ${actionToneClass(it.action)}`}>
                      {actionLabel(it.action)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(it.createdAt, true)}
                    </span>
                  </div>
                  <div className="text-sm">{it.message}</div>
                  <div className="text-xs text-muted-foreground">
                    {it.userName ? it.userName : "Système"}
                    {it.userEmail ? ` · ${it.userEmail}` : ""}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {total === 0
                ? "—"
                : `${fromIdx}-${toIdx} sur ${total} · page ${page}/${totalPages}`}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => changePage(Math.max(1, page - 1))}
                disabled={page <= 1 || loading}
              >
                <ChevronLeft className="h-4 w-4" />
                Précédent
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => changePage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages || loading}
              >
                Suivant
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Loading overlay for action change */}
      {loading && data && (
        <div className="flex items-center justify-center py-2 text-xs text-muted-foreground gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" />
          Chargement…
        </div>
      )}
    </div>
  );
}
