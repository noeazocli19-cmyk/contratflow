"use client";

import { useEffect, useState, useCallback } from "react";
import { api, ApiError } from "@/lib/api";
import {
  formatCurrency,
  formatDate,
  timeAgo,
  initials,
  PROPOSAL_STATUS_LABELS,
  QUOTE_STATUS_LABELS,
  CONTRACT_STATUS_LABELS,
  INVOICE_STATUS_LABELS,
  INVOICE_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  STATUS_COLOR,
} from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import type {
  Contract,
  Signature,
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
import { Checkbox } from "@/components/ui/checkbox";
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
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  FileText,
  FileSpreadsheet,
  PenTool,
  Receipt,
  Wallet,
  FolderArchive,
  Building2,
  User,
  Calendar,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  CreditCard,
  ExternalLink,
  ChevronRight,
  Home,
} from "lucide-react";

type Props = { token: string };

type PendingAction =
  | {
      type: "sign_contract";
      id: string;
      number: string;
      title: string;
      amount: number;
      publicToken: string | null;
    }
  | {
      type: "pay_invoice";
      id: string;
      number: string;
      amount: number;
      balance: number;
      publicToken: string | null;
    }
  | {
      type: "accept_proposal";
      id: string;
      number: string;
      title: string;
      amount: number;
      publicToken: string | null;
    }
  | {
      type: "accept_quote";
      id: string;
      number: string;
      amount: number;
      publicToken: string | null;
    };

type ProposalSummary = {
  id: string;
  number: string;
  title: string;
  status: string;
  amount: number;
  currency: string;
  publicToken: string | null;
  validUntil: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  acceptedAt: string | null;
  refusedAt: string | null;
  updatedAt: string;
};

type QuoteSummary = {
  id: string;
  number: string;
  status: string;
  totalComputed: number;
  publicToken: string | null;
  expirationDate: string | null;
  issueDate: string;
  sentAt: string | null;
  viewedAt: string | null;
  acceptedAt: string | null;
  refusedAt: string | null;
  updatedAt: string;
};

type ContractSummary = {
  id: string;
  number: string;
  title: string;
  status: string;
  amount: number;
  publicToken: string | null;
  signedAt: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  updatedAt: string;
};

type InvoiceSummary = {
  id: string;
  number: string;
  type: string;
  status: string;
  issueDate: string;
  dueDate: string | null;
  totalComputed: number;
  publicToken: string | null;
  paidAmount: number;
  balance: number;
  sentAt: string | null;
  viewedAt: string | null;
  paidAt: string | null;
  updatedAt: string;
};

type PaymentSummary = {
  id: string;
  amount: number;
  method: string;
  reference: string | null;
  paidAt: string;
  invoiceNumber: string | null;
};

type DocumentSummary = {
  id: string;
  name: string;
  type: string;
  url: string | null;
  mime: string | null;
  size: number;
  createdAt: string;
};

type PortalData = {
  client: {
    id: string;
    firstName: string;
    lastName: string;
    company: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    country: string | null;
  };
  organization: {
    name: string;
    logoUrl: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    currency: string;
  };
  proposals: ProposalSummary[];
  quotes: QuoteSummary[];
  contracts: ContractSummary[];
  invoices: InvoiceSummary[];
  payments: PaymentSummary[];
  documents: DocumentSummary[];
  pendingActions: PendingAction[];
};

type Tab = "accueil" | "propositions" | "contrats" | "factures" | "paiements" | "documents";

const PAYMENT_METHODS = ["CASH", "TRANSFER", "CARD", "MOBILE_MONEY", "OTHER"];

export default function ClientPortal({ token }: Props) {
  const { toast } = useToast();
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("accueil");

  // Dialogs
  const [signContractToken, setSignContractToken] = useState<string | null>(null);
  const [payInvoiceToken, setPayInvoiceToken] = useState<string | null>(null);
  const [viewInvoiceToken, setViewInvoiceToken] = useState<string | null>(null);
  const [acceptProposal, setAcceptProposal] = useState<{ token: string; number: string } | null>(null);
  const [acceptQuote, setAcceptQuote] = useState<{ token: string; number: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<PortalData>(`/api/public/client/${token}`);
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

  // Error state
  if (error) {
    return (
      <PortalShell footer="ContractFlow">
        <ErrorCard />
      </PortalShell>
    );
  }

  // Loading state
  if (loading || !data) {
    return (
      <PortalShell footer="ContractFlow">
        <LoadingShell />
      </PortalShell>
    );
  }

  const { client, organization, pendingActions } = data;
  const clientFullName = [client.firstName, client.lastName]
    .filter(Boolean)
    .join(" ");

  const totalToPay = data.invoices
    .filter((i) => i.balance > 0.01)
    .reduce((s, i) => s + i.balance, 0);
  const signaturesEnAttente = pendingActions.filter(
    (a) => a.type === "sign_contract",
  ).length;
  const documentsCount = data.documents.length;
  const recentEvents = buildRecentEvents(data);

  return (
    <PortalShell footer={`Portail client · ${organization.name} · ContractFlow`}>
      <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <OrgAvatar name={organization.name} logoUrl={organization.logoUrl} />
            <div className="leading-tight">
              <div className="font-semibold text-foreground">
                {organization.name}
              </div>
              <div className="text-xs text-muted-foreground">
                Portail client
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Bonjour,</div>
            <div className="font-semibold text-foreground">{clientFullName}</div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="w-full overflow-x-auto justify-start sm:w-auto">
            <TabsTrigger value="accueil">
              <Home className="size-4" />
              Accueil
            </TabsTrigger>
            <TabsTrigger value="propositions">
              <FileText className="size-4" />
              Propositions
            </TabsTrigger>
            <TabsTrigger value="contrats">
              <PenTool className="size-4" />
              Contrats
            </TabsTrigger>
            <TabsTrigger value="factures">
              <Receipt className="size-4" />
              Factures
            </TabsTrigger>
            <TabsTrigger value="paiements">
              <Wallet className="size-4" />
              Paiements
            </TabsTrigger>
            <TabsTrigger value="documents">
              <FolderArchive className="size-4" />
              Documents
            </TabsTrigger>
          </TabsList>

          {/* Accueil */}
          <TabsContent value="accueil" className="space-y-6 pt-4">
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <SummaryCard
                icon={<Wallet className="size-5 text-amber-600" />}
                tone="amber"
                label="Total à payer"
                value={formatCurrency(totalToPay, organization.currency)}
              />
              <SummaryCard
                icon={<PenTool className="size-5 text-cyan-600" />}
                tone="cyan"
                label="Signatures en attente"
                value={String(signaturesEnAttente)}
              />
              <SummaryCard
                icon={<FolderArchive className="size-5 text-violet-600" />}
                tone="violet"
                label="Documents"
                value={String(documentsCount)}
              />
            </div>

            {/* Pending actions */}
            {pendingActions.length > 0 ? (
              <section className="space-y-3">
                <h2 className="text-base font-semibold flex items-center gap-2 text-foreground">
                  <AlertTriangle className="size-4 text-amber-600" />
                  Actions requises ({pendingActions.length})
                </h2>
                <div className="grid grid-cols-1 gap-3">
                  {pendingActions.map((a) => (
                    <PendingActionCard
                      key={`${a.type}-${a.id}`}
                      action={a}
                      currency={organization.currency}
                      onSignContract={(t) => setSignContractToken(t)}
                      onPayInvoice={(t) => setPayInvoiceToken(t)}
                      onAcceptProposal={(t, n) =>
                        setAcceptProposal({ token: t, number: n })
                      }
                      onAcceptQuote={(t, n) =>
                        setAcceptQuote({ token: t, number: n })
                      }
                    />
                  ))}
                </div>
              </section>
            ) : (
              <section className="space-y-3">
                <h2 className="text-base font-semibold flex items-center gap-2 text-foreground">
                  <CheckCircle className="size-4 text-emerald-600" />
                  Actions requises
                </h2>
                <Card>
                  <CardContent className="px-5 py-8 text-center">
                    <div className="mx-auto size-12 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mb-3">
                      <CheckCircle className="size-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="text-sm font-medium">Tout est à jour !</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Aucune action en attente de votre part.
                    </div>
                  </CardContent>
                </Card>
              </section>
            )}

            {/* Recent activity */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold flex items-center gap-2 text-foreground">
                <Clock className="size-4 text-muted-foreground" />
                Récent
              </h2>
              <Card>
                <CardContent className="px-3 py-2">
                  {recentEvents.length === 0 ? (
                    <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                      Aucune activité récente.
                    </div>
                  ) : (
                    <div className="divide-y">
                      {recentEvents.map((ev, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 px-2 py-3"
                        >
                          <div
                            className={`mt-0.5 size-8 rounded-full flex items-center justify-center shrink-0 ${ev.toneBg}`}
                          >
                            {ev.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-foreground">
                              {ev.label}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {ev.sub}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground shrink-0">
                            {timeAgo(ev.date)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          </TabsContent>

          {/* Propositions */}
          <TabsContent value="propositions" className="space-y-3 pt-4">
            <PropositionsTab
              proposals={data.proposals}
              quotes={data.quotes}
              currency={organization.currency}
              onAcceptProposal={(t, n) =>
                setAcceptProposal({ token: t, number: n })
              }
              onAcceptQuote={(t, n) => setAcceptQuote({ token: t, number: n })}
            />
          </TabsContent>

          {/* Contrats */}
          <TabsContent value="contrats" className="space-y-3 pt-4">
            <ContratsTab
              contracts={data.contracts}
              currency={organization.currency}
              onSignContract={(t) => setSignContractToken(t)}
            />
          </TabsContent>

          {/* Factures */}
          <TabsContent value="factures" className="space-y-3 pt-4">
            <FacturesTab
              invoices={data.invoices}
              currency={organization.currency}
              onPayInvoice={(t) => setPayInvoiceToken(t)}
              onViewInvoice={(t) => setViewInvoiceToken(t)}
            />
          </TabsContent>

          {/* Paiements */}
          <TabsContent value="paiements" className="space-y-3 pt-4">
            <PaiementsTab payments={data.payments} currency={organization.currency} />
          </TabsContent>

          {/* Documents */}
          <TabsContent value="documents" className="space-y-3 pt-4">
            <DocumentsTab documents={data.documents} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      {signContractToken && (
        <SignContractDialog
          token={signContractToken}
          onClose={() => setSignContractToken(null)}
          onSigned={() => {
            setSignContractToken(null);
            toast({
              title: "Contrat signé",
              description: "Votre signature a été enregistrée.",
            });
            void load();
          }}
        />
      )}
      {payInvoiceToken && (
        <PayInvoiceDialog
          portalToken={token}
          invoiceToken={payInvoiceToken}
          onClose={() => setPayInvoiceToken(null)}
          onPaid={() => {
            setPayInvoiceToken(null);
            toast({
              title: "Paiement enregistré",
              description: "Merci ! Un reçu vous sera envoyé.",
            });
            void load();
          }}
        />
      )}
      {viewInvoiceToken && (
        <ViewInvoiceDialog
          portalToken={token}
          invoiceToken={viewInvoiceToken}
          onClose={() => setViewInvoiceToken(null)}
        />
      )}
      {acceptProposal && (
        <AcceptDialog
          kind="proposal"
          number={acceptProposal.number}
          token={acceptProposal.token}
          onClose={() => setAcceptProposal(null)}
          onDone={() => {
            setAcceptProposal(null);
            void load();
          }}
        />
      )}
      {acceptQuote && (
        <AcceptDialog
          kind="quote"
          number={acceptQuote.number}
          token={acceptQuote.token}
          onClose={() => setAcceptQuote(null)}
          onDone={() => {
            setAcceptQuote(null);
            void load();
          }}
        />
      )}
    </PortalShell>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

function PropositionsTab({
  proposals,
  quotes,
  currency,
  onAcceptProposal,
  onAcceptQuote,
}: {
  proposals: ProposalSummary[];
  quotes: QuoteSummary[];
  currency: string;
  onAcceptProposal: (token: string, number: string) => void;
  onAcceptQuote: (token: string, number: string) => void;
}) {
  const hasAny = proposals.length > 0 || quotes.length > 0;
  if (!hasAny) return <EmptyState icon={<FileText className="size-6" />} label="Aucune proposition ni devis" sub="Vos propositions et devis apparaîtront ici." />;

  return (
    <div className="space-y-4">
      {proposals.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Propositions ({proposals.length})
          </h3>
          <div className="space-y-2">
            {proposals.map((p) => (
              <Card key={p.id}>
                <CardContent className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{p.number}</span>
                      <Badge
                        className={`text-xs ${STATUS_COLOR[p.status] ?? ""}`}
                        variant="outline"
                      >
                        {PROPOSAL_STATUS_LABELS[p.status] ?? p.status}
                      </Badge>
                    </div>
                    <div className="text-sm text-foreground truncate">{p.title}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                      <span>{formatCurrency(p.amount, p.currency || currency)}</span>
                      {p.validUntil && (
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          Valide jusqu&apos;au {formatDate(p.validUntil)}
                        </span>
                      )}
                    </div>
                  </div>
                  {(p.status === "SENT" || p.status === "VIEWED") && p.publicToken ? (
                    <Button
                      size="sm"
                      onClick={() => onAcceptProposal(p.publicToken!, p.number)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      Répondre
                      <ChevronRight className="size-3.5" />
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {p.status === "ACCEPTED"
                        ? "Acceptée"
                        : p.status === "REFUSED"
                          ? "Refusée"
                          : p.status === "EXPIRED"
                            ? "Expirée"
                            : ""}
                    </span>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {quotes.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Devis ({quotes.length})
          </h3>
          <div className="space-y-2">
            {quotes.map((q) => (
              <Card key={q.id}>
                <CardContent className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{q.number}</span>
                      <Badge
                        className={`text-xs ${STATUS_COLOR[q.status] ?? ""}`}
                        variant="outline"
                      >
                        {QUOTE_STATUS_LABELS[q.status] ?? q.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                      <span>{formatCurrency(q.totalComputed, currency)}</span>
                      {q.expirationDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          Expire le {formatDate(q.expirationDate)}
                        </span>
                      )}
                    </div>
                  </div>
                  {(q.status === "SENT" || q.status === "VIEWED") && q.publicToken ? (
                    <Button
                      size="sm"
                      onClick={() => onAcceptQuote(q.publicToken!, q.number)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      Répondre
                      <ChevronRight className="size-3.5" />
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {q.status === "ACCEPTED"
                        ? "Accepté"
                        : q.status === "REFUSED"
                          ? "Refusé"
                          : q.status === "EXPIRED"
                            ? "Expiré"
                            : ""}
                    </span>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ContratsTab({
  contracts,
  currency,
  onSignContract,
}: {
  contracts: ContractSummary[];
  currency: string;
  onSignContract: (token: string) => void;
}) {
  if (contracts.length === 0)
    return <EmptyState icon={<PenTool className="size-6" />} label="Aucun contrat" sub="Vos contrats signés ou à signer apparaîtront ici." />;

  return (
    <div className="space-y-2">
      {contracts.map((c) => (
        <Card key={c.id}>
          <CardContent className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{c.number}</span>
                <Badge
                  className={`text-xs ${STATUS_COLOR[c.status] ?? ""}`}
                  variant="outline"
                >
                  {CONTRACT_STATUS_LABELS[c.status] ?? c.status}
                </Badge>
              </div>
              <div className="text-sm text-foreground truncate">{c.title}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                <span>{formatCurrency(c.amount, currency)}</span>
                {c.signedAt && (
                  <span className="flex items-center gap-1">
                    <CheckCircle className="size-3 text-emerald-600" />
                    Signé le {formatDate(c.signedAt)}
                  </span>
                )}
              </div>
            </div>
            {(c.status === "SENT" || c.status === "VIEWED") && c.publicToken ? (
              <Button
                size="sm"
                onClick={() => onSignContract(c.publicToken!)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <PenTool className="size-3.5" />
                Lire et signer
              </Button>
            ) : c.status === "SIGNED" ? (
              <span className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle className="size-3.5" />
                Signé
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                {c.status === "EXPIRED"
                  ? "Expiré"
                  : c.status === "CANCELED"
                    ? "Annulé"
                    : ""}
              </span>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function FacturesTab({
  invoices,
  currency,
  onPayInvoice,
  onViewInvoice,
}: {
  invoices: InvoiceSummary[];
  currency: string;
  onPayInvoice: (token: string) => void;
  onViewInvoice: (token: string) => void;
}) {
  if (invoices.length === 0)
    return <EmptyState icon={<Receipt className="size-6" />} label="Aucune facture" sub="Vos factures apparaîtront ici." />;

  return (
    <div className="space-y-2">
      {invoices.map((inv) => {
        const isPaid = inv.status === "PAID" || inv.balance <= 0.01;
        const canPay =
          !isPaid &&
          inv.publicToken &&
          (inv.status === "SENT" ||
            inv.status === "VIEWED" ||
            inv.status === "PARTIALLY_PAID" ||
            inv.status === "OVERDUE");
        return (
          <Card key={inv.id}>
            <CardContent className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{inv.number}</span>
                  <Badge variant="secondary" className="text-xs">
                    {INVOICE_TYPE_LABELS[inv.type] ?? inv.type}
                  </Badge>
                  <Badge
                    className={`text-xs ${STATUS_COLOR[inv.status] ?? ""}`}
                    variant="outline"
                  >
                    {INVOICE_STATUS_LABELS[inv.status] ?? inv.status}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                  <span>Total : {formatCurrency(inv.totalComputed, currency)}</span>
                  {!isPaid && (
                    <span className="text-amber-700 dark:text-amber-400 font-medium">
                      Reste {formatCurrency(inv.balance, currency)}
                    </span>
                  )}
                  {inv.dueDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3" />
                      Échéance : {formatDate(inv.dueDate)}
                    </span>
                  )}
                </div>
              </div>
              {canPay ? (
                <Button
                  size="sm"
                  onClick={() => onPayInvoice(inv.publicToken!)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <CreditCard className="size-3.5" />
                  Payer
                </Button>
              ) : isPaid && inv.publicToken ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onViewInvoice(inv.publicToken!)}
                >
                  <Receipt className="size-3.5" />
                  Voir le reçu
                </Button>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function PaiementsTab({
  payments,
  currency,
}: {
  payments: PaymentSummary[];
  currency: string;
}) {
  if (payments.length === 0)
    return <EmptyState icon={<Wallet className="size-6" />} label="Aucun paiement" sub="Vos paiements confirmés apparaîtront ici." />;

  return (
    <div className="space-y-2">
      {payments.map((p) => (
        <Card key={p.id}>
          <CardContent className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="space-y-1 min-w-0">
              <div className="font-medium text-sm">
                {formatCurrency(p.amount, currency)}
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-xs">
                  {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                </Badge>
                {p.reference && (
                  <span className="font-mono text-xs">{p.reference}</span>
                )}
                {p.invoiceNumber && (
                  <span>· Facture {p.invoiceNumber}</span>
                )}
              </div>
            </div>
            <div className="text-xs text-muted-foreground text-right">
              {formatDate(p.paidAt)}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DocumentsTab({ documents }: { documents: DocumentSummary[] }) {
  if (documents.length === 0)
    return <EmptyState icon={<FolderArchive className="size-6" />} label="Aucun document" sub="Vos documents apparaîtront ici." />;

  return (
    <div className="space-y-2">
      {documents.map((d) => (
        <Card key={d.id}>
          <CardContent className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-3 min-w-0">
              <div className="size-9 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                <FolderArchive className="size-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 space-y-0.5">
                <div className="font-medium text-sm truncate">{d.name}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    {d.type}
                  </Badge>
                  <span>{formatDate(d.createdAt)}</span>
                </div>
              </div>
            </div>
            {d.url ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(d.url!, "_blank", "noopener,noreferrer")}
              >
                <ExternalLink className="size-3.5" />
                Ouvrir
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pending action card
// ---------------------------------------------------------------------------

function PendingActionCard({
  action,
  currency,
  onSignContract,
  onPayInvoice,
  onAcceptProposal,
  onAcceptQuote,
}: {
  action: PendingAction;
  currency: string;
  onSignContract: (t: string) => void;
  onPayInvoice: (t: string) => void;
  onAcceptProposal: (t: string, n: string) => void;
  onAcceptQuote: (t: string, n: string) => void;
}) {
  if (!action.publicToken) return null;

  let icon = <FileText className="size-5 text-cyan-600" />;
  let title = "";
  let sub = "";
  let cta: React.ReactNode = null;

  if (action.type === "sign_contract") {
    icon = <PenTool className="size-5 text-cyan-600" />;
    title = `Contrat à signer : ${action.number}`;
    sub = action.title;
    cta = (
      <Button
        size="sm"
        onClick={() => onSignContract(action.publicToken!)}
        className="bg-emerald-600 hover:bg-emerald-700 text-white"
      >
        <PenTool className="size-3.5" />
        Lire et signer
      </Button>
    );
  } else if (action.type === "pay_invoice") {
    icon = <CreditCard className="size-5 text-amber-600" />;
    title = `Paiement requis : ${action.number}`;
    sub = `Reste ${formatCurrency(action.balance, currency)} sur ${formatCurrency(action.amount, currency)}`;
    cta = (
      <Button
        size="sm"
        onClick={() => onPayInvoice(action.publicToken!)}
        className="bg-emerald-600 hover:bg-emerald-700 text-white"
      >
        <CreditCard className="size-3.5" />
        Payer
      </Button>
    );
  } else if (action.type === "accept_proposal") {
    icon = <FileText className="size-5 text-violet-600" />;
    title = `Proposition à accepter : ${action.number}`;
    sub = `${action.title} · ${formatCurrency(action.amount, currency)}`;
    cta = (
      <Button
        size="sm"
        onClick={() => onAcceptProposal(action.publicToken!, action.number)}
        className="bg-emerald-600 hover:bg-emerald-700 text-white"
      >
        Répondre
        <ChevronRight className="size-3.5" />
      </Button>
    );
  } else if (action.type === "accept_quote") {
    icon = <FileSpreadsheet className="size-5 text-violet-600" />;
    title = `Devis à accepter : ${action.number}`;
    sub = `Total : ${formatCurrency(action.amount, currency)}`;
    cta = (
      <Button
        size="sm"
        onClick={() => onAcceptQuote(action.publicToken!, action.number)}
        className="bg-emerald-600 hover:bg-emerald-700 text-white"
      >
        Répondre
        <ChevronRight className="size-3.5" />
      </Button>
    );
  }

  return (
    <Card className="border-amber-200/70 dark:border-amber-900/40">
      <CardContent className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <div className="size-10 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center shrink-0">
            {icon}
          </div>
          <div className="min-w-0 space-y-0.5">
            <div className="font-medium text-sm">{title}</div>
            {sub && (
              <div className="text-xs text-muted-foreground truncate">{sub}</div>
            )}
          </div>
        </div>
        {cta}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Summary card
// ---------------------------------------------------------------------------

function SummaryCard({
  icon,
  tone,
  label,
  value,
}: {
  icon: React.ReactNode;
  tone: "amber" | "cyan" | "violet";
  label: string;
  value: string;
}) {
  const bg =
    tone === "amber"
      ? "bg-amber-50 dark:bg-amber-950/30"
      : tone === "cyan"
        ? "bg-cyan-50 dark:bg-cyan-950/30"
        : "bg-violet-50 dark:bg-violet-950/30";
  return (
    <Card>
      <CardContent className="px-4 py-3 flex items-center gap-3">
        <div className={`size-10 rounded-lg flex items-center justify-center ${bg}`}>
          {icon}
        </div>
        <div className="space-y-0.5">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="font-bold text-foreground">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Accept dialog (proposal or quote)
// ---------------------------------------------------------------------------

function AcceptDialog({
  kind,
  number,
  token,
  onClose,
  onDone,
}: {
  kind: "proposal" | "quote";
  number: string;
  token: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [decision, setDecision] = useState<"ACCEPT" | "REFUSE" | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!decision) return;
    if (decision === "REFUSE" && !message.trim()) {
      toast({
        title: "Indiquez une raison",
        description: "Une brève raison nous aide à améliorer notre offre.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/api/public/${kind}/${token}/accept`, {
        decision,
        message: message.trim() || undefined,
      });
      toast({
        title: decision === "ACCEPT" ? "Accepté !" : "Refus enregistré",
        description:
          decision === "ACCEPT"
            ? "Merci. Le prestataire revient vers vous."
            : "Votre réponse a bien été enregistrée.",
      });
      onDone();
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : "Impossible d'enregistrer votre réponse";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const label = kind === "proposal" ? "proposition" : "devis";
  const labelCap = kind === "proposal" ? "Proposition" : "Devis";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {labelCap} {number}
          </DialogTitle>
          <DialogDescription>
            Acceptez ou refusez cette {label}. Vous pouvez ajouter un message
            (facultatif pour acceptation, requis pour refus).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              decision === "REFUSE"
                ? "Raison du refus (requis)"
                : "Message optionnel"
            }
            rows={3}
          />
        </div>
        <DialogFooter className="gap-2 flex-col sm:flex-row">
          <Button
            variant="outline"
            onClick={() => {
              setDecision("REFUSE");
              void submit();
            }}
            disabled={submitting}
            className="border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-950/30 w-full sm:w-auto"
          >
            <XCircle className="size-4" />
            Refuser
          </Button>
          <Button
            onClick={() => {
              setDecision("ACCEPT");
              void submit();
            }}
            disabled={submitting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"
          >
            <CheckCircle className="size-4" />
            Accepter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Sign contract dialog (fetches contract content + sign form)
// ---------------------------------------------------------------------------

type ContractData = {
  contract: Contract;
  client: Client;
  signatures: Signature[];
  organization: Org;
};

function SignContractDialog({
  token,
  onClose,
  onSigned,
}: {
  token: string;
  onClose: () => void;
  onSigned: () => void;
}) {
  const { toast } = useToast();
  const [data, setData] = useState<ContractData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [signedBy, setSignedBy] = useState("");
  const [signedByEmail, setSignedByEmail] = useState("");
  const [signatureData, setSignatureData] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .get<ContractData>(`/api/public/contract/${token}`)
      .then((res) => {
        if (!active) return;
        setData(res);
        const fullName = [res.client.firstName, res.client.lastName]
          .filter(Boolean)
          .join(" ");
        setSignedBy(fullName);
        setSignedByEmail(res.client.email ?? "");
      })
      .catch((e) => {
        if (!active) return;
        const msg =
          e instanceof ApiError ? e.message : "Contrat introuvable";
        setErr(msg);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function submitSign() {
    if (!signedBy.trim()) {
      toast({
        title: "Nom requis",
        description: "Veuillez saisir votre nom complet.",
        variant: "destructive",
      });
      return;
    }
    if (!signedByEmail.trim() || !/^\S+@\S+\.\S+$/.test(signedByEmail)) {
      toast({
        title: "Email invalide",
        description: "Veuillez saisir une adresse e-mail valide.",
        variant: "destructive",
      });
      return;
    }
    if (!signatureData.trim()) {
      toast({
        title: "Signature requise",
        description: "Tapez votre nom complet comme signature.",
        variant: "destructive",
      });
      return;
    }
    if (!agreed) {
      toast({
        title: "Acceptation requise",
        description: "Vous devez cocher la case d'acceptation des termes.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/api/public/contract/${token}/sign`, {
        signedBy: signedBy.trim(),
        signedByEmail: signedByEmail.trim(),
        signatureData: signatureData.trim(),
      });
      onSigned();
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : "Impossible d'enregistrer la signature";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenTool className="size-4 text-cyan-600" />
            Lire et signer le contrat
          </DialogTitle>
          <DialogDescription>
            Vérifiez le contenu ci-dessous puis signez électroniquement en bas.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : err ? (
          <div className="py-6 text-center text-sm text-rose-600 dark:text-rose-400">
            {err}
          </div>
        ) : data ? (
          <div className="space-y-4 py-2">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Contrat · {data.contract.number}
                </div>
                <div className="font-semibold">{data.contract.title}</div>
              </div>
              <Badge
                className={`text-xs ${STATUS_COLOR[data.contract.status] ?? ""}`}
                variant="outline"
              >
                {CONTRACT_STATUS_LABELS[data.contract.status]}
              </Badge>
            </div>

            {/* De / À */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                <div className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="size-3.5" /> Prestataire
                </div>
                <div className="font-semibold text-sm">{data.organization.name}</div>
                {data.organization.email && (
                  <div className="text-xs text-muted-foreground">
                    {data.organization.email}
                  </div>
                )}
              </div>
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                <div className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <User className="size-3.5" /> Client
                </div>
                <div className="font-semibold text-sm">
                  {[data.client.firstName, data.client.lastName]
                    .filter(Boolean)
                    .join(" ")}
                </div>
                {data.client.company && (
                  <div className="text-xs text-muted-foreground">
                    {data.client.company}
                  </div>
                )}
              </div>
            </div>

            {/* Key facts */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <KeyFact
                label="Montant"
                value={formatCurrency(
                  data.contract.amount,
                  data.contract.currency,
                )}
              />
              <KeyFact label="Durée" value={data.contract.duration ?? "—"} />
              <KeyFact label="Début" value={formatDate(data.contract.startDate)} />
              <KeyFact label="Fin" value={formatDate(data.contract.endDate)} />
            </div>

            {/* Body */}
            <div className="rounded-lg border bg-muted/20 p-4 max-h-[280px] overflow-y-auto">
              <div className="space-y-1 text-sm">
                {renderMarkdownish(data.contract.content)}
              </div>
            </div>

            {/* Conditions */}
            {data.contract.conditions?.trim() && (
              <div className="space-y-1.5">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Conditions particulières
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {data.contract.conditions}
                </p>
              </div>
            )}

            <Separator />

            {/* Sign form */}
            <div className="space-y-3">
              <div className="text-sm font-semibold">Signer le contrat</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cp-signed-by">Nom complet</Label>
                  <Input
                    id="cp-signed-by"
                    value={signedBy}
                    onChange={(e) => setSignedBy(e.target.value)}
                    placeholder="Prénom Nom"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cp-signed-email">Email</Label>
                  <Input
                    id="cp-signed-email"
                    type="email"
                    value={signedByEmail}
                    onChange={(e) => setSignedByEmail(e.target.value)}
                    placeholder="vous@exemple.com"
                    className="h-11"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cp-signature">Taper votre nom comme signature</Label>
                <input
                  id="cp-signature"
                  type="text"
                  value={signatureData}
                  onChange={(e) => setSignatureData(e.target.value)}
                  placeholder="Votre nom complet"
                  className="font-serif italic text-xl h-14 w-full rounded-md border bg-background px-4 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                />
              </div>

              <label
                htmlFor="cp-agreed"
                className="flex items-start gap-2.5 cursor-pointer select-none rounded-md border bg-muted/30 p-3 text-sm"
              >
                <Checkbox
                  id="cp-agreed"
                  checked={agreed}
                  onCheckedChange={(v) => setAgreed(v === true)}
                  className="mt-0.5 size-5"
                />
                <span className="leading-relaxed">
                  J&apos;ai lu et j&apos;accepte les termes du contrat. Je
                  reconnais que la saisie de mon nom constitue une signature
                  électronique valant acceptation.
                </span>
              </label>

              <Button
                size="lg"
                onClick={submitSign}
                disabled={submitting}
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <PenTool className="size-4" />
                {submitting ? "Signature en cours…" : "Signer le contrat"}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Pay invoice dialog (tenant-scoped fetch + payment form)
// ---------------------------------------------------------------------------

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

function PayInvoiceDialog({
  portalToken,
  invoiceToken,
  onClose,
  onPaid,
}: {
  portalToken: string;
  invoiceToken: string;
  onClose: () => void;
  onPaid: () => void;
}) {
  const { toast } = useToast();
  const [data, setData] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<string>("TRANSFER");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .get<InvoiceData>(
        `/api/public/client/${portalToken}/invoices/${invoiceToken}`,
      )
      .then((res) => {
        if (!active) return;
        setData(res);
        setAmount(String(res.balance > 0 ? res.balance : 0));
      })
      .catch((e) => {
        if (!active) return;
        const msg =
          e instanceof ApiError ? e.message : "Facture introuvable";
        setErr(msg);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [portalToken, invoiceToken]);

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
    setSubmitting(true);
    try {
      await api.post(`/api/public/invoice/${invoiceToken}/pay`, {
        method,
        reference: reference.trim() || undefined,
        amount: amt,
      });
      onPaid();
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : "Impossible d'enregistrer le paiement";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="size-4 text-emerald-600" />
            Régler la facture
          </DialogTitle>
          <DialogDescription>
            Indiquez le montant que vous réglez et la méthode utilisée.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : err ? (
          <div className="py-6 text-center text-sm text-rose-600 dark:text-rose-400">
            {err}
          </div>
        ) : data ? (
          <div className="space-y-4 py-2">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Facture · {data.invoice.number}
                </div>
                <div className="font-semibold text-lg">
                  {formatCurrency(data.total, data.organization.currency)}
                </div>
              </div>
              <Badge
                className={`text-xs ${STATUS_COLOR[data.invoice.status] ?? ""}`}
                variant="outline"
              >
                {INVOICE_STATUS_LABELS[data.invoice.status]}
              </Badge>
            </div>

            {/* Items */}
            {data.items && data.items.length > 0 ? (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">Prestation</th>
                      <th className="text-right font-medium px-3 py-2 w-14">Qté</th>
                      <th className="text-right font-medium px-3 py-2 w-24">P.U.</th>
                      <th className="text-right font-medium px-3 py-2 w-24">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((it) => (
                      <tr key={it.id} className="border-t">
                        <td className="px-3 py-2">
                          <div className="font-medium">{it.title}</div>
                          {it.description && (
                            <div className="text-xs text-muted-foreground">
                              {it.description}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{it.qty}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatCurrency(it.unitPrice, data.organization.currency)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">
                          {formatCurrency(
                            it.qty * it.unitPrice,
                            data.organization.currency,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {/* Totals */}
            <div className="space-y-1.5">
              <TotalRow
                label="Sous-total"
                value={formatCurrency(data.subtotal, data.organization.currency)}
              />
              {data.discountAmount > 0 && (
                <TotalRow
                  label={`Remise (${data.invoice.discount || 0}%)`}
                  value={`− ${formatCurrency(data.discountAmount, data.organization.currency)}`}
                  tone="rose"
                />
              )}
              {data.taxAmount > 0 && (
                <TotalRow
                  label={`Taxe (${data.invoice.taxRate || 0}%)`}
                  value={`+ ${formatCurrency(data.taxAmount, data.organization.currency)}`}
                />
              )}
              <Separator />
              <TotalRow
                label="Total TTC"
                value={formatCurrency(data.total, data.organization.currency)}
                emphasize
              />
              <TotalRow
                label="Déjà payé"
                value={formatCurrency(data.paidAmount, data.organization.currency)}
                tone="emerald"
              />
              <TotalRow
                label="Reste à payer"
                value={formatCurrency(data.balance, data.organization.currency)}
                tone={data.balance > 0 ? "amber" : "emerald"}
                emphasize
              />
            </div>

            <Separator />

            {/* Pay form */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cp-amount">Montant à payer</Label>
                  <Input
                    id="cp-amount"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="h-11 tabular-nums"
                  />
                  <p className="text-xs text-muted-foreground">
                    Solde restant : {formatCurrency(data.balance, data.organization.currency)}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cp-method">Méthode de paiement</Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger id="cp-method" className="h-11 w-full">
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
                <Label htmlFor="cp-reference">Référence (facultatif)</Label>
                <Input
                  id="cp-reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="N° de virement, transaction…"
                  className="h-11"
                />
              </div>

              <Button
                size="lg"
                onClick={submitPay}
                disabled={submitting}
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CreditCard className="size-4" />
                {submitting ? "Enregistrement…" : "Enregistrer le paiement"}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// View invoice dialog (read-only receipt for PAID invoices)
// ---------------------------------------------------------------------------

function ViewInvoiceDialog({
  portalToken,
  invoiceToken,
  onClose,
}: {
  portalToken: string;
  invoiceToken: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .get<InvoiceData>(`/api/public/client/${portalToken}/invoices/${invoiceToken}`)
      .then((res) => {
        if (!active) return;
        setData(res);
      })
      .catch((e) => {
        if (!active) return;
        const msg =
          e instanceof ApiError ? e.message : "Facture introuvable";
        setErr(msg);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [portalToken, invoiceToken]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="size-4 text-emerald-600" />
            Reçu de paiement
          </DialogTitle>
          <DialogDescription>
            Détail de la facture et des paiements enregistrés.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : err ? (
          <div className="py-6 text-center text-sm text-rose-600 dark:text-rose-400">
            {err}
          </div>
        ) : data ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Facture · {data.invoice.number}
                </div>
                <div className="font-semibold text-lg">
                  {formatCurrency(data.total, data.organization.currency)}
                </div>
              </div>
              <Badge
                className={`text-xs ${STATUS_COLOR[data.invoice.status] ?? ""}`}
                variant="outline"
              >
                {INVOICE_STATUS_LABELS[data.invoice.status]}
              </Badge>
            </div>

            {data.payments && data.payments.length > 0 ? (
              <div className="space-y-2.5">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                  <Wallet className="size-4" />
                  Historique des paiements ({data.payments.length})
                </div>
                <div className="rounded-lg border divide-y">
                  {data.payments.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5"
                    >
                      <div className="space-y-0.5">
                        <div className="text-sm font-medium">
                          {formatCurrency(p.amount, data.organization.currency)}
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
              </div>
            ) : null}

            <Separator />

            <div className="space-y-1.5">
              <TotalRow
                label="Total TTC"
                value={formatCurrency(data.total, data.organization.currency)}
                emphasize
              />
              <TotalRow
                label="Déjà payé"
                value={formatCurrency(data.paidAmount, data.organization.currency)}
                tone="emerald"
              />
              <TotalRow
                label="Reste à payer"
                value={formatCurrency(data.balance, data.organization.currency)}
                tone={data.balance > 0 ? "amber" : "emerald"}
                emphasize
              />
            </div>

            <div className="flex justify-center pt-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => window.print()}
                className="text-muted-foreground"
              >
                Imprimer
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function EmptyState({
  icon,
  label,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
}) {
  return (
    <Card>
      <CardContent className="px-6 py-10 text-center space-y-3">
        <div className="mx-auto size-12 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground">
          {icon}
        </div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  );
}

function KeyFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-2 space-y-0.5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-semibold truncate">{value}</div>
    </div>
  );
}

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

function LoadingShell() {
  return (
    <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-16 ml-auto" />
          <Skeleton className="h-4 w-28 ml-auto" />
        </div>
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
      <Card>
        <CardContent className="px-5 py-6 space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-20 w-full" />
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
              Ce portail client n&apos;est plus accessible ou le lien est
              incorrect. Contactez votre prestataire pour obtenir un nouveau lien.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Recent events builder -----------------------------------------------

type RecentEvent = {
  date: string;
  label: string;
  sub: string;
  icon: React.ReactNode;
  toneBg: string;
};

function buildRecentEvents(data: PortalData): RecentEvent[] {
  const events: RecentEvent[] = [];

  for (const p of data.proposals) {
    if (p.acceptedAt) {
      events.push({
        date: p.acceptedAt,
        label: `Proposition ${p.number} acceptée`,
        sub: p.title,
        icon: <CheckCircle className="size-4 text-emerald-600" />,
        toneBg: "bg-emerald-50 dark:bg-emerald-950/30",
      });
    } else if (p.refusedAt) {
      events.push({
        date: p.refusedAt,
        label: `Proposition ${p.number} refusée`,
        sub: p.title,
        icon: <XCircle className="size-4 text-rose-600" />,
        toneBg: "bg-rose-50 dark:bg-rose-950/30",
      });
    } else if (p.viewedAt) {
      events.push({
        date: p.viewedAt,
        label: `Proposition ${p.number} consultée`,
        sub: p.title,
        icon: <FileText className="size-4 text-violet-600" />,
        toneBg: "bg-violet-50 dark:bg-violet-950/30",
      });
    } else if (p.sentAt) {
      events.push({
        date: p.sentAt,
        label: `Proposition ${p.number} reçue`,
        sub: p.title,
        icon: <FileText className="size-4 text-cyan-600" />,
        toneBg: "bg-cyan-50 dark:bg-cyan-950/30",
      });
    }
  }

  for (const q of data.quotes) {
    if (q.acceptedAt) {
      events.push({
        date: q.acceptedAt,
        label: `Devis ${q.number} accepté`,
        sub: "Devis accepté",
        icon: <CheckCircle className="size-4 text-emerald-600" />,
        toneBg: "bg-emerald-50 dark:bg-emerald-950/30",
      });
    } else if (q.refusedAt) {
      events.push({
        date: q.refusedAt,
        label: `Devis ${q.number} refusé`,
        sub: "Devis refusé",
        icon: <XCircle className="size-4 text-rose-600" />,
        toneBg: "bg-rose-50 dark:bg-rose-950/30",
      });
    } else if (q.viewedAt) {
      events.push({
        date: q.viewedAt,
        label: `Devis ${q.number} consulté`,
        sub: "Devis consulté",
        icon: <FileSpreadsheet className="size-4 text-violet-600" />,
        toneBg: "bg-violet-50 dark:bg-violet-950/30",
      });
    } else if (q.sentAt) {
      events.push({
        date: q.sentAt,
        label: `Devis ${q.number} reçu`,
        sub: "Devis reçu",
        icon: <FileSpreadsheet className="size-4 text-cyan-600" />,
        toneBg: "bg-cyan-50 dark:bg-cyan-950/30",
      });
    }
  }

  for (const c of data.contracts) {
    if (c.signedAt) {
      events.push({
        date: c.signedAt,
        label: `Contrat ${c.number} signé`,
        sub: c.title,
        icon: <PenTool className="size-4 text-emerald-600" />,
        toneBg: "bg-emerald-50 dark:bg-emerald-950/30",
      });
    } else if (c.viewedAt) {
      events.push({
        date: c.viewedAt,
        label: `Contrat ${c.number} consulté`,
        sub: c.title,
        icon: <PenTool className="size-4 text-violet-600" />,
        toneBg: "bg-violet-50 dark:bg-violet-950/30",
      });
    } else if (c.sentAt) {
      events.push({
        date: c.sentAt,
        label: `Contrat ${c.number} reçu`,
        sub: c.title,
        icon: <PenTool className="size-4 text-cyan-600" />,
        toneBg: "bg-cyan-50 dark:bg-cyan-950/30",
      });
    }
  }

  for (const inv of data.invoices) {
    if (inv.paidAt && inv.status === "PAID") {
      events.push({
        date: inv.paidAt,
        label: `Facture ${inv.number} payée`,
        sub: "Facture entièrement réglée",
        icon: <CheckCircle className="size-4 text-emerald-600" />,
        toneBg: "bg-emerald-50 dark:bg-emerald-950/30",
      });
    } else if (inv.viewedAt) {
      events.push({
        date: inv.viewedAt,
        label: `Facture ${inv.number} consultée`,
        sub: "Facture consultée",
        icon: <Receipt className="size-4 text-violet-600" />,
        toneBg: "bg-violet-50 dark:bg-violet-950/30",
      });
    } else if (inv.sentAt) {
      events.push({
        date: inv.sentAt,
        label: `Facture ${inv.number} reçue`,
        sub: "Facture reçue",
        icon: <Receipt className="size-4 text-cyan-600" />,
        toneBg: "bg-cyan-50 dark:bg-cyan-950/30",
      });
    }
  }

  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return events.slice(0, 5);
}

// --- Minimal markdown-ish renderer ---------------------------------------

function renderMarkdownish(text: string) {
  if (!text) return null;
  const lines = text.split("\n");
  return lines.map((line, i) => {
    if (line.startsWith("### ")) {
      return (
        <h3 key={i} className="text-base font-semibold mt-4 mb-1">
          {renderInline(line.slice(4))}
        </h3>
      );
    }
    if (line.startsWith("## ")) {
      return (
        <h2 key={i} className="text-lg font-semibold mt-5 mb-1">
          {renderInline(line.slice(3))}
        </h2>
      );
    }
    if (line.startsWith("# ")) {
      return (
        <h1 key={i} className="text-xl font-bold mt-6 mb-2">
          {renderInline(line.slice(2))}
        </h1>
      );
    }
    if (line.trim() === "") {
      return <div key={i} className="h-2.5" aria-hidden />;
    }
    return (
      <p key={i} className="text-sm leading-relaxed whitespace-pre-wrap">
        {renderInline(line)}
      </p>
    );
  });
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
