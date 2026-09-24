"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  MoreVertical,
  Loader2,
  Mail,
  Phone,
  MapPin,
  Hash,
  Building2,
  StickyNote,
  AlertTriangle,
  Wallet,
  TrendingUp,
  Scale,
  FolderKanban,
  PenTool,
  Receipt,
  Send,
  Eye,
  CheckCircle2,
  FileText,
  Activity,
  FolderArchive,
  ExternalLink,
  Calendar,
  Globe,
  FileSignature,
  Users,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import {
  formatCurrency,
  formatDate,
  initials,
  timeAgo,
  PROPOSAL_STATUS_LABELS,
  CONTRACT_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
  INVOICE_STATUS_LABELS,
  INVOICE_TYPE_LABELS,
  STATUS_COLOR,
} from "@/lib/format";
import type {
  Client,
  Contract,
  Document,
  Invoice,
  Project,
  Proposal,
  TimelineEvent,
} from "@/lib/types";

type ClientStats = {
  totalValue: number;
  totalPaid: number;
  balance: number;
  projectsCount: number;
  contractsCount: number;
  invoicesCount: number;
};

type ClientResponse = {
  client: Client;
  stats: ClientStats;
  timeline: TimelineEvent[];
};

export default function ClientDetail() {
  const { params, navigate, org, bump, tick } = useStore();
  const id = params.id;
  const { toast } = useToast();

  const [data, setData] = useState<ClientResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<Partial<Client>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [toDelete, setToDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadClient = useCallback(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    setError(null);
    api
      .get<ClientResponse>(`/api/clients/${id}`)
      .then((d) => {
        if (active) setData(d);
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
  }, [id]);

  useEffect(() => {
    loadClient();
  }, [loadClient, tick]);

  function openEdit() {
    if (!data) return;
    setForm({
      firstName: data.client.firstName,
      lastName: data.client.lastName,
      company: data.client.company || "",
      email: data.client.email || "",
      phone: data.client.phone || "",
      address: data.client.address || "",
      country: data.client.country || "",
      taxId: data.client.taxId || "",
      notes: data.client.notes || "",
    });
    setFormError(null);
    setEditOpen(true);
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    if (!form.firstName?.trim() || !form.lastName?.trim()) {
      setFormError("Le prénom et le nom sont requis.");
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        company: form.company?.trim() || null,
        email: form.email?.trim() || null,
        phone: form.phone?.trim() || null,
        address: form.address?.trim() || null,
        country: form.country?.trim() || null,
        taxId: form.taxId?.trim() || null,
        notes: form.notes?.trim() || null,
      };
      const updated = await api.patch<Client>(`/api/clients/${id}`, payload);
      setData((d) => (d ? { ...d, client: updated } : d));
      toast({
        title: "Client mis à jour",
        description: `${updated.firstName} ${updated.lastName}`,
      });
      bump();
      setEditOpen(false);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur lors de l'enregistrement";
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!id) return;
    setDeleting(true);
    try {
      await api.del(`/api/clients/${id}`);
      toast({ title: "Client supprimé" });
      bump();
      navigate("clients");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur lors de la suppression";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setDeleting(false);
      setToDelete(false);
    }
  }

  if (!id) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertTriangle className="h-10 w-10 text-amber-500 mb-3" />
        <p className="text-sm text-muted-foreground">Aucun client sélectionné.</p>
        <Button variant="outline" className="mt-3" onClick={() => navigate("clients")}>
          <ArrowLeft className="h-4 w-4" />
          Retour aux clients
        </Button>
      </div>
    );
  }

  if (loading) return <ClientDetailSkeleton />;
  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertTriangle className="h-10 w-10 text-rose-500 mb-3" />
        <p className="text-sm text-muted-foreground mb-3">{error}</p>
        <Button variant="outline" onClick={() => navigate("clients")}>
          <ArrowLeft className="h-4 w-4" />
          Retour aux clients
        </Button>
      </div>
    );
  }
  if (!data) return null;

  const c = data.client;
  const stats = data.stats;
  const full = `${c.firstName} ${c.lastName}`;
  const currency = org?.currency;

  return (
    <div className="space-y-4">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("clients")}
          className="text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux clients
        </Button>
      </div>

      {/* Header */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
          <Avatar className="h-16 w-16 shrink-0">
            <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-lg font-semibold">
              {initials(full)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xl font-semibold tracking-tight truncate">{full}</h2>
                {c.company && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                    <Building2 className="h-4 w-4" />
                    {c.company}
                  </p>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MoreVertical className="h-4 w-4" />
                    Actions
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={openEdit}>
                    <Pencil className="h-4 w-4" />
                    Modifier
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setToDelete(true)}>
                    <Trash2 className="h-4 w-4" />
                    Supprimer
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {c.email && (
                <a
                  href={`mailto:${c.email}`}
                  className="flex items-center gap-1.5 hover:text-foreground"
                >
                  <Mail className="h-3.5 w-3.5" />
                  <span className="truncate max-w-[14rem]">{c.email}</span>
                </a>
              )}
              {c.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  {c.phone}
                </span>
              )}
              {c.country && (
                <span className="flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" />
                  {c.country}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Client depuis {timeAgo(c.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Summary stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-6">
        <SummaryCard
          title="Valeur totale"
          value={formatCurrency(stats.totalValue, currency)}
          icon={TrendingUp}
          tone="emerald"
        />
        <SummaryCard
          title="Paiements reçus"
          value={formatCurrency(stats.totalPaid, currency)}
          icon={Wallet}
          tone="cyan"
        />
        <SummaryCard
          title="Solde"
          value={formatCurrency(stats.balance, currency)}
          icon={Scale}
          tone={stats.balance > 0 ? "amber" : "neutral"}
        />
        <SummaryCard
          title="Projets"
          value={String(stats.projectsCount)}
          icon={FolderKanban}
          tone="violet"
        />
        <SummaryCard
          title="Contrats"
          value={String(stats.contractsCount)}
          icon={PenTool}
          tone="emerald"
        />
        <SummaryCard
          title="Factures"
          value={String(stats.invoicesCount)}
          icon={Receipt}
          tone="cyan"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="w-full sm:w-auto overflow-x-auto justify-start">
          <TabsTrigger value="overview">Vue d&apos;ensemble</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="proposals">Propositions</TabsTrigger>
          <TabsTrigger value="contracts">Contrats</TabsTrigger>
          <TabsTrigger value="projects">Projets</TabsTrigger>
          <TabsTrigger value="invoices">Factures</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab client={c} stats={stats} />
        </TabsContent>

        <TabsContent value="timeline">
          <TimelineTab timeline={data.timeline} />
        </TabsContent>

        <TabsContent value="proposals">
          <ProposalsTab clientId={id} />
        </TabsContent>

        <TabsContent value="contracts">
          <ContractsTab clientId={id} />
        </TabsContent>

        <TabsContent value="projects">
          <ProjectsTab clientId={id} />
        </TabsContent>

        <TabsContent value="invoices">
          <InvoicesTab clientId={id} />
        </TabsContent>

        <TabsContent value="documents">
          <DocumentsTab clientId={id} />
        </TabsContent>
      </Tabs>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier le client</DialogTitle>
            <DialogDescription>
              Mettez à jour les informations du client.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitEdit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Prénom *">
                <Input
                  value={form.firstName || ""}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                />
              </Field>
              <Field label="Nom *">
                <Input
                  value={form.lastName || ""}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                />
              </Field>
              <Field label="Société" className="sm:col-span-2">
                <Input
                  value={form.company || ""}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={form.email || ""}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>
              <Field label="Téléphone">
                <Input
                  value={form.phone || ""}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </Field>
              <Field label="Adresse" className="sm:col-span-2">
                <Input
                  value={form.address || ""}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </Field>
              <Field label="Pays">
                <Input
                  value={form.country || ""}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                />
              </Field>
              <Field label="Identifiant fiscal">
                <Input
                  value={form.taxId || ""}
                  onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                />
              </Field>
              <Field label="Notes" className="sm:col-span-2">
                <Textarea
                  value={form.notes || ""}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                />
              </Field>
            </div>
            {formError && (
              <p className="text-sm text-rose-600 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {formError}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
                disabled={saving}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={toDelete} onOpenChange={setToDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le client ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive. Le client{" "}
              <span className="font-medium text-foreground">{full}</span> et tout l'historique
              associé seront définitivement supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

function SummaryCard({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: keyof typeof TONE_BG;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${TONE_BG[tone]}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider truncate">
            {title}
          </p>
          <p className="text-base font-semibold tracking-tight truncate">{value}</p>
        </div>
      </div>
    </Card>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className || ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function EmptyTab({
  icon: Icon,
  title,
  message,
  cta,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  message: string;
  cta?: React.ReactNode;
}) {
  return (
    <Card className="py-10">
      <CardContent className="flex flex-col items-center justify-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">{message}</p>
        {cta && <div className="mt-3">{cta}</div>}
      </CardContent>
    </Card>
  );
}

function TabError({ message }: { message: string }) {
  return (
    <Card className="py-10">
      <CardContent className="flex flex-col items-center justify-center text-center">
        <AlertTriangle className="h-8 w-8 text-rose-500 mb-2" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}

function TabSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Card className="py-0">
      <div className="p-4 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </Card>
  );
}

function OverviewTab({
  client,
  stats,
}: {
  client: Client;
  stats: ClientStats;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="md:col-span-2 p-6">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-base">Coordonnées</CardTitle>
        </CardHeader>
        <CardContent className="px-0 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoRow icon={Mail} label="Email" value={client.email} href={`mailto:${client.email}`} />
            <InfoRow icon={Phone} label="Téléphone" value={client.phone} />
            <InfoRow icon={Building2} label="Société" value={client.company} />
            <InfoRow icon={Hash} label="Identifiant fiscal" value={client.taxId} />
            <InfoRow icon={MapPin} label="Adresse" value={client.address} className="sm:col-span-2" />
            <InfoRow icon={Globe} label="Pays" value={client.country} />
            <InfoRow
              icon={Calendar}
              label="Client depuis"
              value={formatDate(client.createdAt)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="p-6">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-base">Synthèse</CardTitle>
          </CardHeader>
          <CardContent className="px-0 space-y-2.5 text-sm">
            <StatLine label="Valeur totale" value={formatCurrency(stats.totalValue)} tone="emerald" />
            <StatLine label="Paiements reçus" value={formatCurrency(stats.totalPaid)} tone="cyan" />
            <StatLine
              label="Solde dû"
              value={formatCurrency(stats.balance)}
              tone={stats.balance > 0 ? "amber" : "neutral"}
            />
            <Separator />
            <StatLine label="Projets" value={String(stats.projectsCount)} />
            <StatLine label="Contrats" value={String(stats.contractsCount)} />
            <StatLine label="Factures" value={String(stats.invoicesCount)} />
          </CardContent>
        </Card>

        <Card className="p-6">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-base flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-muted-foreground" />
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {client.notes ? (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {client.notes}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground italic">Aucune note pour ce client.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  href,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null | undefined;
  href?: string;
  className?: string;
}) {
  const display = value || "—";
  const isMissing = !value;
  const content = (
    <div className="flex items-start gap-2 min-w-0">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className={`text-sm truncate ${isMissing ? "text-muted-foreground/60" : ""}`}>
          {display}
        </p>
      </div>
    </div>
  );
  if (href && value) {
    return (
      <a href={href} className={`block hover:text-primary ${className || ""}`}>
        {content}
      </a>
    );
  }
  return <div className={className || ""}>{content}</div>;
}

function StatLine({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: keyof typeof TONE_BG;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`font-medium px-2 py-0.5 rounded-md text-xs ${
          tone ? TONE_BG[tone] : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

const TIMELINE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  PROPOSAL_SENT: Send,
  PROPOSAL_VIEWED: Eye,
  PROPOSAL_ACCEPTED: CheckCircle2,
  PROPOSAL_REFUSED: AlertTriangle,
  CONTRACT_SENT: FileText,
  CONTRACT_SIGNED: FileSignature,
  CONTRACT_VIEWED: Eye,
  INVOICE_SENT: Send,
  INVOICE_PAID: Wallet,
  PAYMENT_RECEIVED: Wallet,
  PROJECT_STARTED: FolderKanban,
  PROJECT_CREATED: FolderKanban,
  TASK_DONE: CheckCircle2,
  CLIENT_CREATED: Users,
};

const TIMELINE_TONE: Record<string, string> = {
  PROPOSAL_ACCEPTED: "bg-emerald-500",
  CONTRACT_SIGNED: "bg-emerald-500",
  PAYMENT_RECEIVED: "bg-emerald-500",
  INVOICE_PAID: "bg-emerald-500",
  PROPOSAL_REFUSED: "bg-rose-500",
  PROPOSAL_VIEWED: "bg-cyan-500",
  PROPOSAL_SENT: "bg-violet-500",
  CONTRACT_SENT: "bg-violet-500",
  INVOICE_SENT: "bg-violet-500",
  PROJECT_STARTED: "bg-amber-500",
  PROJECT_CREATED: "bg-amber-500",
};

function TimelineTab({ timeline }: { timeline: TimelineEvent[] }) {
  const navigate = useStore((s) => s.navigate);
  if (!timeline || timeline.length === 0) {
    return (
      <EmptyTab
        icon={Activity}
        title="Aucune activité"
        message="L'historique des actions liées à ce client apparaîtra ici."
      />
    );
  }
  const events = [...timeline].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return (
    <Card className="p-6">
      <CardContent className="px-0 max-h-96 overflow-y-auto pr-1
        [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full
        [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
        <ol className="relative space-y-5 border-l border-border pl-5 ml-1">
          {events.map((ev) => {
            const Icon = TIMELINE_ICON[ev.type] || Activity;
            const dot = TIMELINE_TONE[ev.type] || "bg-muted-foreground";
            const onClick = () => {
              if (ev.proposalId) navigate("proposal-detail", { id: ev.proposalId });
              else if (ev.contractId) navigate("contract-detail", { id: ev.contractId });
              else if (ev.projectId) navigate("project-detail", { id: ev.projectId });
              else if (ev.invoiceId) navigate("invoice-detail", { id: ev.invoiceId });
            };
            const clickable = !!(
              ev.proposalId ||
              ev.contractId ||
              ev.projectId ||
              ev.invoiceId
            );
            return (
              <li key={ev.id} className="relative">
                <span
                  className={`absolute -left-[1.65rem] top-1 flex h-3 w-3 items-center justify-center rounded-full ring-2 ring-background ${dot}`}
                />
                <div
                  className={`flex items-start gap-3 ${
                    clickable ? "cursor-pointer" : ""
                  }`}
                  onClick={clickable ? onClick : undefined}
                >
                  <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-tight">{ev.message}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {formatDate(ev.createdAt, true)} · {timeAgo(ev.createdAt)}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

/* ---------- Lazy tabs with their own fetch ---------- */

function useListFetch<T>(url: string | null) {
  const [items, setItems] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) return;
    let active = true;
    api
      .get<T[]>(url)
      .then((d) => {
        if (active) {
          setItems(d || []);
          setError(null);
        }
      })
      .catch((e) => {
        if (!active) return;
        if (e instanceof ApiError && e.status === 401) return;
        setError(e?.message || "Erreur de chargement");
      });
    return () => {
      active = false;
    };
  }, [url]);

  // Loading is derived: true when we have a URL but no result and no error yet.
  const loading = !!url && items === null && error === null;
  return { items, loading, error };
}

function ProposalsTab({ clientId }: { clientId: string }) {
  const navigate = useStore((s) => s.navigate);
  const { items, loading, error } = useListFetch<Proposal>("/api/proposals");
  if (loading) return <TabSkeleton />;
  if (error) return <TabError message={error} />;
  const filtered = (items || []).filter((p) => p.clientId === clientId);
  if (filtered.length === 0) {
    return (
      <EmptyTab
        icon={FileText}
        title="Aucune proposition"
        message="Les propositions commerciales envoyées à ce client apparaîtront ici."
      />
    );
  }
  return (
    <Card className="py-0">
      <CardContent className="p-0">
        <ul className="divide-y">
          {filtered.map((p) => (
            <li
              key={p.id}
              onClick={() => navigate("proposal-detail", { id: p.id })}
              className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{p.title}</p>
                <p className="text-xs text-muted-foreground">{p.number}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-medium tabular-nums">
                  {formatCurrency(p.amount, p.currency)}
                </p>
                <p className="text-[11px] text-muted-foreground">{formatDate(p.createdAt)}</p>
              </div>
              <Badge className={STATUS_COLOR[p.status]}>
                {PROPOSAL_STATUS_LABELS[p.status]}
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ContractsTab({ clientId }: { clientId: string }) {
  const navigate = useStore((s) => s.navigate);
  const { items, loading, error } = useListFetch<Contract>("/api/contracts");
  if (loading) return <TabSkeleton />;
  if (error) return <TabError message={error} />;
  const filtered = (items || []).filter((c) => c.clientId === clientId);
  if (filtered.length === 0) {
    return (
      <EmptyTab
        icon={PenTool}
        title="Aucun contrat"
        message="Les contrats signés ou en cours avec ce client apparaîtront ici."
      />
    );
  }
  return (
    <Card className="py-0">
      <CardContent className="p-0">
        <ul className="divide-y">
          {filtered.map((c) => (
            <li
              key={c.id}
              onClick={() => navigate("contract-detail", { id: c.id })}
              className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                <PenTool className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{c.title}</p>
                <p className="text-xs text-muted-foreground">{c.number}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-medium tabular-nums">
                  {formatCurrency(c.amount, c.currency)}
                </p>
                <p className="text-[11px] text-muted-foreground">{formatDate(c.createdAt)}</p>
              </div>
              <Badge className={STATUS_COLOR[c.status]}>
                {CONTRACT_STATUS_LABELS[c.status]}
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ProjectsTab({ clientId }: { clientId: string }) {
  const navigate = useStore((s) => s.navigate);
  const org = useStore((s) => s.org);
  const { items, loading, error } = useListFetch<Project>("/api/projects");
  if (loading) return <TabSkeleton />;
  if (error) return <TabError message={error} />;
  const filtered = (items || []).filter((p) => p.clientId === clientId);
  if (filtered.length === 0) {
    return (
      <EmptyTab
        icon={FolderKanban}
        title="Aucun projet"
        message="Les projets en cours ou terminés pour ce client apparaîtront ici."
      />
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {filtered.map((p) => (
        <Card
          key={p.id}
          onClick={() => navigate("project-detail", { id: p.id })}
          className="p-4 gap-3 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium truncate">{p.name}</p>
              {p.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                  {p.description}
                </p>
              )}
            </div>
            <Badge className={STATUS_COLOR[p.status]}>
              {PROJECT_STATUS_LABELS[p.status]}
            </Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Budget : {formatCurrency(p.budget, org?.currency)}
            </span>
            <span className="text-muted-foreground">
              {p.progress || 0}% · {formatDate(p.startDate)}
            </span>
          </div>
        </Card>
      ))}
    </div>
  );
}

function InvoicesTab({ clientId }: { clientId: string }) {
  const navigate = useStore((s) => s.navigate);
  const org = useStore((s) => s.org);
  const { items, loading, error } = useListFetch<Invoice>("/api/invoices");
  if (loading) return <TabSkeleton />;
  if (error) return <TabError message={error} />;
  const filtered = (items || []).filter((i) => i.clientId === clientId);
  if (filtered.length === 0) {
    return (
      <EmptyTab
        icon={Receipt}
        title="Aucune facture"
        message="Les factures émises pour ce client apparaîtront ici."
      />
    );
  }
  return (
    <Card className="py-0">
      <CardContent className="p-0">
        <ul className="divide-y">
          {filtered.map((inv) => (
            <li
              key={inv.id}
              className="flex items-center gap-3 p-4"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300">
                <Receipt className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{inv.number}</p>
                  <Badge variant="outline" className="text-[10px]">
                    {INVOICE_TYPE_LABELS[inv.type]}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Émise le {formatDate(inv.issueDate)}
                  {inv.dueDate ? ` · échéance ${formatDate(inv.dueDate)}` : ""}
                </p>
              </div>
              <div className="text-right shrink-0 hidden sm:block">
                <p className="text-sm font-medium tabular-nums">
                  {formatCurrency(invoiceAmount(inv), org?.currency)}
                </p>
                <p className="text-[11px] text-muted-foreground">{formatDate(inv.createdAt)}</p>
              </div>
              <Badge className={STATUS_COLOR[inv.status]}>
                {INVOICE_STATUS_LABELS[inv.status]}
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigate("invoice-detail", { id: inv.id })}
                className="h-8 shrink-0"
              >
                Voir
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function invoiceAmount(inv: Invoice): number {
  if (!inv.items || inv.items.length === 0) return 0;
  const subtotal = inv.items.reduce(
    (s, it) => s + (it.qty || 0) * (it.unitPrice || 0),
    0,
  );
  const discount = subtotal * ((inv.discount || 0) / 100);
  const base = subtotal - discount;
  const tax = base * ((inv.taxRate || 0) / 100);
  return Math.round(base + tax);
}

function formatBytes(size: number) {
  if (!size) return "—";
  if (size < 1024) return `${size} o`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} Ko`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} Mo`;
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} Go`;
}

function DocumentsTab({ clientId }: { clientId: string }) {
  const { items, loading, error } = useListFetch<Document>(
    `/api/documents?clientId=${clientId}`,
  );
  if (loading) return <TabSkeleton />;
  if (error) return <TabError message={error} />;
  if (!items || items.length === 0) {
    return (
      <EmptyTab
        icon={FolderArchive}
        title="Aucun document"
        message="Les documents attachés à ce client apparaîtront ici."
      />
    );
  }
  return (
    <Card className="py-0">
      <CardContent className="p-0">
        <ul className="divide-y">
          {items.map((d) => (
            <li key={d.id} className="flex items-center gap-3 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                <FolderArchive className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{d.name}</p>
                <p className="text-xs text-muted-foreground">
                  {d.type} · {formatBytes(d.size)} · {formatDate(d.createdAt)}
                </p>
              </div>
              {d.url && (
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
                >
                  Ouvrir
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function ClientDetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-32 w-full" />
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
      <Skeleton className="h-10 w-full max-w-2xl" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
