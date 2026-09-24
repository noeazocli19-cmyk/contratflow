"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  FileText,
  Wallet,
  Clock,
  AlertTriangle,
  TrendingUp,
  Trophy,
  CheckCircle2,
  PenTool,
  Download,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PrintButton } from "@/components/shared/PrintButton";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import type { ReportData } from "@/lib/types";
import {
  formatCurrency,
  INVOICE_STATUS_LABELS,
  STATUS_COLOR,
} from "@/lib/format";

type RangeKey = "week" | "month" | "quarter" | "year";

const RANGE_TO_API: Record<RangeKey, string> = {
  week: "month", // API supports month|quarter|year; week falls back to month
  month: "month",
  quarter: "quarter",
  year: "year",
};

const RANGE_LABELS: Record<RangeKey, string> = {
  week: "Cette semaine",
  month: "Ce mois",
  quarter: "Ce trimestre",
  year: "Cette année",
};

export default function Reports() {
  const { org, tick } = useStore();
  const [range, setRange] = useState<RangeKey>("month");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    let active = true;
    api
      .get<ReportData>(`/api/reports?range=${RANGE_TO_API[range]}`)
      .then((d) => {
        if (active) {
          setData(d);
          setError(null);
        }
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
  };

  const refresh = () => {
    setLoading(true);
    return load();
  };

  useEffect(() => {
    const cancel = load();
    return cancel;
  }, [range, tick]);

  const currency = org?.currency;

  const kpis: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; tone: string }[] =
    data
      ? [
          {
            label: "Total facturé",
            value: formatCurrency(data.totalInvoiced, currency),
            icon: FileText,
            tone: "emerald",
          },
          {
            label: "Total encaissé",
            value: formatCurrency(data.totalCollected, currency),
            icon: Wallet,
            tone: "cyan",
          },
          {
            label: "Total restant",
            value: formatCurrency(data.totalOutstanding, currency),
            icon: Clock,
            tone: "amber",
          },
          {
            label: "Retards",
            value: formatCurrency(data.totalOverdue, currency),
            icon: AlertTriangle,
            tone: "rose",
          },
          {
            label: "Revenus du mois",
            value: formatCurrency(
              (data.revenueByMonth || []).reduce((s, m) => s + (m.amount || 0), 0),
              currency,
            ),
            icon: TrendingUp,
            tone: "emerald",
          },
        ]
      : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 no-print">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Rapports</h2>
          <p className="text-sm text-muted-foreground">
            Vue d&apos;ensemble de votre activité commerciale et financière.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={range} onValueChange={(v) => setRange(v as RangeKey)}>
            <TabsList>
              {(Object.keys(RANGE_LABELS) as RangeKey[]).map((r) => (
                <TabsTrigger key={r} value={r} className="text-xs">
                  {RANGE_LABELS[r]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <PrintButton title={`Rapport ContractFlow ${RANGE_LABELS[range]}`} label="Exporter PDF" />
        </div>
      </div>

      {error && !data && !loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-center no-print">
          <AlertCircle className="h-9 w-9 text-rose-500 mb-2" />
          <p className="text-sm text-muted-foreground mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={refresh}>
            Réessayer
          </Button>
        </div>
      ) : loading ? (
        <ReportsSkeleton />
      ) : !data ? null : (
        <>
          {/* Printable report body */}
          <div className="print-area space-y-4">
            {/* Print-only header */}
            <div className="hidden print:block space-y-1 mb-2">
              <h1 className="text-2xl font-semibold">Rapport ContractFlow</h1>
              <p className="text-sm text-muted-foreground">
                {org?.name} · {RANGE_LABELS[range]} · Édité le {new Date().toLocaleDateString("fr-FR")}
              </p>
            </div>

            {/* KPI cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {kpis.map((k) => (
                <KpiCard key={k.label} {...k} />
              ))}
            </div>

            {/* Revenue chart + small stats */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">
                    Revenus par mois — {RANGE_LABELS[range]}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div style={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.revenueByMonth || []}
                        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="var(--border)"
                          strokeOpacity={0.5}
                          vertical={false}
                        />
                        <XAxis
                          dataKey="month"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          width={48}
                          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                          tickFormatter={(v) =>
                            new Intl.NumberFormat("fr-FR", {
                              notation: "compact",
                            }).format(v as number)
                          }
                        />
                        <Tooltip
                          formatter={(v: number) => [formatCurrency(v, currency), "Revenu"]}
                          contentStyle={{
                            borderRadius: 8,
                            border: "1px solid var(--border)",
                            background: "var(--popover)",
                            color: "var(--popover-foreground)",
                            fontSize: 12,
                          }}
                          cursor={{ fill: "var(--accent)", opacity: 0.4 }}
                        />
                        <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Indicateurs</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <SmallStat
                    icon={CheckCircle2}
                    label="Taux d&apos;acceptation"
                    value={`${Math.round((data.acceptanceRate || 0) * 100)}%`}
                    hint="Propositions acceptées"
                    tone="emerald"
                  />
                  <SmallStat
                    icon={PenTool}
                    label="Valeur des contrats"
                    value={formatCurrency(data.contractValue || 0, currency)}
                    hint="Contrats signés"
                    tone="cyan"
                  />
                </CardContent>
              </Card>
            </div>

            {/* Status breakdown + Top clients + Export */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      Factures par statut
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportCsv(data)}
                      className="no-print"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Exporter CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <StatusBreakdown
                    rows={data.invoicesByStatus || []}
                    currency={currency}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-amber-500" />
                    Top clients
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <TopClients
                    rows={data.topClients || []}
                    currency={currency}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Sub components ---------- */

const TONE_BG: Record<string, string> = {
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  cyan: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: keyof typeof TONE_BG;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wider truncate">
            {label}
          </p>
          <p className="text-xl font-semibold tracking-tight truncate">{value}</p>
        </div>
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TONE_BG[tone]}`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}

function SmallStat({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  tone: keyof typeof TONE_BG;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${TONE_BG[tone]}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold tracking-tight">{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

function StatusBreakdown({
  rows,
  currency,
}: {
  rows: { status: string; count: number; amount: number }[];
  currency?: string;
}) {
  const total = useMemo(
    () => rows.reduce((s, r) => s + (r.amount || 0), 0),
    [rows],
  );

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <FileText className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm font-medium">Aucune facture</p>
        <p className="text-xs text-muted-foreground">
          Les statuts apparaîtront ici.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stacked bar */}
      <div className="h-3 w-full rounded-full overflow-hidden flex bg-muted">
        {rows.map((r) => {
          const pct = total > 0 ? (r.amount / total) * 100 : 0;
          if (pct <= 0) return null;
          const color = STATUS_BAR[r.status] || "bg-muted-foreground/40";
          return (
            <div
              key={r.status}
              className={`${color} h-full`}
              style={{ width: `${pct}%` }}
              title={`${INVOICE_STATUS_LABELS[r.status] || r.status}: ${formatCurrency(
                r.amount,
                currency,
              )}`}
            />
          );
        })}
      </div>

      <ul className="space-y-2">
        {rows.map((r) => (
          <li
            key={r.status}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Badge
                className={`${STATUS_COLOR[r.status] || "bg-muted text-muted-foreground"} text-[11px]`}
                variant="outline"
              >
                {INVOICE_STATUS_LABELS[r.status] || r.status}
              </Badge>
              <span className="text-muted-foreground text-xs">
                {r.count} facture{r.count > 1 ? "s" : ""}
              </span>
            </div>
            <span className="font-medium tabular-nums">
              {formatCurrency(r.amount, currency)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const STATUS_BAR: Record<string, string> = {
  DRAFT: "bg-muted-foreground/40",
  SENT: "bg-cyan-500",
  VIEWED: "bg-violet-500",
  PARTIALLY_PAID: "bg-amber-500",
  PAID: "bg-emerald-500",
  OVERDUE: "bg-rose-500",
  CANCELED: "bg-rose-300",
};

function TopClients({
  rows,
  currency,
}: {
  rows: { id: string; name: string; total: number }[];
  currency?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <Trophy className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm font-medium">Aucun client</p>
        <p className="text-xs text-muted-foreground">
          Vos meilleurs clients apparaîtront ici.
        </p>
      </div>
    );
  }
  const max = rows[0]?.total || 1;
  return (
    <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
      {rows.map((r, i) => (
        <li key={r.id} className="flex items-center gap-3">
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${
              i === 0
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                : i === 1
                  ? "bg-muted text-muted-foreground"
                  : i === 2
                    ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
                    : "bg-muted text-muted-foreground"
            }`}
          >
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{r.name}</p>
            <div className="mt-1 h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-emerald-500"
                style={{ width: `${Math.max(8, (r.total / max) * 100)}%` }}
              />
            </div>
          </div>
          <span className="text-sm font-medium tabular-nums shrink-0">
            {formatCurrency(r.total, currency)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ReportsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="md:col-span-2 h-72" />
        <Skeleton className="h-72" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

/* ---------- CSV export ---------- */

function exportCsv(
  data: ReportData,
) {
  try {
    const rows = data.invoicesByStatus || [];
    const header = ["Statut", "Libelle", "Nombre", "Montant"];
    const lines = [
      header.join(","),
      ...rows.map((r) =>
        [
          r.status,
          `"${(INVOICE_STATUS_LABELS[r.status] || r.status).replace(/"/g, '""')}"`,
          r.count,
          r.amount,
        ].join(","),
      ),
    ];
    const csv = lines.join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapport-factures-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    /* ignore */
  }
}
