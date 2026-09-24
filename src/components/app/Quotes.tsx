"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  FileSpreadsheet,
  Send,
  Trash2,
  MoreVertical,
  Loader2,
  Copy,
  Inbox,
} from "lucide-react";

import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import {
  formatCurrency,
  formatDate,
  QUOTE_STATUS_LABELS,
  STATUS_COLOR,
} from "@/lib/format";
import type { Client, Quote } from "@/lib/types";

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
  expirationDate: string;
  notes: string;
  terms: string;
  discount: string;
  taxRate: string;
  items: ItemDraft[];
};

const STATUS_TABS: { key: string; label: string }[] = [
  { key: "all", label: "Tous" },
  ...Object.entries(QUOTE_STATUS_LABELS).map(([key, label]) => ({ key, label })),
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
  return items.reduce(
    (s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0),
    0,
  );
}

function computeTotals(
  items: { qty: number; unitPrice: number }[],
  discountPct: number,
  taxPct: number,
) {
  const subtotal = itemsSubtotal(items);
  const discountAmount = (subtotal * (discountPct || 0)) / 100;
  const afterDiscount = subtotal - discountAmount;
  const taxAmount = (afterDiscount * (taxPct || 0)) / 100;
  const total = afterDiscount + taxAmount;
  return { subtotal, discountAmount, taxAmount, total };
}

function quoteTotal(q: Quote): number {
  return computeTotals(q.items || [], q.discount || 0, q.taxRate || 0).total;
}

function publicLink(token: string): string {
  if (typeof window === "undefined") return `?portal=quote&token=${token}`;
  return `${window.location.origin}/?portal=quote&token=${token}`;
}

export default function Quotes() {
  const { org, navigate, tick, bump } = useStore();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState<Quote[]>([]);
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
    expirationDate: "",
    notes: "",
    terms: "",
    discount: "0",
    taxRate: "0",
    items: [],
  };
  const [form, setForm] = useState<FormState>(emptyForm);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<Quote[]>("/api/quotes");
      setQuotes(data || []);
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
    if (tab === "all") return quotes;
    return quotes.filter((q) => q.status === tab);
  }, [quotes, tab]);

  const totals = computeTotals(
    form.items,
    Number(form.discount) || 0,
    Number(form.taxRate) || 0,
  );

  function openCreate() {
    setForm({
      ...emptyForm,
      taxRate: String(org?.taxRate || 0),
    });
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
    if (form.items.filter((it) => it.title.trim() !== "").length === 0) {
      toast({ title: "Ajoutez au moins une ligne", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        clientId: form.clientId,
        expirationDate: form.expirationDate
          ? new Date(form.expirationDate).toISOString()
          : null,
        notes: form.notes || null,
        terms: form.terms || null,
        discount: Number(form.discount) || 0,
        taxRate: Number(form.taxRate) || 0,
        items: form.items
          .filter((it) => it.title.trim() !== "")
          .map((it) => ({
            title: it.title.trim(),
            description: it.description || null,
            qty: Number(it.qty) || 0,
            unitPrice: Number(it.unitPrice) || 0,
          })),
      };
      const created = await api.post<Quote>("/api/quotes", payload);
      toast({ title: "Devis créé", description: created.number });
      setDialogOpen(false);
      bump();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur lors de la création";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function sendQuote(q: Quote) {
    try {
      const res = await api.post<{ publicToken: string }>(
        `/api/quotes/${q.id}/send`,
      );
      const link = publicLink(res.publicToken);
      try {
        await navigator.clipboard.writeText(link);
        toast({
          title: "Devis marqué comme envoyé",
          description: "Lien copié dans le presse-papiers",
        });
      } catch {
        toast({ title: "Devis marqué comme envoyé", description: link });
      }
      bump();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur lors de l'envoi";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    }
  }

  async function copyLink(q: Quote) {
    if (!q.publicToken) return;
    const link = publicLink(q.publicToken);
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: "Lien copié", description: link });
    } catch {
      toast({ title: "Lien public", description: link });
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.del(`/api/quotes/${deleteId}`);
      toast({ title: "Devis supprimé" });
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
          <h2 className="text-xl font-semibold">Devis</h2>
          <p className="text-sm text-muted-foreground">
            Établissez des devis détaillés avec remise et TVA.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Nouveau devis
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
                    <TableHead>Client</TableHead>
                    <TableHead>Expiration</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Envoyé</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell className="font-mono text-xs">{q.number}</TableCell>
                      <TableCell>{clientName(q.client)}</TableCell>
                      <TableCell>{formatDate(q.expirationDate)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(quoteTotal(q), currency)}
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLOR[q.status]} variant="outline">
                          {QUOTE_STATUS_LABELS[q.status] || q.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(q.sentAt)}</TableCell>
                      <TableCell>
                        <RowActions
                          quote={q}
                          onSend={sendQuote}
                          onCopy={copyLink}
                          onDelete={(id) => setDeleteId(id)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y">
              {filtered.map((q) => (
                <div key={q.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {q.number}
                      </div>
                      <div className="text-sm font-medium truncate">
                        {clientName(q.client)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Expire {formatDate(q.expirationDate)}
                      </div>
                    </div>
                    <Badge className={STATUS_COLOR[q.status]} variant="outline">
                      {QUOTE_STATUS_LABELS[q.status] || q.status}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">
                      {formatCurrency(quoteTotal(q), currency)}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void sendQuote(q)}
                      >
                        <Send className="h-3.5 w-3.5" /> Envoyer
                      </Button>
                      {q.publicToken && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void copyLink(q)}
                          aria-label="Copier le lien"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteId(q.id)}
                        aria-label="Supprimer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Envoyé {formatDate(q.sentAt)}
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
            <DialogTitle>Nouveau devis</DialogTitle>
            <DialogDescription>
              Renseignez le client, les lignes, la remise et la TVA. Les totaux sont
              calculés automatiquement.
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
                <Label>Date d&apos;expiration</Label>
                <Input
                  type="date"
                  value={form.expirationDate}
                  onChange={(e) => setField("expirationDate", e.target.value)}
                />
              </div>
            </div>

            {/* Items editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Lignes du devis</Label>
                <Button size="sm" variant="outline" onClick={addItem} type="button">
                  <Plus className="h-3.5 w-3.5" /> Ajouter une ligne
                </Button>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {form.items.length === 0 && (
                  <div className="text-xs text-muted-foreground border border-dashed rounded-md p-3 text-center">
                    Aucune ligne. Ajoutez-en au moins une pour créer le devis.
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
                          currency,
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
            </div>

            {/* Discount / tax / totals */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Remise (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  value={form.discount}
                  onChange={(e) => setField("discount", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>TVA (%)</Label>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={form.taxRate}
                  onChange={(e) => setField("taxRate", e.target.value)}
                />
              </div>
            </div>

            <Card className="p-4 bg-muted/30 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sous-total</span>
                <span className="font-medium">
                  {formatCurrency(totals.subtotal, currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Remise ({form.discount || 0}%)
                </span>
                <span className="font-medium text-rose-600">
                  − {formatCurrency(totals.discountAmount, currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  TVA ({form.taxRate || 0}%)
                </span>
                <span className="font-medium">
                  + {formatCurrency(totals.taxAmount, currency)}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="font-semibold">Total</span>
                <span className="text-lg font-semibold">
                  {formatCurrency(totals.total, currency)}
                </span>
              </div>
            </Card>

            <Separator />

            <div className="space-y-1.5">
              <Label>Conditions de paiement</Label>
              <Textarea
                rows={2}
                value={form.terms}
                onChange={(e) => setField("terms", e.target.value)}
                placeholder="Acompte 30% à la commande, solde à la livraison…"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
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
              Créer le devis
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce devis ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive. Le devis et ses lignes seront supprimés.
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
  quote,
  onSend,
  onCopy,
  onDelete,
}: {
  quote: Quote;
  onSend: (q: Quote) => void;
  onCopy: (q: Quote) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Actions">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onSend(quote)}>
          <Send className="h-4 w-4 mr-2" /> Envoyer
        </DropdownMenuItem>
        {quote.publicToken && (
          <DropdownMenuItem onClick={() => onCopy(quote)}>
            <Copy className="h-4 w-4 mr-2" /> Copier le lien
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className="text-rose-600"
          onClick={() => onDelete(quote.id)}
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
        <div className="font-medium">Aucun devis</div>
        <p className="text-sm text-muted-foreground">
          Créez votre premier devis pour le transmettre à votre client.
        </p>
      </div>
      <Button onClick={onCreate}>
        <FileSpreadsheet className="h-4 w-4" /> Nouveau devis
      </Button>
    </div>
  );
}
