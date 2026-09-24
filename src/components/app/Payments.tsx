"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  formatCurrency,
  formatDate,
  PAYMENT_METHOD_LABELS,
} from "@/lib/format";
import type { Payment, Client, Invoice } from "@/lib/types";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  CreditCard,
  Plus,
  MoreHorizontal,
  Eye,
  Trash2,
  Filter,
  Wallet,
  Calendar,
  TrendingUp,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function clientFull(c: Client | undefined | null): string {
  if (!c) return "—";
  return `${c.firstName} ${c.lastName}`.trim();
}

const METHOD_TABS: { value: string; label: string }[] = [
  { value: "ALL", label: "Tous" },
  { value: "CASH", label: PAYMENT_METHOD_LABELS.CASH },
  { value: "TRANSFER", label: PAYMENT_METHOD_LABELS.TRANSFER },
  { value: "CARD", label: PAYMENT_METHOD_LABELS.CARD },
  { value: "MOBILE_MONEY", label: PAYMENT_METHOD_LABELS.MOBILE_MONEY },
  { value: "OTHER", label: PAYMENT_METHOD_LABELS.OTHER },
];

// Invoices eligible for being attached to a payment (owed money)
function isInvoiceEligible(inv: Invoice): boolean {
  return (
    inv.status === "SENT" ||
    inv.status === "VIEWED" ||
    inv.status === "PARTIALLY_PAID" ||
    inv.status === "OVERDUE"
  );
}

function startOfMonth(d = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function Payments() {
  const { org, navigate, tick, bump } = useStore();
  const { toast } = useToast();
  const currency = org?.currency || "XOF";

  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const [methodTab, setMethodTab] = useState("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Payment | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get<Payment[]>("/api/payments").catch(() => [] as Payment[]),
      api.get<Client[]>("/api/clients").catch(() => [] as Client[]),
      api.get<Invoice[]>("/api/invoices").catch(() => [] as Invoice[]),
    ]).then(([p, c, i]) => {
      if (!active) return;
      setPayments(p);
      setClients(c);
      setInvoices(i);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [tick]);

  const clientMap = useMemo(() => {
    const m: Record<string, Client> = {};
    clients.forEach((c) => (m[c.id] = c));
    return m;
  }, [clients]);

  const filtered = useMemo(() => {
    if (methodTab === "ALL") return payments;
    return payments.filter((p) => p.method === methodTab);
  }, [payments, methodTab]);

  const stats = useMemo(() => {
    const total = payments.reduce((s, p) => s + (p.amount || 0), 0);
    const monthStart = startOfMonth().getTime();
    const thisMonth = payments
      .filter((p) => new Date(p.paidAt).getTime() >= monthStart)
      .reduce((s, p) => s + (p.amount || 0), 0);
    const byMethod: Record<string, number> = {};
    payments.forEach((p) => {
      byMethod[p.method] = (byMethod[p.method] || 0) + (p.amount || 0);
    });
    return { total, thisMonth, byMethod };
  }, [payments]);

  async function handleDelete(p: Payment) {
    try {
      await api.del(`/api/payments/${p.id}`);
      toast({ title: "Paiement supprimé" });
      setDeleteTarget(null);
      bump();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Paiements</h2>
          <p className="text-sm text-muted-foreground">
            Enregistrez et suivez les encaissements reçus de vos clients.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" /> Enregistrer un paiement
            </Button>
          </DialogTrigger>
          {createOpen && (
            <RecordPaymentDialog
              clients={clients}
              invoices={invoices.filter(isInvoiceEligible)}
              currency={currency}
              onClose={() => setCreateOpen(false)}
              onDone={() => {
                setCreateOpen(false);
                bump();
              }}
            />
          )}
        </Dialog>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">Total encaissé</div>
              <Wallet className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-semibold text-emerald-600 tabular-nums">
              {formatCurrency(stats.total, currency)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">Ce mois-ci</div>
              <TrendingUp className="h-4 w-4 text-cyan-600" />
            </div>
            <div className="text-2xl font-semibold text-cyan-600 tabular-nums">
              {formatCurrency(stats.thisMonth, currency)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="text-xs text-muted-foreground">Par méthode</div>
            <div className="space-y-1">
              {Object.entries(PAYMENT_METHOD_LABELS).map(([k, label]) => {
                const amount = stats.byMethod[k] || 0;
                if (amount === 0) return null;
                return (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="tabular-nums font-medium">
                      {formatCurrency(amount, currency)}
                    </span>
                  </div>
                );
              })}
              {Object.values(stats.byMethod).every((v) => !v) && (
                <div className="text-xs text-muted-foreground">Aucun paiement</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter tabs */}
      <Tabs value={methodTab} onValueChange={setMethodTab}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <TabsList className="overflow-x-auto">
            {METHOD_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <Filter className="h-3 w-3" /> {filtered.length} paiement(s)
          </div>
        </div>
      </Tabs>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-10 flex flex-col items-center text-center gap-3">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <CreditCard className="h-10 w-10" />
            </div>
            <div>
              <div className="font-semibold">Aucun paiement</div>
              <div className="text-sm text-muted-foreground max-w-md mt-1">
                Enregistrez votre premier paiement pour suivre vos encaissements.
              </div>
            </div>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> Enregistrer un paiement
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Facture</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Méthode</TableHead>
                    <TableHead>Référence</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {formatDate(p.paidAt)}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {clientFull(clientMap[p.clientId] || p.client)}
                      </TableCell>
                      <TableCell>
                        {p.invoiceId ? (
                          <button
                            className="font-medium text-primary hover:underline"
                            onClick={() => navigate("invoice-detail", { id: p.invoiceId! })}
                          >
                            {p.invoice?.number || "Voir"}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatCurrency(p.amount, currency)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {PAYMENT_METHOD_LABELS[p.method] || p.method}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[180px] truncate">
                        {p.reference || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            p.status === "CONFIRMED"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                              : p.status === "PENDING"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                              : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                          }
                        >
                          {p.status === "CONFIRMED" ? "Confirmé" : p.status === "PENDING" ? "En attente" : "Échec"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {p.invoiceId && (
                              <DropdownMenuItem onClick={() => navigate("invoice-detail", { id: p.invoiceId! })}>
                                <Eye className="h-4 w-4" /> Voir facture
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setDeleteTarget(p)}
                            >
                              <Trash2 className="h-4 w-4" /> Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((p) => (
              <Card key={p.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">
                        {formatCurrency(p.amount, currency)}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {clientFull(clientMap[p.clientId] || p.client)}
                      </div>
                    </div>
                    <Badge
                      className={
                        p.status === "CONFIRMED"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                          : p.status === "PENDING"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                          : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                      }
                    >
                      {p.status === "CONFIRMED" ? "Confirmé" : p.status === "PENDING" ? "En attente" : "Échec"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline">
                      {PAYMENT_METHOD_LABELS[p.method] || p.method}
                    </Badge>
                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {formatDate(p.paidAt)}
                    </span>
                  </div>
                  {p.reference && (
                    <div className="text-xs text-muted-foreground truncate">Réf. {p.reference}</div>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {p.invoiceId && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate("invoice-detail", { id: p.invoiceId! })}
                      >
                        <Eye className="h-3.5 w-3.5" /> Facture
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-rose-600"
                      onClick={() => setDeleteTarget(p)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Supprimer
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce paiement ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  Paiement de {formatCurrency(deleteTarget.amount, currency)} du{" "}
                  {formatDate(deleteTarget.paidAt)}{deleteTarget.invoiceId ? " rattaché à une facture" : ""}.
                  Cette action est irréversible.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Record payment dialog
// ─────────────────────────────────────────────────────────────────────────────

function RecordPaymentDialog({
  clients,
  invoices,
  currency,
  onClose,
  onDone,
}: {
  clients: Client[];
  invoices: Invoice[];
  currency: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [clientId, setClientId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"CASH" | "TRANSFER" | "CARD" | "MOBILE_MONEY" | "OTHER">("TRANSFER");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  const filteredInvoices = useMemo(
    () => (clientId ? invoices.filter((i) => i.clientId === clientId) : invoices),
    [invoices, clientId],
  );

  // When invoice selected, default amount to invoice total
  function onSelectInvoice(id: string) {
    setInvoiceId(id);
    if (id) {
      const inv = invoices.find((i) => i.id === id);
      if (inv && !amount) {
        setAmount(String(computeInvTotal(inv)));
      }
    }
  }

  function computeInvTotal(inv: Invoice): number {
    const subtotal = (inv.items || []).reduce((s, it) => s + (it.qty || 0) * (it.unitPrice || 0), 0);
    const discountAmount = subtotal * ((inv.discount || 0) / 100);
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = afterDiscount * ((inv.taxRate || 0) / 100);
    return afterDiscount + taxAmount;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) {
      toast({ title: "Client requis", variant: "destructive" });
      return;
    }
    if (!Number(amount) || Number(amount) <= 0) {
      toast({ title: "Montant invalide", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/api/payments", {
        clientId,
        invoiceId: invoiceId || undefined,
        amount: Number(amount),
        method,
        reference: reference || undefined,
        note: note || undefined,
        paidAt: paidAt ? new Date(paidAt).toISOString() : undefined,
      });
      toast({ title: "Paiement enregistré" });
      onDone();
    } catch (e2) {
      const msg = e2 instanceof ApiError ? e2.message : "Erreur";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
      <DialogHeader>
        <DialogTitle>Enregistrer un paiement</DialogTitle>
        <DialogDescription>
          Renseignez le client, le montant et la méthode. Lier à une facture mettra à jour son statut.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <Label>Client *</Label>
          <Select value={clientId} onValueChange={(v) => { setClientId(v); setInvoiceId(""); }}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Sélectionner…" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {clientFull(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Facture (optionnel)</Label>
          <Select value={invoiceId} onValueChange={onSelectInvoice}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Aucune</SelectItem>
              {filteredInvoices.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Seules les factures envoyées / en cours / en retard sont proposées.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>Montant *</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Méthode</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Référence</Label>
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="N° de transaction"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Note</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optionnel" />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Annuler
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
