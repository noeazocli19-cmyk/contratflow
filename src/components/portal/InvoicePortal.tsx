"use client";

import { useEffect, useState, useCallback } from "react";
import { api, ApiError } from "@/lib/api";
import {
  formatCurrency,
  formatDate,
  initials,
  INVOICE_STATUS_LABELS,
  INVOICE_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import type {
  Invoice,
  InvoiceItem,
  Payment,
  Client,
  Org,
} from "@/lib/types";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  CheckCircle,
  AlertTriangle,
  FileText,
  Printer,
  Building2,
  User,
  CreditCard,
  Receipt,
  Wallet,
  Info,
} from "lucide-react";

type Props = { token: string };

type InvoiceData = {
  invoice: Invoice;
  items: InvoiceItem[];
  payments: Payment[];
  client: Client;
  organization: Org;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  paidAmount: number;
  balance: number;
};

const PAYMENT_METHODS = ["CASH", "TRANSFER", "CARD", "MOBILE_MONEY", "OTHER"];

export default function InvoicePortal({ token }: Props) {
  const { toast } = useToast();
  const [data, setData] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pay form state
  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<string>("TRANSFER");
  const [reference, setReference] = useState("");
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<InvoiceData>(`/api/public/invoice/${token}`);
      setData(res);
      setAmount(String(res.balance > 0 ? res.balance : 0));
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : "Lien invalide ou expiré";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitPay() {
    if (!data) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast({
        title: "Montant invalide",
        description: "Veuillez saisir un montant supérieur à zéro.",
        variant: "destructive",
      });
      return;
    }
    if (amt > data.balance + 0.01) {
      toast({
        title: "Montant trop élevé",
        description: `Le solde restant est ${formatCurrency(
          data.balance,
          data.organization.currency,
        )}.`,
        variant: "destructive",
      });
      return;
    }
    if (!method) {
      toast({
        title: "Méthode requise",
        description: "Veuillez choisir une méthode de paiement.",
        variant: "destructive",
      });
      return;
    }

    setPaying(true);
    try {
      await api.post(`/api/public/invoice/${token}/pay`, {
        method,
        reference: reference.trim() || undefined,
        amount: amt,
      });
      setPaid(true);
      toast({
        title: "Paiement enregistré",
        description: "Merci ! Un reçu vous sera envoyé par e-mail.",
      });
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : "Impossible d'enregistrer le paiement";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setPaying(false);
    }
  }

  // --- Success screen ----------------------------------------------------
  if (paid && data) {
    return (
      <PortalShell
        footer={`Facture envoyée par ${data.organization.name} · ContractFlow`}
      >
        <SuccessCard
          icon={<CheckCircle className="size-12 text-emerald-500" />}
          title="Paiement enregistré !"
          message="Merci. Un reçu vous sera envoyé par e-mail. Votre prestataire confirmera la réception du paiement."
        />
      </PortalShell>
    );
  }

  // --- Error state --------------------------------------------------------
  if (error) {
    return (
      <PortalShell footer="ContractFlow">
        <ErrorCard />
      </PortalShell>
    );
  }

  // --- Loading state ------------------------------------------------------
  if (loading || !data) {
    return (
      <PortalShell footer="ContractFlow">
        <LoadingShell />
      </PortalShell>
    );
  }

  const {
    invoice,
    items,
    payments,
    client,
    organization,
    subtotal,
    discountAmount,
    taxAmount,
    total,
    paidAmount,
    balance,
  } = data;

  const currency = organization.currency;
  const status = invoice.status;
  const clientFullName = [client.firstName, client.lastName]
    .filter(Boolean)
    .join(" ");
  const showPaySection = balance > 0.01 && status !== "PAID";
  const discount = invoice.discount || 0;
  const taxRate = invoice.taxRate || 0;

  return (
    <PortalShell
      footer={`Facture envoyée par ${organization.name} · ContractFlow`}
    >
      <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        {/* Org branding header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <OrgAvatar name={organization.name} logoUrl={organization.logoUrl} />
            <div className="leading-tight">
              <div className="font-semibold text-foreground">
                {organization.name}
              </div>
              <div className="text-xs text-muted-foreground">
                {organization.email ?? "Facture"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="text-xs px-2.5 py-1" variant="secondary">
              {INVOICE_TYPE_LABELS[invoice.type]}
            </Badge>
            <Badge
              className={`${statusBadgeClass(status)} text-xs px-3 py-1`}
              variant="outline"
            >
              {INVOICE_STATUS_LABELS[status]}
            </Badge>
          </div>
        </div>

        {/* Status banner */}
        <StatusBanner invoice={invoice} balance={balance} currency={currency} />

        {/* Main card */}
        <Card className="shadow-sm">
          <CardContent className="px-5 sm:px-8 py-6 sm:py-8 space-y-6">
            {/* Title */}
            <header className="space-y-1">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Facture · {invoice.number}
              </div>
              <div className="flex flex-wrap items-baseline gap-3">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  {formatCurrency(total, currency)}
                </h1>
                <span className="text-sm text-muted-foreground">
                  TTC à régler
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>Émise le {formatDate(invoice.issueDate)}</span>
                {invoice.dueDate && (
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="size-3" />
                    Échéance : {formatDate(invoice.dueDate)}
                  </span>
                )}
              </div>
            </header>

            <Separator />

            {/* De / À */}
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-lg border bg-muted/30 p-4 space-y-1">
                <div className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="size-3.5" /> De
                </div>
                <div className="font-semibold">{organization.name}</div>
                {organization.email && (
                  <div className="text-sm text-muted-foreground">
                    {organization.email}
                  </div>
                )}
                {organization.taxId && (
                  <div className="text-sm text-muted-foreground">
                    N° fiscal : {organization.taxId}
                  </div>
                )}
              </div>
              <div className="rounded-lg border bg-muted/30 p-4 space-y-1">
                <div className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <User className="size-3.5" /> À
                </div>
                <div className="font-semibold">{clientFullName}</div>
                {client.company && (
                  <div className="text-sm text-muted-foreground">
                    {client.company}
                  </div>
                )}
                {client.address && (
                  <div className="text-sm text-muted-foreground">
                    {client.address}
                  </div>
                )}
                {client.email && (
                  <div className="text-sm text-muted-foreground">
                    {client.email}
                  </div>
                )}
              </div>
            </section>

            {/* Items table */}
            {items && items.length > 0 ? (
              <section className="space-y-2.5">
                <h2 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Receipt className="size-4 text-muted-foreground" />
                  Détail des prestations
                </h2>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="text-left font-medium px-3 py-2">Prestation</th>
                        <th className="text-right font-medium px-3 py-2 w-16">Qté</th>
                        <th className="text-right font-medium px-3 py-2 w-32">P.U.</th>
                        <th className="text-right font-medium px-3 py-2 w-32">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it) => (
                        <tr key={it.id} className="border-t">
                          <td className="px-3 py-2.5">
                            <div className="font-medium">{it.title}</div>
                            {it.description && (
                              <div className="text-xs text-muted-foreground">
                                {it.description}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {it.qty}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {formatCurrency(it.unitPrice, currency)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                            {formatCurrency(
                              it.qty * it.unitPrice,
                              currency,
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {/* Totals */}
            <section className="space-y-1.5">
              <TotalRow label="Sous-total" value={formatCurrency(subtotal, currency)} />
              {discount > 0 && (
                <TotalRow
                  label={`Remise (${discount}%)`}
                  value={`− ${formatCurrency(discountAmount, currency)}`}
                  tone="rose"
                />
              )}
              {taxRate > 0 && (
                <TotalRow
                  label={`Taxe (${taxRate}%)`}
                  value={formatCurrency(taxAmount, currency)}
                />
              )}
              <Separator />
              <TotalRow
                label="Total TTC"
                value={formatCurrency(total, currency)}
                emphasize
              />
              <TotalRow
                label="Déjà payé"
                value={formatCurrency(paidAmount, currency)}
                tone="emerald"
              />
              <TotalRow
                label="Reste à payer"
                value={formatCurrency(balance, currency)}
                tone={balance > 0 ? "amber" : "emerald"}
                emphasize
              />
            </section>

            {/* Payment history */}
            {payments && payments.length > 0 ? (
              <section className="space-y-2.5">
                <h2 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Wallet className="size-4 text-muted-foreground" />
                  Historique des paiements ({payments.length})
                </h2>
                <div className="rounded-lg border divide-y">
                  {payments.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5"
                    >
                      <div className="space-y-0.5">
                        <div className="text-sm font-medium">
                          {formatCurrency(p.amount, currency)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                          {p.reference ? ` · ${p.reference}` : ""}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(p.paidAt)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {/* Notes / terms */}
            {invoice.notes?.trim() && (
              <section className="space-y-1.5">
                <h2 className="text-sm font-semibold text-foreground">Notes</h2>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                  {invoice.notes}
                </p>
              </section>
            )}

            <Separator />

            {/* Pay section */}
            {showPaySection ? (
              <PaySection
                amount={amount}
                setAmount={setAmount}
                method={method}
                setMethod={setMethod}
                reference={reference}
                setReference={setReference}
                paying={paying}
                onSubmit={submitPay}
                balance={balance}
                currency={currency}
              />
            ) : (
              <div className="flex items-center gap-2.5 rounded-lg border bg-emerald-50/50 dark:bg-emerald-950/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                <CheckCircle className="size-4" />
                Cette facture est entièrement réglée. Merci !
              </div>
            )}

            {/* Print */}
            <div className="flex justify-center pt-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => window.print()}
                className="text-muted-foreground"
              >
                <Printer className="size-4" />
                Télécharger facture
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
          <FileText className="size-3" />
          Facture {invoice.number} · {organization.name}
        </div>
      </div>
    </PortalShell>
  );
}

// --- Pay section --------------------------------------------------------
function PaySection({
  amount,
  setAmount,
  method,
  setMethod,
  reference,
  setReference,
  paying,
  onSubmit,
  balance,
  currency,
}: {
  amount: string;
  setAmount: (v: string) => void;
  method: string;
  setMethod: (v: string) => void;
  reference: string;
  setReference: (v: string) => void;
  paying: boolean;
  onSubmit: () => void;
  balance: number;
  currency: string;
}) {
  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <CreditCard className="size-4" />
          Régler la facture
        </h2>
        <p className="text-sm text-muted-foreground">
          Indiquez le montant que vous réglez et la méthode utilisée.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="cf-amount">Montant à payer</Label>
          <Input
            id="cf-amount"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-11 tabular-nums"
          />
          <p className="text-xs text-muted-foreground">
            Solde restant : {formatCurrency(balance, currency)}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cf-method">Méthode de paiement</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger id="cf-method" className="h-11 w-full">
              <SelectValue placeholder="Choisir…" />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cf-reference">Référence (facultatif)</Label>
        <Input
          id="cf-reference"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="N° de virement, transaction…"
          className="h-11"
        />
      </div>

      <div className="flex items-start gap-2.5 rounded-md border bg-amber-50/40 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/40 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300">
        <Info className="size-4 mt-0.5 shrink-0" />
        <span>
          Paiement hors-ligne — votre prestataire confirmera la réception et
          vous enverra un reçu.
        </span>
      </div>

      <Button
        size="lg"
        onClick={onSubmit}
        disabled={paying}
        className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white"
      >
        <CreditCard className="size-4" />
        {paying ? "Enregistrement…" : "Enregistrer le paiement"}
      </Button>
    </section>
  );
}

// --- Total row -----------------------------------------------------------
function TotalRow({
  label,
  value,
  emphasize,
  tone,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  tone?: "emerald" | "rose" | "amber";
}) {
  const valueColor =
    tone === "emerald"
      ? "text-emerald-700 dark:text-emerald-400"
      : tone === "rose"
        ? "text-rose-700 dark:text-rose-400"
        : tone === "amber"
          ? "text-amber-700 dark:text-amber-400 font-bold"
          : "";
  return (
    <div
      className={`flex items-center justify-between gap-3 px-1 ${
        emphasize ? "text-base" : "text-sm"
      }`}
    >
      <span
        className={
          emphasize ? "font-semibold text-foreground" : "text-muted-foreground"
        }
      >
        {label}
      </span>
      <span
        className={`tabular-nums ${emphasize ? "font-bold" : "font-medium"} ${valueColor}`}
      >
        {value}
      </span>
    </div>
  );
}

// --- Helpers --------------------------------------------------------------

function PortalShell({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer: string;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <main className="flex-1 flex flex-col">{children}</main>
      <footer className="mt-auto border-t bg-background/80 backdrop-blur py-4 px-4 text-center text-xs text-muted-foreground">
        {footer}
      </footer>
    </div>
  );
}

function OrgAvatar({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl: string | null;
}) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name}
        className="size-10 rounded-lg object-cover"
      />
    );
  }
  return (
    <div className="size-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
      {initials(name) || "CF"}
    </div>
  );
}

function LoadingShell() {
  return (
    <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <Skeleton className="h-6 w-32 rounded-full" />
      </div>
      <Skeleton className="h-20 w-full rounded-lg" />
      <Card>
        <CardContent className="px-5 sm:px-8 py-6 sm:py-8 space-y-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-px w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

function ErrorCard() {
  return (
    <div className="max-w-md mx-auto w-full px-4 py-20">
      <Card className="border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 dark:border-rose-900/40">
        <CardContent className="px-6 py-10 text-center space-y-4">
          <div className="mx-auto size-14 rounded-full bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center">
            <AlertTriangle className="size-7 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Lien invalide ou expiré</h2>
            <p className="text-sm text-muted-foreground">
              Cette facture n'est plus accessible ou le lien est incorrect.
              Contactez votre prestataire pour obtenir un nouveau lien.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SuccessCard({
  icon,
  title,
  message,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
}) {
  return (
    <div className="max-w-md mx-auto w-full px-4 py-20">
      <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900/40">
        <CardContent className="px-6 py-10 text-center space-y-4">
          <div className="mx-auto flex items-center justify-center">
            {icon}
          </div>
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">{message}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBanner({
  invoice,
  balance,
  currency,
}: {
  invoice: Invoice;
  balance: number;
  currency: string;
}) {
  const status = invoice.status;
  let cls = "bg-muted/40 border-border text-foreground";
  let icon = <FileText className="size-4" />;
  let text = "En attente de paiement";

  if (status === "PAID") {
    cls =
      "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-300";
    icon = <CheckCircle className="size-4" />;
    text = `Facture payée le ${formatDate(invoice.paidAt)}`;
  } else if (status === "PARTIALLY_PAID") {
    cls =
      "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-300";
    icon = <AlertTriangle className="size-4" />;
    text = `Partiellement payée — reste ${formatCurrency(balance, currency)}`;
  } else if (status === "OVERDUE") {
    cls =
      "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/30 dark:border-rose-900/50 dark:text-rose-300";
    icon = <AlertTriangle className="size-4" />;
    text = `En retard depuis le ${formatDate(invoice.dueDate)}`;
  } else if (status === "CANCELED") {
    cls =
      "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/30 dark:border-rose-900/50 dark:text-rose-300";
    icon = <AlertTriangle className="size-4" />;
    text = "Facture annulée";
  } else if (status === "DRAFT") {
    cls = "bg-muted/40 border-border text-muted-foreground";
    text = "Brouillon — non envoyée";
  }

  return (
    <div
      className={`flex items-center gap-2.5 rounded-lg border px-4 py-3 text-sm font-medium ${cls}`}
    >
      {icon}
      <span>{text}</span>
    </div>
  );
}

function statusBadgeClass(status: string) {
  const ref: Record<string, string> = {
    DRAFT: "bg-muted text-muted-foreground border-border",
    SENT:
      "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-900/40",
    VIEWED:
      "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900/40",
    PARTIALLY_PAID:
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/40",
    PAID:
      "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40",
    OVERDUE:
      "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/40",
    CANCELED:
      "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/40",
  };
  return ref[status] ?? "bg-muted text-muted-foreground border-border";
}
