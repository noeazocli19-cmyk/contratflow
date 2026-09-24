"use client";

import { useEffect, useState, useCallback } from "react";
import { api, ApiError } from "@/lib/api";
import {
  formatCurrency,
  formatDate,
  initials,
  QUOTE_STATUS_LABELS,
} from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import type { Quote, QuoteItem, Client, Org } from "@/lib/types";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Printer,
  Building2,
  User,
  Calendar,
  Receipt,
} from "lucide-react";

type Props = { token: string };

type QuoteData = {
  quote: Quote;
  items: QuoteItem[];
  client: Client;
  organization: Org;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
};

type Decision = "ACCEPT" | "REFUSE" | null;

export default function QuotePortal({ token }: Props) {
  const { toast } = useToast();
  const [data, setData] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [acceptOpen, setAcceptOpen] = useState(false);
  const [refuseOpen, setRefuseOpen] = useState(false);
  const [acceptMessage, setAcceptMessage] = useState("");
  const [refuseReason, setRefuseReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [decision, setDecision] = useState<Decision>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<QuoteData>(`/api/public/quote/${token}`);
      setData(res);
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

  async function submitAccept() {
    setSubmitting(true);
    try {
      await api.post(`/api/public/quote/${token}/accept`, {
        decision: "ACCEPT",
        message: acceptMessage.trim() || undefined,
      });
      setDecision("ACCEPT");
      setAcceptOpen(false);
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : "Impossible d'enregistrer votre réponse";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function submitRefuse() {
    if (!refuseReason.trim()) {
      toast({
        title: "Indiquez une raison",
        description: "Une brève raison nous aide à améliorer notre offre.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/api/public/quote/${token}/accept`, {
        decision: "REFUSE",
        message: refuseReason.trim(),
      });
      setDecision("REFUSE");
      setRefuseOpen(false);
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : "Impossible d'enregistrer votre réponse";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  // --- Success screens ----------------------------------------------------
  if (decision === "ACCEPT") {
    return (
      <PortalShell
        footer={`Devis envoyé par ${data?.organization?.name ?? "ContractFlow"} · ContractFlow`}
      >
        <DecisionSuccessCard
          tone="emerald"
          icon={<CheckCircle className="size-12 text-emerald-500" />}
          title="Devis accepté !"
          message="Merci. Votre prestataire revient vers vous très prochainement pour démarrer la collaboration."
        />
      </PortalShell>
    );
  }
  if (decision === "REFUSE") {
    return (
      <PortalShell
        footer={`Devis envoyé par ${data?.organization?.name ?? "ContractFlow"} · ContractFlow`}
      >
        <DecisionSuccessCard
          tone="rose"
          icon={<XCircle className="size-12 text-rose-500" />}
          title="Réponse enregistrée"
          message="Votre refus a bien été enregistré. Merci pour votre retour."
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

  const { quote, items, client, organization, subtotal, discountAmount, taxAmount, total } =
    data;
  const status = quote.status;
  const canDecide = status === "SENT" || status === "VIEWED";
  const clientFullName = [client.firstName, client.lastName]
    .filter(Boolean)
    .join(" ");
  const currency = organization.currency;
  const discount = quote.discount || 0;
  const taxRate = quote.taxRate || 0;

  return (
    <PortalShell
      footer={`Devis envoyé par ${organization.name} · ContractFlow`}
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
                {organization.email ?? "Devis commercial"}
              </div>
            </div>
          </div>
          <Badge
            className={`${statusBadgeClass(status)} text-xs px-3 py-1`}
            variant="outline"
          >
            {QUOTE_STATUS_LABELS[status]}
          </Badge>
        </div>

        {/* Status banner */}
        <StatusBanner quote={quote} />

        {/* Main card */}
        <Card className="shadow-sm">
          <CardContent className="px-5 sm:px-8 py-6 sm:py-8 space-y-6">
            {/* Title */}
            <header className="space-y-1">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Devis · {quote.number}
              </div>
              <div className="flex flex-wrap items-baseline gap-3">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  {formatCurrency(total, currency)}
                </h1>
                <span className="text-sm text-muted-foreground">TTC</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>Émis le {formatDate(quote.issueDate)}</span>
                {quote.expirationDate && (
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3" />
                    Valide jusqu&apos;au {formatDate(quote.expirationDate)}
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
                {organization.phone && (
                  <div className="text-sm text-muted-foreground">
                    {organization.phone}
                  </div>
                )}
                {organization.address && (
                  <div className="text-sm text-muted-foreground">
                    {organization.address}
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
                {client.email && (
                  <div className="text-sm text-muted-foreground">
                    {client.email}
                  </div>
                )}
                {client.address && (
                  <div className="text-sm text-muted-foreground">
                    {client.address}
                    {client.country ? `, ${client.country}` : ""}
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
                            {formatCurrency(it.qty * it.unitPrice, currency)}
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
                  value={`+ ${formatCurrency(taxAmount, currency)}`}
                />
              )}
              <Separator />
              <TotalRow
                label="Total TTC"
                value={formatCurrency(total, currency)}
                emphasize
              />
            </section>

            {/* Notes / terms */}
            {quote.notes?.trim() && (
              <section className="space-y-1.5">
                <h2 className="text-sm font-semibold text-foreground">Notes</h2>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                  {quote.notes}
                </p>
              </section>
            )}
            {quote.terms?.trim() && (
              <section className="space-y-1.5">
                <h2 className="text-sm font-semibold text-foreground">Conditions</h2>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                  {quote.terms}
                </p>
              </section>
            )}

            <Separator />

            {/* Action buttons */}
            {canDecide ? (
              <section className="space-y-3">
                <div className="space-y-1">
                  <h2 className="text-base font-semibold">
                    Votre décision
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Acceptez ce devis pour démarrer la collaboration, ou refusez
                    en nous indiquant pourquoi.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    size="lg"
                    onClick={() => setAcceptOpen(true)}
                    className="h-12 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <CheckCircle className="size-4" />
                    Accepter le devis
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => setRefuseOpen(true)}
                    className="h-12 border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-950/30"
                  >
                    <XCircle className="size-4" />
                    Refuser
                  </Button>
                </div>
              </section>
            ) : (
              <div className="flex items-center gap-2.5 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                <FileText className="size-4" />
                {status === "ACCEPTED"
                  ? "Devis accepté. Merci !"
                  : status === "REFUSED"
                    ? "Devis refusé."
                    : status === "EXPIRED"
                      ? "Ce devis a expiré."
                      : "Ce devis n'est plus modifiable."}
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
                Télécharger PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
          <FileText className="size-3" />
          Devis {quote.number} · {organization.name}
        </div>
      </div>

      {/* Accept dialog */}
      <Dialog open={acceptOpen} onOpenChange={setAcceptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accepter le devis {quote.number}</DialogTitle>
            <DialogDescription>
              Vous pouvez ajouter un message (facultatif) avant de confirmer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Textarea
              value={acceptMessage}
              onChange={(e) => setAcceptMessage(e.target.value)}
              placeholder="Message optionnel (ex : « C'est validé, on démarre lundi »)"
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAcceptOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={submitAccept}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle className="size-4" />
              {submitting ? "Envoi…" : "Confirmer l'acceptation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refuse dialog */}
      <Dialog open={refuseOpen} onOpenChange={setRefuseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refuser le devis {quote.number}</DialogTitle>
            <DialogDescription>
              Indiquez une raison pour aider le prestataire à mieux comprendre.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Textarea
              value={refuseReason}
              onChange={(e) => setRefuseReason(e.target.value)}
              placeholder="Raison du refus (ex : budget trop élevé, délais trop courts…)"
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRefuseOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={submitRefuse}
              disabled={submitting}
              variant="outline"
              className="border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-950/30"
            >
              <XCircle className="size-4" />
              {submitting ? "Envoi…" : "Confirmer le refus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalShell>
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
  tone?: "emerald" | "rose";
}) {
  const valueColor =
    tone === "emerald"
      ? "text-emerald-700 dark:text-emerald-400"
      : tone === "rose"
        ? "text-rose-700 dark:text-rose-400"
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

// --- Status banner --------------------------------------------------------
function StatusBanner({ quote }: { quote: Quote }) {
  const status = quote.status;
  let cls = "bg-muted/40 border-border text-foreground";
  let icon = <FileText className="size-4" />;
  let text = "En attente de votre décision";

  if (status === "ACCEPTED") {
    cls =
      "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-300";
    icon = <CheckCircle className="size-4" />;
    text = `Devis accepté${quote.acceptedAt ? ` le ${formatDate(quote.acceptedAt)}` : ""}`;
  } else if (status === "REFUSED") {
    cls =
      "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/30 dark:border-rose-900/50 dark:text-rose-300";
    icon = <XCircle className="size-4" />;
    text = `Devis refusé${quote.refusedAt ? ` le ${formatDate(quote.refusedAt)}` : ""}`;
  } else if (status === "EXPIRED") {
    cls =
      "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-300";
    icon = <AlertTriangle className="size-4" />;
    text = "Devis expiré";
  } else if (status === "DRAFT") {
    cls = "bg-muted/40 border-border text-muted-foreground";
    text = "Brouillon — non envoyé";
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
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <Skeleton className="h-16 w-full rounded-lg" />
      <Card>
        <CardContent className="px-5 sm:px-8 py-6 sm:py-8 space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-px w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <Skeleton className="h-48 w-full" />
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
              Ce devis n&apos;est plus accessible ou le lien est incorrect.
              Contactez votre prestataire pour obtenir un nouveau lien.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DecisionSuccessCard({
  tone,
  icon,
  title,
  message,
}: {
  tone: "emerald" | "rose";
  icon: React.ReactNode;
  title: string;
  message: string;
}) {
  const palette =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900/40"
      : "border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 dark:border-rose-900/40";
  return (
    <div className="max-w-md mx-auto w-full px-4 py-20">
      <Card className={palette}>
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

function statusBadgeClass(status: string) {
  const ref: Record<string, string> = {
    DRAFT: "bg-muted text-muted-foreground border-border",
    SENT:
      "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-900/40",
    VIEWED:
      "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900/40",
    ACCEPTED:
      "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40",
    REFUSED:
      "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/40",
    EXPIRED:
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/40",
  };
  return ref[status] ?? "bg-muted text-muted-foreground border-border";
}
