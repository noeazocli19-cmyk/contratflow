"use client";

import { useEffect, useState, useCallback } from "react";
import { api, ApiError } from "@/lib/api";
import {
  formatCurrency,
  formatDate,
  initials,
  PROPOSAL_STATUS_LABELS,
} from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import type { Proposal, ProposalItem, Client, Org } from "@/lib/types";

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
  ListChecks,
  Lightbulb,
  HelpCircle,
  Coins,
  Settings2,
  Sparkles,
} from "lucide-react";

type Props = { token: string };

type ProposalData = {
  proposal: Proposal;
  items: ProposalItem[];
  client: Client;
  organization: Org;
};

type Decision = "ACCEPT" | "REFUSE" | null;

export default function ProposalPortal({ token }: Props) {
  const { toast } = useToast();
  const [data, setData] = useState<ProposalData | null>(null);
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
      const res = await api.get<ProposalData>(`/api/public/proposal/${token}`);
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
      await api.post(`/api/public/proposal/${token}/accept`, {
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
      await api.post(`/api/public/proposal/${token}/accept`, {
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
      <PortalShell footer={`Proposition envoyée par ${data?.organization?.name ?? "ContractFlow"} · ContractFlow`}>
        <DecisionSuccessCard
          tone="emerald"
          icon={<CheckCircle className="size-12 text-emerald-500" />}
          title="Merci !"
          message="Votre réponse a été enregistrée. Le prestataire revient vers vous très prochainement pour démarrer la collaboration."
        />
      </PortalShell>
    );
  }
  if (decision === "REFUSE") {
    return (
      <PortalShell footer={`Proposition envoyée par ${data?.organization?.name ?? "ContractFlow"} · ContractFlow`}>
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

  const { proposal, items, client, organization } = data;
  const status = proposal.status;
  const canDecide = status === "SENT" || status === "VIEWED";
  const clientFullName = [client.firstName, client.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <PortalShell
      footer={`Proposition envoyée par ${organization.name} · ContractFlow`}
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
                {organization.email ?? organization.website ?? "Proposition commerciale"}
              </div>
            </div>
          </div>
          <Badge
            className={`${statusBadgeClass(status)} text-xs px-3 py-1`}
            variant="outline"
          >
            {PROPOSAL_STATUS_LABELS[status]}
          </Badge>
        </div>

        {/* Status banner */}
        <StatusBanner status={status} proposal={proposal} />

        {/* Main card */}
        <Card className="shadow-sm">
          <CardContent className="px-5 sm:px-8 py-6 sm:py-8 space-y-6">
            {/* Title */}
            <header className="space-y-1">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Proposition commerciale · {proposal.number}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                {proposal.title}
              </h1>
              {proposal.validUntil && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Calendar className="size-3.5" />
                  Valide jusqu'au {formatDate(proposal.validUntil)}
                </div>
              )}
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
              </div>
            </section>

            {/* Votre besoin */}
            {proposal.problem?.trim() && (
              <Section
                icon={<HelpCircle className="size-4" />}
                title="Votre besoin"
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                  {proposal.problem}
                </p>
              </Section>
            )}

            {/* Notre solution */}
            {proposal.solution?.trim() && (
              <Section
                icon={<Lightbulb className="size-4" />}
                title="Notre solution"
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                  {proposal.solution}
                </p>
              </Section>
            )}

            {/* Livrables */}
            {proposal.deliverables?.trim() && (
              <Section
                icon={<ListChecks className="size-4" />}
                title="Livrables"
              >
                <ul className="space-y-2">
                  {proposal.deliverables
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .map((line, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm leading-relaxed"
                      >
                        <CheckCircle className="size-4 text-emerald-500 mt-0.5 shrink-0" />
                        <span>{line}</span>
                      </li>
                    ))}
                </ul>
              </Section>
            )}

            {/* Planning */}
            {proposal.timeline?.trim() && (
              <Section
                icon={<Calendar className="size-4" />}
                title="Planning"
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                  {proposal.timeline}
                </p>
              </Section>
            )}

            {/* Items table */}
            {items && items.length > 0 && (
              <Section
                icon={<ListChecks className="size-4" />}
                title="Détail des prestations"
              >
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
                            {formatCurrency(it.unitPrice, proposal.currency)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                            {formatCurrency(
                              it.qty * it.unitPrice,
                              proposal.currency,
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}

            {/* Tarif */}
            <Section
              icon={<Coins className="size-4" />}
              title="Tarif"
            >
              <div className="flex items-baseline justify-between gap-4 rounded-lg bg-emerald-50/60 border border-emerald-200/60 dark:bg-emerald-950/20 dark:border-emerald-900/40 p-4">
                <span className="text-sm text-muted-foreground">
                  Montant total de la prestation
                </span>
                <span className="text-2xl sm:text-3xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(proposal.amount, proposal.currency)}
                </span>
              </div>
            </Section>

            {/* Options */}
            {proposal.options?.trim() && (
              <Section
                icon={<Sparkles className="size-4" />}
                title="Options"
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                  {proposal.options}
                </p>
              </Section>
            )}

            {/* Conditions */}
            {proposal.conditions?.trim() && (
              <Section
                icon={<Settings2 className="size-4" />}
                title="Conditions"
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                  {proposal.conditions}
                </p>
              </Section>
            )}

            <Separator />

            {/* Action buttons */}
            {canDecide ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground text-center">
                  Qu'en pensez-vous ? Vous pouvez accepter ou refuser cette
                  proposition ci-dessous.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    size="lg"
                    onClick={() => setAcceptOpen(true)}
                    className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <CheckCircle className="size-4" />
                    Accepter la proposition
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => setRefuseOpen(true)}
                    className="flex-1 h-12"
                  >
                    <XCircle className="size-4" />
                    Refuser
                  </Button>
                </div>
              </div>
            ) : null}

            {/* Print button */}
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
          Proposition {proposal.number} · {organization.name}
        </div>
      </div>

      {/* Accept dialog */}
      <Dialog open={acceptOpen} onOpenChange={setAcceptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer l'acceptation</DialogTitle>
            <DialogDescription>
              Vous êtes sur le point d'accepter la proposition « {proposal.title} ».
              Vous pouvez laisser un message (facultatif) au prestataire.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              value={acceptMessage}
              onChange={(e) => setAcceptMessage(e.target.value)}
              placeholder="Message (facultatif)…"
              rows={4}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAcceptOpen(false)}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button
              onClick={submitAccept}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {submitting ? "Enregistrement…" : "Confirmer l'acceptation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refuse dialog */}
      <Dialog open={refuseOpen} onOpenChange={setRefuseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refuser la proposition</DialogTitle>
            <DialogDescription>
              Indiquez brièvement la raison de votre refus. Ce retour aide le
              prestataire à améliorer son offre.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              value={refuseReason}
              onChange={(e) => setRefuseReason(e.target.value)}
              placeholder="Raison du refus…"
              rows={4}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRefuseOpen(false)}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button
              onClick={submitRefuse}
              disabled={submitting}
              variant="destructive"
            >
              {submitting ? "Enregistrement…" : "Confirmer le refus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalShell>
  );
}

// --- Helper components ----------------------------------------------------

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
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-px w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-20 w-full" />
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
              Cette proposition n'est plus accessible ou le lien est incorrect.
              Contactez votre prestataire pour obtenir un nouveau lien.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <h2 className="text-sm font-semibold flex items-center gap-2 text-foreground">
        <span className="text-muted-foreground">{icon}</span>
        {title}
      </h2>
      <div className="pl-6">{children}</div>
    </section>
  );
}

function StatusBanner({
  status,
  proposal,
}: {
  status: string;
  proposal: Proposal;
}) {
  let cls = "bg-muted/40 border-border text-foreground";
  let icon = <FileText className="size-4" />;
  let text = "En attente de votre décision";

  if (status === "ACCEPTED") {
    cls =
      "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-300";
    icon = <CheckCircle className="size-4" />;
    text = `Proposition acceptée le ${formatDate(proposal.acceptedAt)}`;
  } else if (status === "REFUSED") {
    cls =
      "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/30 dark:border-rose-900/50 dark:text-rose-300";
    icon = <XCircle className="size-4" />;
    text = "Proposition refusée";
  } else if (status === "EXPIRED") {
    cls =
      "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-300";
    icon = <AlertTriangle className="size-4" />;
    text = "Proposition expirée";
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
  const cls =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900/40"
      : "border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 dark:border-rose-900/40";
  return (
    <div className="max-w-md mx-auto w-full px-4 py-20">
      <Card className={cls}>
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
  return (
    STATUS_COLOR_REF[status] ??
    "bg-muted text-muted-foreground border-border"
  );
}

// local copy without using indigo/blue
const STATUS_COLOR_REF: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground border-border",
  SENT: "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-900/40",
  VIEWED:
    "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900/40",
  ACCEPTED:
    "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40",
  REFUSED:
    "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/40",
  EXPIRED:
    "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/40",
};

// (No global STATUS_COLOR import — we use a local palette that excludes indigo/blue.)
