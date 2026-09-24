"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  LayoutTemplate,
  MoreVertical,
  Send,
  Trash2,
  Eye,
  FileSignature,
  FilePlus,
  Pencil,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  formatCurrency,
  formatDate,
  CONTRACT_STATUS_LABELS,
  STATUS_COLOR,
} from "@/lib/format";
import type { Contract, Client, Proposal } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

// Local types — ContractTemplate is not in shared types
type ContractTemplate = {
  id: string;
  name: string;
  description: string | null;
  content: string;
  defaultAmount: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
};

const CURRENCIES = ["XOF", "EUR", "USD", "GBP", "XAF"];

const FILTER_TABS: { value: string; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "DRAFT", label: "Brouillons" },
  { value: "SENT", label: "Envoyés" },
  { value: "VIEWED", label: "Consultés" },
  { value: "SIGNED", label: "Signés" },
  { value: "EXPIRED", label: "Expirés" },
  { value: "CANCELED", label: "Annulés" },
];

function clientLabel(c?: Client): string {
  if (!c) return "—";
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ");
  return c.company ? `${name} · ${c.company}` : name;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main list component
// ─────────────────────────────────────────────────────────────────────────────

export default function Contracts() {
  const { org, tick, navigate, bump } = useStore();
  const { toast } = useToast();
  const [contracts, setContracts] = useState<Contract[] | null>(null);
  const [filter, setFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Contract | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setContracts(null);
    api
      .get<Contract[]>("/api/contracts")
      .then((data) => {
        if (!cancelled) setContracts(data);
      })
      .catch((e) => {
        if (cancelled) return;
        const msg = e instanceof ApiError ? e.message : "Impossible de charger les contrats";
        toast({ title: "Erreur", description: msg, variant: "destructive" });
        setContracts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [tick, toast]);

  const filtered = useMemo(() => {
    if (!contracts) return [];
    if (filter === "all") return contracts;
    return contracts.filter((c) => c.status === filter);
  }, [contracts, filter]);

  async function handleSend(c: Contract) {
    setSendingId(c.id);
    try {
      const res = await api.post<{ publicToken: string }>(`/api/contracts/${c.id}/send`);
      const link = `${window.location.origin}/?portal=contract&token=${res.publicToken}`;
      try {
        await navigator.clipboard.writeText(link);
      } catch {
        /* ignore clipboard errors */
      }
      toast({
        title: "Contrat envoyé",
        description: `Lien copié dans le presse-papiers : ${link}`,
      });
      bump();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur lors de l'envoi";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setSendingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.del(`/api/contracts/${deleteTarget.id}`);
      toast({ title: "Contrat supprimé", description: deleteTarget.number });
      setDeleteTarget(null);
      bump();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur lors de la suppression";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contrats</h1>
          <p className="text-sm text-muted-foreground">
            Gérez vos contrats et signatures électroniques
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setTemplatesOpen(true)}>
            <LayoutTemplate className="size-4" />
            Modèles
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            Nouveau contrat
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="flex h-auto w-fit max-w-full overflow-x-auto justify-start gap-0.5">
          {FILTER_TABS.map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="min-w-fit px-3 text-xs whitespace-nowrap"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* List */}
      {contracts === null ? (
        <ContractsSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState
          hasContracts={contracts.length > 0}
          onCreate={() => setCreateOpen(true)}
        />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[130px]">Numéro</TableHead>
                  <TableHead>Titre</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Signé le</TableHead>
                  <TableHead>Créé le</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => navigate("contract-detail", { id: c.id })}
                  >
                    <TableCell className="font-mono text-xs">{c.number}</TableCell>
                    <TableCell className="font-medium max-w-[280px] truncate">
                      {c.title}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate">
                      {clientLabel(c.client)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(c.amount, c.currency || org?.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLOR[c.status]} variant="outline">
                        {CONTRACT_STATUS_LABELS[c.status] || c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(c.signedAt)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(c.createdAt)}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => navigate("contract-detail", { id: c.id })}
                          >
                            <Eye className="size-4" /> Voir le détail
                          </DropdownMenuItem>
                          {c.status === "DRAFT" && (
                            <DropdownMenuItem
                              disabled={sendingId === c.id}
                              onClick={() => void handleSend(c)}
                            >
                              <Send className="size-4" />
                              {sendingId === c.id ? "Envoi…" : "Envoyer"}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeleteTarget(c)}
                          >
                            <Trash2 className="size-4" /> Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((c) => (
              <Card
                key={c.id}
                className="p-4 cursor-pointer"
                onClick={() => navigate("contract-detail", { id: c.id })}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-muted-foreground">{c.number}</div>
                    <div className="font-medium truncate">{c.title}</div>
                    <div className="text-sm text-muted-foreground truncate">
                      {clientLabel(c.client)}
                    </div>
                  </div>
                  <Badge className={STATUS_COLOR[c.status]} variant="outline">
                    {CONTRACT_STATUS_LABELS[c.status] || c.status}
                  </Badge>
                </div>
                <Separator className="my-3" />
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium tabular-nums">
                    {formatCurrency(c.amount, c.currency || org?.currency)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(c.createdAt)}
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {c.status === "DRAFT" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={sendingId === c.id}
                      onClick={() => void handleSend(c)}
                    >
                      <Send className="size-3.5" />
                      {sendingId === c.id ? "Envoi…" : "Envoyer"}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleteTarget(c)}
                  >
                    <Trash2 className="size-3.5" /> Supprimer
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <CreateContractDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(c, navigateToDetail) => {
          setCreateOpen(false);
          bump();
          if (navigateToDetail) navigate("contract-detail", { id: c.id });
        }}
      />

      <TemplatesDialog open={templatesOpen} onOpenChange={setTemplatesOpen} onChanged={bump} />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le contrat ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le contrat{" "}
              <span className="font-mono">{deleteTarget?.number}</span> sera
              définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? "Suppression…" : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────────────────

function ContractsSkeleton() {
  return (
    <Card className="p-0 overflow-hidden hidden md:block">
      <div className="p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({ hasContracts, onCreate }: { hasContracts: boolean; onCreate: () => void }) {
  return (
    <Card className="p-10 flex flex-col items-center justify-center text-center">
      <div className="size-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
        <FileSignature className="size-6" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">
        {hasContracts ? "Aucun contrat dans cette catégorie" : "Aucun contrat pour le moment"}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-md">
        {hasContracts
          ? "Essayez de changer le filtre ou créez un nouveau contrat."
          : "Créez votre premier contrat à partir de zéro ou depuis un modèle réutilisable."}
      </p>
      <Button className="mt-4" onClick={onCreate}>
        <Plus className="size-4" />
        Nouveau contrat
      </Button>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Create contract dialog (empty + template modes)
// ─────────────────────────────────────────────────────────────────────────────

type CreateMode = "empty" | "template";

function CreateContractDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (c: Contract, navigateToDetail: boolean) => void;
}) {
  const { org } = useStore();
  const { toast } = useToast();
  const [mode, setMode] = useState<CreateMode>("empty");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [clients, setClients] = useState<Client[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);

  // Empty-mode form state
  const [clientId, setClientId] = useState("");
  const [proposalId, setProposalId] = useState("__none__");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(org?.currency || "XOF");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [duration, setDuration] = useState("");
  const [conditions, setConditions] = useState("");

  // Template-mode form state
  const [templateId, setTemplateId] = useState("");
  const [tClientId, setTClientId] = useState("");
  const [tAmount, setTAmount] = useState("");
  const [tStartDate, setTStartDate] = useState("");
  const [tEndDate, setTEndDate] = useState("");

  // Fetch data when dialog opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      api.get<Client[]>("/api/clients"),
      api.get<Proposal[]>("/api/proposals"),
      api.get<ContractTemplate[]>("/api/contract-templates"),
    ])
      .then(([c, p, t]) => {
        setClients(c);
        setProposals(p.filter((x) => x.status === "ACCEPTED"));
        setTemplates(t);
        if (c.length > 0) {
          setClientId((prev) => prev || c[0].id);
          setTClientId((prev) => prev || c[0].id);
        }
        if (t.length > 0) {
          setTemplateId((prev) => prev || t[0].id);
        }
      })
      .catch((e) => {
        const msg = e instanceof ApiError ? e.message : "Impossible de charger les données";
        toast({ title: "Erreur", description: msg, variant: "destructive" });
      })
      .finally(() => setLoading(false));
  }, [open]);

  // Default amount when template changes
  useEffect(() => {
    if (mode !== "template" || !templateId) return;
    const tpl = templates.find((t) => t.id === templateId);
    if (tpl) setTAmount(String(tpl.defaultAmount || 0));
  }, [templateId, mode, templates]);

  function reset() {
    setMode("empty");
    setTitle("");
    setContent("");
    setAmount("");
    setStartDate("");
    setEndDate("");
    setDuration("");
    setConditions("");
    setProposalId("__none__");
    setTAmount("");
    setTStartDate("");
    setTEndDate("");
  }

  async function submitEmpty() {
    if (!clientId) {
      toast({ title: "Client requis", variant: "destructive" });
      return;
    }
    if (!title.trim()) {
      toast({ title: "Titre requis", variant: "destructive" });
      return;
    }
    if (!content.trim()) {
      toast({ title: "Contenu du contrat requis", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        clientId,
        title: title.trim(),
        content: content.trim(),
        amount: parseFloat(amount) || 0,
        currency,
      };
      if (proposalId && proposalId !== "__none__") body.proposalId = proposalId;
      if (startDate) body.startDate = startDate;
      if (endDate) body.endDate = endDate;
      if (duration.trim()) body.duration = duration.trim();
      if (conditions.trim()) body.conditions = conditions.trim();
      const created = await api.post<Contract>("/api/contracts", body);
      toast({
        title: "Contrat créé",
        description: `${created.number} — ${created.title}`,
      });
      onCreated(created, false);
      reset();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur lors de la création";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function submitTemplate() {
    if (!templateId) {
      toast({ title: "Modèle requis", variant: "destructive" });
      return;
    }
    if (!tClientId) {
      toast({ title: "Client requis", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { clientId: tClientId };
      if (tAmount) body.amount = parseFloat(tAmount);
      if (tStartDate) body.startDate = tStartDate;
      if (tEndDate) body.endDate = tEndDate;
      const created = await api.post<Contract>(
        `/api/contract-templates/${templateId}/instantiate`,
        body
      );
      toast({
        title: "Contrat créé à partir du modèle",
        description: `${created.number} — ${created.title}`,
      });
      onCreated(created, true);
      reset();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur lors de la création";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const clientsLoading = loading && clients.length === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!submitting) onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau contrat</DialogTitle>
          <DialogDescription>
            Choisissez un mode de création puis renseignez les informations du contrat.
          </DialogDescription>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
          <button
            type="button"
            onClick={() => setMode("empty")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition",
              mode === "empty"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FilePlus className="size-4" /> Vide
          </button>
          <button
            type="button"
            onClick={() => setMode("template")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition",
              mode === "template"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutTemplate className="size-4" /> À partir d&apos;un modèle
          </button>
        </div>

        {mode === "empty" ? (
          <div className="space-y-4">
            {/* Client + proposal */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Client *</Label>
                <Select value={clientId} onValueChange={setClientId} disabled={clientsLoading}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={clientsLoading ? "Chargement…" : "Sélectionner"} />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.length === 0 && (
                      <SelectItem value="__none__" disabled>Aucun client</SelectItem>
                    )}
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {clientLabel(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Proposition acceptée (optionnel)</Label>
                <Select value={proposalId} onValueChange={setProposalId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Aucune" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Aucune —</SelectItem>
                    {proposals.length === 0 && (
                      <SelectItem value="__empty__" disabled>
                        Aucune proposition acceptée
                      </SelectItem>
                    )}
                    {proposals.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.number} · {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="cc-title">Titre *</Label>
              <Input
                id="cc-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contrat de prestation…"
              />
            </div>

            {/* Content */}
            <div className="space-y-1.5">
              <Label htmlFor="cc-content">Contenu du contrat *</Label>
              <Textarea
                id="cc-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={8}
                placeholder="Décrivez le contenu du contrat (markdown simple supporté : # Titre, ## Sous-titre)…"
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Astuce : utilisez <code className="px-1 py-0.5 rounded bg-muted"># Titre</code> pour
                structurer votre contrat en sections.
              </p>
            </div>

            {/* Amount + currency */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="cc-amount">Montant</Label>
                <Input
                  id="cc-amount"
                  type="number"
                  min={0}
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Devise</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Dates + duration */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cc-start">Date de début</Label>
                <Input
                  id="cc-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cc-end">Date de fin</Label>
                <Input
                  id="cc-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cc-duration">Durée</Label>
                <Input
                  id="cc-duration"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="3 mois"
                />
              </div>
            </div>

            {/* Conditions */}
            <div className="space-y-1.5">
              <Label htmlFor="cc-conditions">Conditions particulières</Label>
              <Textarea
                id="cc-conditions"
                value={conditions}
                onChange={(e) => setConditions(e.target.value)}
                rows={3}
                placeholder="Conditions de paiement, modalités d'annulation, etc."
              />
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Annuler
              </Button>
              <Button onClick={() => void submitEmpty()} disabled={submitting}>
                {submitting ? "Création…" : "Créer le contrat"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Template */}
            <div className="space-y-1.5">
              <Label>Modèle *</Label>
              {loading && templates.length === 0 ? (
                <Skeleton className="h-9 w-full" />
              ) : templates.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-center">
                  <LayoutTemplate className="size-5 mx-auto text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Aucun modèle disponible. Créez-en un via le bouton « Modèles ».
                  </p>
                </div>
              ) : (
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sélectionner un modèle" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {templateId && (() => {
                const tpl = templates.find((t) => t.id === templateId);
                if (!tpl?.description) return null;
                return (
                  <p className="text-xs text-muted-foreground">{tpl.description}</p>
                );
              })()}
            </div>

            {/* Client */}
            <div className="space-y-1.5">
              <Label>Client *</Label>
              <Select value={tClientId} onValueChange={setTClientId} disabled={clientsLoading}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={clientsLoading ? "Chargement…" : "Sélectionner"} />
                </SelectTrigger>
                <SelectContent>
                  {clients.length === 0 && (
                    <SelectItem value="__none__" disabled>Aucun client</SelectItem>
                  )}
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {clientLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <Label htmlFor="ct-amount">Montant</Label>
              <Input
                id="ct-amount"
                type="number"
                min={0}
                step="any"
                value={tAmount}
                onChange={(e) => setTAmount(e.target.value)}
                placeholder="0"
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ct-start">Date de début</Label>
                <Input
                  id="ct-start"
                  type="date"
                  value={tStartDate}
                  onChange={(e) => setTStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ct-end">Date de fin</Label>
                <Input
                  id="ct-end"
                  type="date"
                  value={tEndDate}
                  onChange={(e) => setTEndDate(e.target.value)}
                />
              </div>
            </div>

            {templateId && (
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Aperçu du modèle
                </p>
                <div className="max-h-40 overflow-y-auto text-xs text-muted-foreground whitespace-pre-wrap font-mono">
                  {templates.find((t) => t.id === templateId)?.content || ""}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Annuler
              </Button>
              <Button
                onClick={() => void submitTemplate()}
                disabled={submitting || templates.length === 0}
              >
                {submitting ? "Création…" : "Créer et ouvrir"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Templates management dialog
// ─────────────────────────────────────────────────────────────────────────────

type TemplateForm = {
  name: string;
  description: string;
  content: string;
  defaultAmount: string;
  currency: string;
};

const EMPTY_TEMPLATE_FORM: TemplateForm = {
  name: "",
  description: "",
  content: "",
  defaultAmount: "0",
  currency: "XOF",
};

function TemplatesDialog({
  open,
  onOpenChange,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onChanged: () => void;
}) {
  const { org } = useStore();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<ContractTemplate | null>(null);
  const [form, setForm] = useState<TemplateForm>(EMPTY_TEMPLATE_FORM);
  const [deleteTarget, setDeleteTarget] = useState<ContractTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  function load() {
    setLoading(true);
    api
      .get<ContractTemplate[]>("/api/contract-templates")
      .then(setTemplates)
      .catch((e) => {
        const msg = e instanceof ApiError ? e.message : "Impossible de charger les modèles";
        toast({ title: "Erreur", description: msg, variant: "destructive" });
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (open) load();
  }, [open]);

  function openNew() {
    setEditing(null);
    setForm({
      ...EMPTY_TEMPLATE_FORM,
      currency: org?.currency || "XOF",
    });
    setEditOpen(true);
  }

  function openEdit(t: ContractTemplate) {
    setEditing(t);
    setForm({
      name: t.name,
      description: t.description || "",
      content: t.content,
      defaultAmount: String(t.defaultAmount || 0),
      currency: t.currency || "XOF",
    });
    setEditOpen(true);
  }

  async function save() {
    if (!form.name.trim()) {
      toast({ title: "Nom requis", variant: "destructive" });
      return;
    }
    if (!form.content.trim()) {
      toast({ title: "Contenu requis", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        content: form.content.trim(),
        defaultAmount: parseFloat(form.defaultAmount) || 0,
        currency: form.currency,
      };
      if (editing) {
        await api.patch(`/api/contract-templates/${editing.id}`, body);
        toast({ title: "Modèle mis à jour", description: body.name });
      } else {
        await api.post("/api/contract-templates", body);
        toast({ title: "Modèle créé", description: body.name });
      }
      setEditOpen(false);
      load();
      onChanged();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur lors de l'enregistrement";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.del(`/api/contract-templates/${deleteTarget.id}`);
      toast({ title: "Modèle supprimé", description: deleteTarget.name });
      setDeleteTarget(null);
      load();
      onChanged();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur lors de la suppression";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!saving && !deleting) onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutTemplate className="size-5" /> Modèles de contrats
          </DialogTitle>
          <DialogDescription>
            Créez des modèles réutilisables. Les variables{" "}
            <code className="px-1 py-0.5 rounded bg-muted">{"{{client_name}}"}</code>,{" "}
            <code className="px-1 py-0.5 rounded bg-muted">{"{{amount}}"}</code>,{" "}
            <code className="px-1 py-0.5 rounded bg-muted">{"{{start_date}}"}</code>… seront
            remplacées automatiquement.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end">
          <Button size="sm" onClick={openNew}>
            <Plus className="size-4" /> Nouveau modèle
          </Button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <LayoutTemplate className="size-6 mx-auto text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              Aucun modèle. Créez votre premier modèle pour gagner du temps.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {templates.map((t) => (
              <Card key={t.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{t.name}</div>
                    {t.description && (
                      <div className="text-sm text-muted-foreground truncate">
                        {t.description}
                      </div>
                    )}
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">
                        {formatCurrency(t.defaultAmount, t.currency)}
                      </span>
                      <span>·</span>
                      <span>Créé le {formatDate(t.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      onClick={() => openEdit(t)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                      onClick={() => setDeleteTarget(t)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Edit / create template */}
      <Dialog
        open={editOpen}
        onOpenChange={(o) => {
          if (!saving) setEditOpen(o);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Modifier le modèle" : "Nouveau modèle"}
            </DialogTitle>
            <DialogDescription>
              Les variables <code>{"{{client_name}}"}</code>,{" "}
              <code>{"{{company_name}}"}</code>,{" "}
              <code>{"{{project_name}}"}</code>, <code>{"{{amount}}"}</code>,{" "}
              <code>{"{{start_date}}"}</code>, <code>{"{{end_date}}"}</code> sont remplacées à
              l&apos;instanciation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">Nom *</Label>
              <Input
                id="tpl-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Contrat de prestation standard"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tpl-desc">Description</Label>
              <Input
                id="tpl-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Idéal pour les missions de conseil…"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tpl-content">Contenu *</Label>
              <Textarea
                id="tpl-content"
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                rows={10}
                placeholder={"# Contrat de prestation\n\nEntre {{company_name}} et {{client_name}}…"}
                className="font-mono text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tpl-amount">Montant par défaut</Label>
                <Input
                  id="tpl-amount"
                  type="number"
                  min={0}
                  step="any"
                  value={form.defaultAmount}
                  onChange={(e) => setForm((f) => ({ ...f, defaultAmount: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Devise</Label>
                <Select
                  value={form.currency}
                  onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Enregistrement…" : editing ? "Mettre à jour" : "Créer le modèle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete template */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && !deleting && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le modèle ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le modèle <strong>{deleteTarget?.name}</strong> sera définitivement supprimé.
              Les contrats déjà créés à partir de ce modèle ne seront pas affectés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void remove();
              }}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? "Suppression…" : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
