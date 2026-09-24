"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Eye,
  PenTool,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Send,
  FolderKanban,
  Activity,
  CheckCheck,
  Loader2,
  RefreshCw,
  Inbox,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { api, ApiError } from "@/lib/api";
import { useStore, ViewKey } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import type { Notification } from "@/lib/types";
import { timeAgo } from "@/lib/format";

const NOTIF_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  PROPOSAL_VIEWED: Eye,
  PROPOSAL_ACCEPTED: CheckCircle2,
  PROPOSAL_SENT: Send,
  CONTRACT_SENT: FileText,
  CONTRACT_SIGNED: PenTool,
  CONTRACT_VIEWED: Eye,
  INVOICE_SENT: Send,
  INVOICE_PAID: CreditCard,
  INVOICE_VIEWED: Eye,
  INVOICE_OVERDUE: AlertTriangle,
  PAYMENT_RECEIVED: CreditCard,
  TASK_ASSIGNED: Activity,
  PROJECT_CREATED: FolderKanban,
};

function iconFor(type: string) {
  return NOTIF_ICON[type] || Bell;
}

const NOTIF_TONE: Record<string, string> = {
  PROPOSAL_VIEWED: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  PROPOSAL_ACCEPTED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  CONTRACT_SIGNED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  PAYMENT_RECEIVED: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  INVOICE_OVERDUE: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  INVOICE_PAID: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
};

function toneFor(type: string) {
  return NOTIF_TONE[type] || "bg-muted text-muted-foreground";
}

// Parse a notification link like "invoices:abc123" → { view, id }
function parseLink(link: string | null): { view: ViewKey; params?: Record<string, string> } | null {
  if (!link) return null;
  const [view, id] = link.split(":");
  const ALLOWED: ViewKey[] = [
    "dashboard",
    "prospects",
    "clients",
    "client-detail",
    "proposals",
    "proposal-detail",
    "quotes",
    "contracts",
    "contract-detail",
    "projects",
    "project-detail",
    "invoices",
    "invoice-detail",
    "payments",
    "documents",
    "reports",
    "settings",
    "notifications",
  ];
  if (!ALLOWED.includes(view as ViewKey)) return null;
  return {
    view: view as ViewKey,
    params: id ? { id } : {},
  };
}

export default function Notifications() {
  const { tick, bump, navigate } = useStore();
  const { toast } = useToast();
  const [items, setItems] = useState<Notification[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchAll = () => {
    setLoading(true);
    setError(null);
    api
      .get<Notification[]>("/api/notifications")
      .then((d) => setItems(d))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) return;
        setError(e?.message || "Erreur de chargement");
      })
      .finally(() => setLoading(false));
  };

  useEffect(fetchAll, [tick]);

  const unreadCount = useMemo(
    () => (items || []).filter((n) => !n.read).length,
    [items],
  );

  async function handleMarkAll() {
    setMarkingAll(true);
    try {
      await api.post("/api/notifications/read-all");
      toast({ title: "Toutes les notifications marquées comme lues" });
      fetchAll();
      bump();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur";
      toast({ title: msg, variant: "destructive" });
    } finally {
      setMarkingAll(false);
    }
  }

  async function handleClick(n: Notification) {
    if (busyId) return;
    if (!n.read) {
      setBusyId(n.id);
      try {
        await api.patch(`/api/notifications/${n.id}`, { read: true });
      } catch {
        /* ignore: still navigate */
      } finally {
        setBusyId(null);
      }
    }
    const target = parseLink(n.link);
    if (target) {
      navigate(target.view, target.params);
    } else {
      // optimistic: just refresh
      fetchAll();
      bump();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Bell className="h-5 w-5 text-muted-foreground" />
            Notifications
            {unreadCount > 0 && (
              <Badge className="ml-1 bg-rose-500 text-white">{unreadCount}</Badge>
            )}
          </h2>
          <p className="text-sm text-muted-foreground">
            Restez informé des évènements importants.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
          <Button
            size="sm"
            onClick={handleMarkAll}
            disabled={markingAll || unreadCount === 0 || !items}
          >
            {markingAll ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCheck className="h-3.5 w-3.5" />
            )}
            Tout marquer comme lu
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Boîte de réception</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertTriangle className="h-9 w-9 text-rose-500 mb-2" />
              <p className="text-sm text-muted-foreground mb-3">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchAll}>
                Réessayer
              </Button>
            </div>
          ) : !items || items.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="divide-y">
              {items.map((n) => {
                const Icon = iconFor(n.type);
                const tone = toneFor(n.type);
                const target = parseLink(n.link);
                return (
                  <li
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`flex items-start gap-3 py-3 px-2 rounded-md transition-colors ${
                      target ? "cursor-pointer hover:bg-accent" : ""
                    } ${busyId === n.id ? "opacity-60" : ""} ${n.read ? "opacity-60" : ""}`}
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${tone}`}
                    >
                      {busyId === n.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">{n.title}</p>
                        {!n.read && (
                          <span
                            className="h-2 w-2 rounded-full bg-rose-500 shrink-0"
                            aria-label="Non lu"
                          />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                        {n.message}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>
                    {target && (
                      <Badge variant="outline" className="text-[10px] shrink-0 capitalize">
                        {target.view.replace(/-/g, " ")}
                      </Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState() {
  const { navigate } = useStore();
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-3">
        <Inbox className="h-7 w-7 text-muted-foreground" />
      </div>
      <p className="text-base font-medium">Aucune notification</p>
      <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-sm">
        Vous serez prévenu lorsqu&apos;une proposition est consultée, un contrat
        signé, ou un paiement reçu.
      </p>
      <Button variant="outline" onClick={() => navigate("dashboard")}>
        Retour au tableau de bord
      </Button>
      <Separator className="mt-8 max-w-md" />
    </div>
  );
}
