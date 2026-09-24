"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  formatCurrency,
  formatDate,
  INVOICE_STATUS_LABELS,
  INVOICE_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  STATUS_COLOR,
} from "@/lib/format";
import type { Invoice, Client, Payment, InvoiceItem } from "@/lib/types";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
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
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
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
  ArrowLeft,
  Send,
  Link as LinkIcon,
  CreditCard,
  Pencil,
  Trash2,
  Check,
  FileText,
  User,
  Building2,
  Calendar,
  Mail,
  Copy,
} from "lucide-react";

import { PrintButton } from "@/components/shared/PrintButton";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type InvoiceDetail = Invoice & {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  paidAmount: number;
  balance: number;
};

const STEPS: { key: string; label: string }[] = [
  { key: "DRAFT", label: "Brouillon" },
  { key: "SENT", label: "Envoyée" },
  { key: "VIEWED", label: "Consultée" },
  { key: "PAID", label: "Payée" },
];

function portalLink(token: string | null | undefined): string {
  if (!token) return "";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/?portal=invoice&token=${token}`;
}

function clientFull(c: Client | undefined | null): string {
  if (!c) return "—";
  return `${c.firstName} ${c.lastName}`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function InvoiceDetail() {
  const { org, params, navigate, tick, bump } = useStore();
  const { toast } = useToast();
  const currency = org?.currency || "XOF";
  const id = params.id;

  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    api
      .get<InvoiceDetail>(`/api/invoices/${id}`)
      .then((data) => {
        if (!active) return;
        setInvoice(data);
        setError(null);
        setLoading(false);
      })
      .catch((e) => {
        if (!active) return;
        const msg = e instanceof ApiError ? e.message : "Facture introuvable";
        setError(msg);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, tick]);

  async function handleSend() {
    if (!invoice) return;
    try {
      const res = await api.post<{ publicToken: string }>(`/api/invoices/${invoice.id}/send`);
      const link = portalLink(res.publicToken);
      await navigator.clipboard?.writeText(link).catch(() => {});
      toast({
        title: "Facture envoyée",
        description: "Lien du portail copié dans le presse-papiers.",
      });
      bump();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur lors de l'envoi";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    }
  }

  function copyLink() {
    if (!invoice?.publicToken) return;
    const link = portalLink(invoice.publicToken);
    navigator.clipboard?.writeText(link).catch(() => {});
    toast({ title: "Lien copié", description: link });
  }

  async function handleDelete() {
    if (!invoice) return;
    try {
      await api.del(`/api/invoices/${invoice.id}`);
      toast({ title: "Facture supprimée" });
      navigate("invoices");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <Card>
        <CardContent className="p-10 flex flex-col items-center text-center gap-3">
          <div className="h-14 w-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
            <FileText className="h-7 w-7" />
          </div>
          <div className="font-semibold">{error || "Facture introuvable"}</div>
          <Button variant="outline" onClick={() => navigate("invoices")}>
            <ArrowLeft className="h-4 w-4" /> Retour aux factures
          </Button>
        </CardContent>
      </Card>
    );
  }

  const paidPct =
    invoice.total > 0 ? Math.min(100, Math.round((invoice.paidAmount / invoice.total) * 100)) : 0;
  const overdue =
    invoice.dueDate &&
    invoice.status !== "PAID" &&
    invoice.status !== "CANCELED" &&
    invoice.status !== "DRAFT" &&
    new Date(invoice.dueDate).getTime() < Date.now();

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex items-center gap-2 no-print">
        <Button variant="ghost" size="sm" onClick={() => navigate("invoices")}>
          <ArrowLeft className="h-4 w-4" /> Factures
        </Button>
      </div>

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 no-print">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight">{invoice.number}</h2>
            <Badge className={STATUS_COLOR[invoice.status] || "bg-muted text-muted-foreground"}>
              {INVOICE_STATUS_LABELS[invoice.status] || invoice.status}
            </Badge>
            <Badge variant="outline" className="bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
              {INVOICE_TYPE_LABELS[invoice.type] || invoice.type}
            </Badge>
            {overdue && (
              <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
                En retard
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {invoice.client ? clientFull(invoice.client) : "—"} · Émise le {formatDate(invoice.issueDate)}
            {invoice.dueDate ? ` · Échéance ${formatDate(invoice.dueDate)}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <PrintButton title={`Facture ${invoice.number}`} />
          {invoice.status === "DRAFT" && (
            <Button onClick={handleSend}>
              <Send className="h-4 w-4" /> Envoyer au client
            </Button>
          )}
          {(invoice.status === "SENT" || invoice.status === "VIEWED" || invoice.status === "PARTIALLY_PAID" || invoice.status === "OVERDUE") && (
            <Button variant="outline" onClick={copyLink} disabled={!invoice.publicToken}>
              <LinkIcon className="h-4 w-4" /> Copier le lien
            </Button>
          )}
          <Button variant="outline" onClick={() => setPayOpen(true)}>
            <CreditCard className="h-4 w-4" /> Enregistrer un paiement
          </Button>
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" /> Modifier
          </Button>
          <Button variant="outline" onClick={() => setDeleteOpen(true)} className="text-rose-600 hover:text-rose-700">
            <Trash2 className="h-4 w-4" /> Supprimer
          </Button>
        </div>
      </div>

      {/* Status stepper */}
      <Card className="no-print">
        <CardContent className="p-6">
          <StatusStepper status={invoice.status} />
        </CardContent>
      </Card>

      {/* Printable invoice body — From/To + Items + Totals + Notes */}
      <div className="print-area grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left col: From/To + Items + Totals */}
        <div className="lg:col-span-2 space-y-6">
          {/* From / To */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> De
                </div>
                <div className="font-semibold">{org?.name || "Mon organisation"}</div>
                {org?.address && <div className="text-sm text-muted-foreground whitespace-pre-line">{org.address}</div>}
                {org?.email && <div className="text-sm text-muted-foreground">{org.email}</div>}
                {org?.phone && <div className="text-sm text-muted-foreground">{org.phone}</div>}
                {org?.taxId && <div className="text-xs text-muted-foreground">N° fiscal : {org.taxId}</div>}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
                  <User className="h-3 w-3" /> À
                </div>
                <div className="font-semibold">{invoice.client ? clientFull(invoice.client) : "—"}</div>
                {invoice.client?.company && (
                  <div className="text-sm text-muted-foreground">{invoice.client.company}</div>
                )}
                {invoice.client?.address && (
                  <div className="text-sm text-muted-foreground whitespace-pre-line">{invoice.client.address}</div>
                )}
                {invoice.client?.email && (
                  <div className="text-sm text-muted-foreground">{invoice.client.email}</div>
                )}
                {invoice.client?.phone && (
                  <div className="text-sm text-muted-foreground">{invoice.client.phone}</div>
                )}
                {invoice.client?.taxId && (
                  <div className="text-xs text-muted-foreground">N° fiscal : {invoice.client.taxId}</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Items table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Désignation</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Qté</TableHead>
                    <TableHead className="text-right">P.U.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(invoice.items || []).map((it: InvoiceItem) => (
                    <TableRow key={it.id}>
                      <TableCell className="font-medium">{it.title}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[280px]">
                        {it.description || "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{it.qty}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(it.unitPrice, currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatCurrency((it.qty || 0) * (it.unitPrice || 0), currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(invoice.items || []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                        Aucune ligne
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Notes / Terms */}
          {(invoice.notes || invoice.terms) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {invoice.notes && (
                <Card>
                  <CardContent className="p-4 space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</div>
                    <div className="text-sm whitespace-pre-line">{invoice.notes}</div>
                  </CardContent>
                </Card>
              )}
              {invoice.terms && (
                <Card>
                  <CardContent className="p-4 space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Conditions</div>
                    <div className="text-sm whitespace-pre-line">{invoice.terms}</div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Right col: Totals + Payments */}
        <div className="space-y-6">
          {/* Totals */}
          <Card>
            <CardContent className="p-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sous-total</span>
                <span className="tabular-nums">{formatCurrency(invoice.subtotal, currency)}</span>
              </div>
              {invoice.discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Remise ({invoice.discount}%)</span>
                  <span className="tabular-nums text-rose-600">-{formatCurrency(invoice.discountAmount, currency)}</span>
                </div>
              )}
              {invoice.taxAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">TVA ({invoice.taxRate}%)</span>
                  <span className="tabular-nums">{formatCurrency(invoice.taxAmount, currency)}</span>
                </div>
              )}
              <Separator className="my-2" />
              <div className="flex justify-between items-center">
                <span className="font-semibold">Total</span>
                <span className="text-2xl font-bold tabular-nums">
                  {formatCurrency(invoice.total, currency)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Payments summary */}
          <Card>
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Paiements</div>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  {paidPct}%
                </Badge>
              </div>
              <Progress value={paidPct} className="h-2" />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Montant payé</span>
                <span className="tabular-nums font-medium text-emerald-600">
                  {formatCurrency(invoice.paidAmount, currency)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Reste à payer</span>
                <span className="tabular-nums font-medium text-amber-600">
                  {formatCurrency(invoice.balance, currency)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Public link */}
          {invoice.publicToken && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Lien du portail client
                </div>
                <div className="flex items-center gap-2">
                  <Input readOnly value={portalLink(invoice.publicToken)} className="text-xs" />
                  <Button size="icon" variant="outline" onClick={copyLink} aria-label="Copier">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Payments list */}
      <Card className="no-print">
        <CardContent className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold">Historique des paiements</div>
            <Button size="sm" variant="outline" onClick={() => setPayOpen(true)}>
              <CreditCard className="h-3.5 w-3.5" /> Enregistrer un paiement
            </Button>
          </div>
          {(invoice.payments || []).length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Aucun paiement enregistré pour l&apos;instant.
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto -mx-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Méthode</TableHead>
                    <TableHead>Référence</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(invoice.payments || []).map((p: Payment) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {formatDate(p.paidAt, true)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatCurrency(p.amount, currency)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {PAYMENT_METHOD_LABELS[p.method] || p.method}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.reference || "—"}</TableCell>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      {editOpen && (
        <EditInvoiceDialog
          invoice={invoice}
          currency={currency}
          onClose={() => setEditOpen(false)}
          onDone={() => {
            setEditOpen(false);
            bump();
          }}
        />
      )}

      {/* Record payment dialog */}
      {payOpen && (
        <RecordPaymentDialog
          invoice={invoice}
          currency={currency}
          onClose={() => setPayOpen(false)}
          onDone={() => {
            setPayOpen(false);
            bump();
          }}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la facture {invoice.number} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La facture, ses lignes et les paiements associés seront supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={handleDelete}
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
// Status stepper
// ─────────────────────────────────────────────────────────────────────────────

function StatusStepper({ status }: { status: string }) {
  // Map partial/overdue/canceled to logical positions
  const order = ["DRAFT", "SENT", "VIEWED", "PAID"];
  let currentIndex = order.indexOf(status);
  if (status === "PARTIALLY_PAID") currentIndex = 3; // counts as paid stage (with caveat)
  if (status === "OVERDUE") currentIndex = 2; // stuck at viewed stage
  if (status === "CANCELED") currentIndex = -1;

  return (
    <div>
      <div className="flex items-center justify-between">
        {STEPS.map((step, idx) => {
          const done = idx < currentIndex;
          const current = idx === currentIndex;
          return (
            <div key={step.key} className="flex-1 flex items-center">
              <div className="flex flex-col items-center text-center gap-1.5 flex-1">
                <div
                  className={
                    "h-9 w-9 rounded-full flex items-center justify-center border-2 transition-colors " +
                    (done
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : current
                      ? "bg-primary border-primary text-primary-foreground"
                      : "bg-muted border-border text-muted-foreground")
                  }
                >
                  {done ? <Check className="h-4 w-4" /> : current && status === "OVERDUE" ? <Mail className="h-4 w-4" /> : idx + 1}
                </div>
                <div
                  className={
                    "text-xs font-medium " +
                    (done || current ? "text-foreground" : "text-muted-foreground")
                  }
                >
                  {step.label}
                </div>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={
                    "h-0.5 flex-1 -mt-5 " +
                    (idx < currentIndex ? "bg-emerald-500" : "bg-border")
                  }
                />
              )}
            </div>
          );
        })}
      </div>
      {status === "OVERDUE" && (
        <div className="mt-3 text-xs text-rose-600 text-center">
          Cette facture est en retard. Pensez à relancer le client.
        </div>
      )}
      {status === "PARTIALLY_PAID" && (
        <div className="mt-3 text-xs text-amber-600 text-center">
          Paiement partiel reçu. Solde restant à encaisser.
        </div>
      )}
      {status === "CANCELED" && (
        <div className="mt-3 text-xs text-rose-600 text-center">Facture annulée.</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit invoice dialog
// ─────────────────────────────────────────────────────────────────────────────

function EditInvoiceDialog({
  invoice,
  currency,
  onClose,
  onDone,
}: {
  invoice: InvoiceDetail;
  currency: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [issueDate, setIssueDate] = useState(
    invoice.issueDate ? new Date(invoice.issueDate).toISOString().slice(0, 10) : "",
  );
  const [dueDate, setDueDate] = useState(
    invoice.dueDate ? new Date(invoice.dueDate).toISOString().slice(0, 10) : "",
  );
  const [notes, setNotes] = useState(invoice.notes || "");
  const [terms, setTerms] = useState(invoice.terms || "");
  const [discount, setDiscount] = useState(String(invoice.discount || 0));
  const [taxRate, setTaxRate] = useState(String(invoice.taxRate || 0));
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.patch(`/api/invoices/${invoice.id}`, {
        issueDate: issueDate ? new Date(issueDate).toISOString() : undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        notes: notes || undefined,
        terms: terms || undefined,
        discount: Number(discount) || 0,
        taxRate: Number(taxRate) || 0,
      });
      toast({ title: "Facture mise à jour" });
      onDone();
    } catch (e2) {
      const msg = e2 instanceof ApiError ? e2.message : "Erreur";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifier la facture {invoice.number}</DialogTitle>
          <DialogDescription>
            Ajustez les dates, la TVA, la remise et les notes. Les lignes se modifient via l&apos;API dédiée.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date d&apos;émission</Label>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Échéance</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Remise (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>TVA (%)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>Conditions</Label>
            <Textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Annuler
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Mise à jour…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Record payment dialog
// ─────────────────────────────────────────────────────────────────────────────

function RecordPaymentDialog({
  invoice,
  currency,
  onClose,
  onDone,
}: {
  invoice: InvoiceDetail;
  currency: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [amount, setAmount] = useState(String(Math.max(0, invoice.balance || 0)));
  const [method, setMethod] = useState<"CASH" | "TRANSFER" | "CARD" | "MOBILE_MONEY" | "OTHER">("TRANSFER");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!Number(amount) || Number(amount) <= 0) {
      toast({ title: "Montant invalide", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/api/payments", {
        clientId: invoice.clientId,
        invoiceId: invoice.id,
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
    <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enregistrer un paiement</DialogTitle>
          <DialogDescription>
            Facture {invoice.number} · Solde restant : {formatCurrency(invoice.balance, currency)}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Montant</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
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
    </Dialog>
  );
}
