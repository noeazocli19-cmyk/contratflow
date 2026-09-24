"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  FileText,
  Send,
  Trash2,
  MoreVertical,
  Loader2,
  Eye,
  Inbox,
} from "lucide-react";

import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import {
  formatCurrency,
  formatDate,
  PROPOSAL_STATUS_LABELS,
  STATUS_COLOR,
} from "@/lib/format";
import type { Client, Proposal } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ItemDraft = {
  id: string;
  title: string;
  description: string;
  qty: number;
  unitPrice: number;
};

type FormState = {
  clientId: string;
  title: string;
  problem: string;
  solution: string;
  deliverables: string;
  timeline: string;
  amount: string;
  currency: string;
  validUntil: string;
  conditions: string;
  notes: string;
  items: ItemDraft[];
};

const CURRENCIES = ["XOF", "XAF", "EUR", "USD", "GBP"];

const STATUS_TABS: { key: string; label: string }[] = [
  { key: "all", label: "Toutes" },
  ...Object.entries(PROPOSAL_STATUS_LABELS).map(([key, label]) => ({
    key,
    label,
  })),
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function clientName(c?: Client | null): string {
  if (!c) return "—";
  const full = `${c.firstName} ${c.lastName}`.trim();
  return c.company ? `${full} · ${c.company}` : full;
}

function itemsSubtotal(items: { qty: number; unitPrice: number }[]): number {
  return items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0);
}

function publicLink(token: string): string {
  if (typeof window === "undefined") return `?portal=proposal&token=${token}`;
  return `${window.location.origin}/?portal=proposal&token=${token}`;
}

export default function Proposals() {
  const { org, navigate, tick, bump } = useStore();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [tab, setTab] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const currency = org?.currency || "XOF";

  const emptyForm: FormState = {
    clientId: "",
    title: "",
    problem: "",
    solution: "",
    deliverables: "",
    timeline: "",
    amount: "",
    currency,
    validUntil: "",
    conditions: "",
    notes: "",
    items: [],
  };
  const [form, setForm] = useState<FormState>(emptyForm);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<Proposal[]>("/api/proposals");
      setProposals(data || []);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur lors du chargement";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function loadClients() {
    setClientsLoading(true);
    try {
      const data = await api.get<Client[]>("/api/clients");
      setClients(data || []);
    } catch {
      /* ignore */
    } finally {
      setClientsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [tick]);

  useEffect(() => {
    if (dialogOpen && clients.length === 0) void loadClients();
  }, [dialogOpen, clients.length]);

  const filtered = useMemo(() => {
    if (tab === "all") return proposals;
    return proposals.filter((p) => p.status === tab);
  }, [proposals, tab]);

  const subtotal = itemsSubtotal(form.items);

  function openCreate() {
    setForm({ ...emptyForm, currency });
    setDialogOpen(true);
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addItem() {
    setForm((f) => ({
      ...f,
      items: [
        ...f.items,
        { id: uid(), title: "", description: "", qty: 1, unitPrice: 0 },
      ],
    }));
  }

  function updateItem(id: string, patch: Partial<ItemDraft>) {
    setForm((f) => ({
      ...f,
      items: f.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    }));
  }

  function removeItem(id: string) {
    setForm((f) => ({ ...f, items: f.items.filter((it) => it.id !== id) }));
  }

  async function submit() {
    if (!form.clientId) {
      toast({ title: "Client requis", variant: "destructive" });
      return;
    }
    if (!form.title.trim()) {
      toast({ title: "Titre requis", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        clientId: form.clientId,
        title: form.title.trim(),
        problem: form.problem || null,
        solution: form.solution || null,
        deliverables: form.deliverables || null,
        timeline: form.timeline || null,
        amount: form.amount ? Number(form.amount) : subtotal,
        currency: form.currency,
        conditions: form.conditions || null,
        validUntil: form.validUntil ? new Date(form.validUntil).toISOString() : null,
        notes: form.notes || null,
        items: form.items
          .filter((it) => it.title.trim() !== "")
          .map((it) => ({
            title: it.title.trim(),
            description: it.description || null,
            qty: Number(it.qty) || 0,
            unitPrice: Number(it.unitPrice) || 0,
          })),
      };
      const created = await api.post<Proposal>("/api/proposals", payload);
      toast({ title: "Proposition créée", description: created.number });
      setDialogOpen(false);
      bump();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur lors de la création";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function sendProposal(p: Proposal) {
    try {
      const res = await api.post<{ publicToken: string }>(
        `/api/proposals/${p.id}/send`,
      );
      const link = publicLink(res.publicToken);
      try {
        await navigator.clipboard.writeText(link);
        toast({
          title: "Proposition envoyée",
          description: "Lien public copié dans le presse-papiers",
        });
      } catch {
        toast({ title: "Proposition envoyée", description: link });
      }
      bump();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur lors de l'envoi";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.del(`/api/proposals/${deleteId}`);
      toast({ title: "Proposition supprimée" });
      setDeleteId(null);
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
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <h2 className="text-xl font-semibold">Propositions</h2>
          <p className="text-sm text-muted-foreground">
            Rédigez, envoyez et suivez vos propositions commerciales.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nouvelle proposition
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          {STATUS_TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState onCreate={openCreate} />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numéro</TableHead>
                    <TableHead>Titre</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Envoyée</TableHead>
                    <TableHead>Créée</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer"
                      onClick={() => navigate("proposal-detail", { id: p.id })}
                    >
                      <TableCell className="font-mono text-xs">{p.number}</TableCell>
                      <TableCell className="font-medium">{p.title}</TableCell>
                      <TableCell>{clientName(p.client)}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(p.amount, p.currency || currency)}
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLOR[p.status]} variant="outline">
                          {PROPOSAL_STATUS_LABELS[p.status] || p.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(p.sentAt)}</TableCell>
                      <TableCell>{formatDate(p.createdAt)}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <RowActions
                          proposal={p}
                          onSend={sendProposal}
                          onDelete={(id) => setDeleteId(id)}
                          onOpen={(id) => navigate("proposal-detail", { id })}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y">
              {filtered.map((p) => (
                <div
                  key={p.id}
                  className="p-4 cursor-pointer hover:bg-muted/40"
                  onClick={() => navigate("proposal-detail", { id: p.id })}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{p.title}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {p.number}
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
                        {clientName(p.client)}
                      </div>
                    </div>
                    <Badge className={STATUS_COLOR[p.status]} variant="outline">
                      {PROPOSAL_STATUS_LABELS[p.status] || p.status}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">
                      {formatCurrency(p.amount, p.currency || currency)}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          void sendProposal(p);
                        }}
                      >
                        <Send className="h-3.5 w-3.5" /> Envoyer
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(p.id);
                        }}
                        aria-label="Supprimer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Envoyée {formatDate(p.sentAt)} · Créée {formatDate(p.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvelle proposition</DialogTitle>
            <DialogDescription>
              Décrivez le besoin, la solution et le tarif. Le client pourra accepter
              ou refuser via le lien public.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Client *</Label>
                <Select
                  value={form.clientId}
                  onValueChange={(v) => setField("clientId", v)}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        clientsLoading ? "Chargement…" : "Sélectionner un client"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.length === 0 && (
                      <SelectItem value="__none" disabled>
                        Aucun client — créez-en un d&apos;abord
                      </SelectItem>
                    )}
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {clientName(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Titre *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setField("title", e.target.value)}
                  placeholder="Refonte du site web…"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Votre besoin (problème)</Label>
              <Textarea
                rows={3}
                value={form.problem}
                onChange={(e) => setField("problem", e.target.value)}
                placeholder="Décrivez le problème du client…"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Notre solution</Label>
              <Textarea
                rows={3}
                value={form.solution}
                onChange={(e) => setField("solution", e.target.value)}
                placeholder="Décrivez la solution proposée…"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Livrables</Label>
              <Textarea
                rows={3}
                value={form.deliverables}
                onChange={(e) => setField("deliverables", e.target.value)}
                placeholder="Un livrable par ligne"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Planning</Label>
                <Input
                  value={form.timeline}
                  onChange={(e) => setField("timeline", e.target.value)}
                  placeholder="6 semaines"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Valide jusqu&apos;au</Label>
                <Input
                  type="date"
                  value={form.validUntil}
                  onChange={(e) => setField("validUntil", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Montant</Label>
                <Input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setField("amount", e.target.value)}
                  placeholder={String(subtotal || 0)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Devise</Label>
                <Select
                  value={form.currency}
                  onValueChange={(v) => setField("currency", v)}
                >
                  <SelectTrigger>
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

            {/* Items editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Lignes de devis</Label>
                <Button size="sm" variant="outline" onClick={addItem} type="button">
                  <Plus className="h-3.5 w-3.5" /> Ajouter une ligne
                </Button>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {form.items.length === 0 && (
                  <div className="text-xs text-muted-foreground border border-dashed rounded-md p-3 text-center">
                    Aucune ligne. Le montant principal sera utilisé comme tarif total.
                  </div>
                )}
                {form.items.map((it) => (
                  <div
                    key={it.id}
                    className="grid grid-cols-12 gap-2 items-start rounded-md border p-2 bg-muted/20"
                  >
                    <div className="col-span-12 sm:col-span-4 space-y-1">
                      <Input
                        placeholder="Titre de la ligne"
                        value={it.title}
                        onChange={(e) =>
                          updateItem(it.id, { title: e.target.value })
                        }
                        className="h-8 text-sm"
                      />
                      <Input
                        placeholder="Description (optionnel)"
                        value={it.description}
                        onChange={(e) =>
                          updateItem(it.id, { description: e.target.value })
                        }
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <Label className="text-[10px] text-muted-foreground">Qté</Label>
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        value={it.qty}
                        onChange={(e) =>
                          updateItem(it.id, { qty: Number(e.target.value) })
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <Label className="text-[10px] text-muted-foreground">
                        Prix unitaire
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        value={it.unitPrice}
                        onChange={(e) =>
                          updateItem(it.id, { unitPrice: Number(e.target.value) })
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="col-span-3 sm:col-span-3">
                      <Label className="text-[10px] text-muted-foreground">
                        Total ligne
                      </Label>
                      <div className="h-8 flex items-center text-sm font-medium">
                        {formatCurrency(
                          (it.qty || 0) * (it.unitPrice || 0),
                          form.currency,
                        )}
                      </div>
                    </div>
                    <div className="col-span-1 flex items-end justify-end h-8">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-rose-600"
                        onClick={() => removeItem(it.id)}
                        type="button"
                        aria-label="Supprimer la ligne"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {form.items.length > 0 && (
                <div className="flex justify-end">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Sous-total : </span>
                    <span className="font-semibold">
                      {formatCurrency(subtotal, form.currency)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label>Conditions</Label>
              <Textarea
                rows={2}
                value={form.conditions}
                onChange={(e) => setField("conditions", e.target.value)}
                placeholder="Acompte 30%, solde à la livraison…"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Notes internes</Label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                placeholder="Notes non visibles par le client…"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Créer la proposition
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette proposition ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive. La proposition et ses lignes seront
              supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={deleting}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RowActions({
  proposal,
  onSend,
  onDelete,
  onOpen,
}: {
  proposal: Proposal;
  onSend: (p: Proposal) => void;
  onDelete: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Actions">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={() => onOpen(proposal.id)}>
          <Eye className="h-4 w-4 mr-2" /> Ouvrir
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSend(proposal)}>
          <Send className="h-4 w-4 mr-2" /> Envoyer
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-rose-600"
          onClick={() => onDelete(proposal.id)}
        >
          <Trash2 className="h-4 w-4 mr-2" /> Supprimer
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-10 gap-3">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
        <Inbox className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <div className="font-medium">Aucune proposition</div>
        <p className="text-sm text-muted-foreground">
          Créez votre première proposition commerciale pour suivre son cycle
          d&apos;acceptation.
        </p>
      </div>
      <Button onClick={onCreate}>
        <FileText className="h-4 w-4" /> Nouvelle proposition
      </Button>
    </div>
  );
}
