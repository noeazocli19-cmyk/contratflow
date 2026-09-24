"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  TrendingUp,
  Wallet,
  Clock,
  AlertTriangle,
  Users,
  Send,
  Eye,
  FileText,
  PenTool,
  FolderKanban,
  CheckCircle2,
  Bell,
  Activity,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import type { DashboardData, Notification, TimelineEvent } from "@/lib/types";
import { formatCurrency, timeAgo } from "@/lib/format";

export default function Dashboard() {
  const { org, navigate, tick } = useStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    let active = true;
    api
      .get<DashboardData>("/api/dashboard")
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
  }, [tick]);

  if (loading) return <DashboardSkeleton />;
  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="h-10 w-10 text-rose-500 mb-3" />
        <p className="text-sm text-muted-foreground mb-3">{error}</p>
        <Button variant="outline" onClick={refresh}>
          Réessayer
        </Button>
      </div>
    );
  }
  if (!data) return null;

  const currency = org?.currency;
  const rev = data.revenue;
  const pipe = data.pipeline;
  const proj = data.projects;
  const inv = data.invoices;
  const unread = (data.notifications || []).filter((n) => !n.read).slice(0, 6);
  const recentActivity = (data.activity || []).slice(0, 6);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Bonjour 👋
          </h2>
          <p className="text-sm text-muted-foreground">
            Voici l&apos;activité de {org?.name || "votre organisation"}.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh}>
          <Loader2 className="mr-2 h-3.5 w-3.5" />
          Actualiser
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Revenu ce mois"
          value={formatCurrency(rev.thisMonth, currency)}
          icon={TrendingUp}
          tone="emerald"
          hint="Encaissé sur la période"
        />
        <KpiCard
          title="Encaissés"
          value={formatCurrency(rev.collected, currency)}
          icon={Wallet}
          tone="cyan"
          hint="Cumul encaissé"
        />
        <KpiCard
          title="En attente"
          value={formatCurrency(rev.pending, currency)}
          icon={Clock}
          tone="amber"
          hint="À encaisser"
        />
        <KpiCard
          title="Impayés"
          value={formatCurrency(rev.overdue, currency)}
          icon={AlertTriangle}
          tone="rose"
          hint="Factures en retard"
        />
      </div>

      {/* Main grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Revenue chart */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Revenus — 6 derniers mois</CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={data.revenueSeries || []}
                  margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
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
                      new Intl.NumberFormat("fr-FR", { notation: "compact" }).format(v as number)
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
                    labelStyle={{ color: "var(--muted-foreground)" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#revGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Pipeline commercial */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pipeline commercial</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <PipelineRow icon={Users} label="Prospects" value={pipe.prospects} tone="violet" />
            <PipelineRow icon={Send} label="Propositions envoyées" value={pipe.proposalsSent} tone="cyan" />
            <PipelineRow icon={Eye} label="Propositions vues" value={pipe.proposalsViewed} tone="amber" />
            <PipelineRow icon={FileText} label="Contrats envoyés" value={pipe.contractsSent} tone="emerald" />
            <PipelineRow icon={PenTool} label="Contrats signés" value={pipe.contractsSigned} tone="emerald" />
          </CardContent>
        </Card>

        {/* Projets */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Projets</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3">
            <StatBox icon={FolderKanban} label="Actifs" value={proj.active} tone="cyan" />
            <StatBox icon={CheckCircle2} label="Terminés" value={proj.done} tone="emerald" />
            <StatBox icon={AlertTriangle} label="En retard" value={proj.late} tone="rose" />
          </CardContent>
        </Card>

        {/* Factures */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Factures</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <StatBox icon={FileText} label="Brouillons" value={inv.draft} tone="neutral" />
            <StatBox icon={Send} label="Envoyées" value={inv.sent} tone="cyan" />
            <StatBox icon={CheckCircle2} label="Payées" value={inv.paid} tone="emerald" />
            <StatBox icon={AlertTriangle} label="En retard" value={inv.overdue} tone="rose" />
          </CardContent>
        </Card>

        {/* Activité récente */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                Activité récente
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <EmptyInline
                icon={Activity}
                title="Aucune activité"
                message="Vos actions récentes apparaîtront ici."
              />
            ) : (
              <ol className="relative space-y-3 border-l border-border pl-4 ml-1">
                {recentActivity.map((ev) => (
                  <ActivityRow key={ev.id} ev={ev} />
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        {/* Notifications récentes */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4 text-muted-foreground" />
                Notifications récentes
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("notifications")}
                className="text-xs"
              >
                Voir tout
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {unread.length === 0 ? (
              <EmptyInline
                icon={Bell}
                title="Aucune notification"
                message="Vous êtes à jour."
              />
            ) : (
              <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {unread.map((n) => (
                  <NotificationRow key={n.id} n={n} compact />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ---------- Sub components ---------- */

const TONE_BG: Record<string, string> = {
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  cyan: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  neutral: "bg-muted text-muted-foreground",
};

function KpiCard({
  title,
  value,
  icon: Icon,
  tone,
  hint,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: keyof typeof TONE_BG;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            {title}
          </p>
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${TONE_BG[tone]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function PipelineRow({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: keyof typeof TONE_BG;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border p-3">
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-md ${TONE_BG[tone]}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{label}</p>
      </div>
      <span className="text-lg font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function StatBox({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: keyof typeof TONE_BG;
}) {
  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-md ${TONE_BG[tone]}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <div>
        <p className="text-xl font-semibold tabular-nums leading-none">{value}</p>
        <p className="text-[11px] text-muted-foreground mt-1">{label}</p>
      </div>
    </div>
  );
}

const ACTIVITY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  PROPOSAL_SENT: Send,
  PROPOSAL_VIEWED: Eye,
  PROPOSAL_ACCEPTED: CheckCircle2,
  CONTRACT_SENT: FileText,
  CONTRACT_SIGNED: PenTool,
  INVOICE_SENT: Send,
  PAYMENT_RECEIVED: Wallet,
  PROJECT_CREATED: FolderKanban,
  TASK_DONE: CheckCircle2,
};

function ActivityRow({ ev }: { ev: TimelineEvent }) {
  const Icon = ACTIVITY_ICON[ev.type] || Activity;
  return (
    <li className="relative">
      <span className="absolute -left-[1.35rem] top-1 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-background" />
      <div className="flex items-start gap-2">
        <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-tight">{ev.message}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {timeAgo(ev.createdAt)}
          </p>
        </div>
      </div>
    </li>
  );
}

export const NOTIF_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  PROPOSAL_VIEWED: Eye,
  PROPOSAL_ACCEPTED: CheckCircle2,
  CONTRACT_SENT: FileText,
  CONTRACT_SIGNED: PenTool,
  INVOICE_SENT: Send,
  INVOICE_PAID: Wallet,
  INVOICE_OVERDUE: AlertTriangle,
  PAYMENT_RECEIVED: Wallet,
  TASK_ASSIGNED: Activity,
  PROJECT_CREATED: FolderKanban,
};

export function NotificationRow({
  n,
  compact = false,
  onClick,
}: {
  n: Notification;
  compact?: boolean;
  onClick?: () => void;
}) {
  const Icon = NOTIF_ICON[n.type] || Bell;
  return (
    <li
      onClick={onClick}
      className={`flex items-start gap-3 rounded-md p-2.5 border transition-colors ${
        onClick ? "cursor-pointer hover:bg-accent" : ""
      } ${n.read ? "opacity-60" : ""}`}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="h-4 w-4 text-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">{n.title}</p>
          {!n.read && (
            <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" aria-label="Non lu" />
          )}
        </div>
        {!compact && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.message}</p>
        )}
        <p className="text-[11px] text-muted-foreground mt-0.5">{timeAgo(n.createdAt)}</p>
      </div>
      {n.read && (
        <Badge variant="outline" className="text-[10px] shrink-0">
          Lu
        </Badge>
      )}
    </li>
  );
}

function EmptyInline({
  icon: Icon,
  title,
  message,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted mb-2">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-64" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-44" />
        ))}
      </div>
    </div>
  );
}
