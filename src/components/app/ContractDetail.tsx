"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Send,
  Copy,
  Pencil,
  Trash2,
  FileSignature,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Wallet,
  Users,
  ListChecks,
  FolderKanban,
  Receipt,
  Eye,
  ExternalLink,
  Clock,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  formatCurrency,
  formatDate,
  CONTRACT_STATUS_LABELS,
  INVOICE_STATUS_LABELS,
  STATUS_COLOR,
} from "@/lib/format";
import type {
  Contract,
  Client,
  Invoice,
  Signature,
  PaymentPlan,
  Project,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PrintButton } from "@/components/shared/PrintButton";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

// Contract detail response extends Contract with invoices
type ContractDetail = Contract & {
  invoices?: Invoice[];
};

const CURRENCIES = ["XOF", "EUR", "USD", "GBP", "XAF"];

const STATUS_STEPS: { key: string; label: string }[] = [
  { key: "DRAFT", label: "Brouillon" },
  { key: "SENT", label: "Envoyé" },
  { key: "VIEWED", label: "Consulté" },
  { key: "SIGNED", label: "Signé" },
];

function clientLabel(c?: Client | null): string {
  if (!c) return "—";
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ");
  return c.company ? `${name} · ${c.company}` : name;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function ContractDetail() {
  const { params, org, tick, navigate, bump } = useStore();
  const { toast } = useToast();
  const id = params.id;

  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sending, setSending] = useState(false);
  const [signatureOpen, setSignatureOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<ContractDetail>(`/api/contracts/${id}`)
      .then((data) => {
        if (!cancelled) setContract(data);
      })
      .catch((e) => {
        if (cancelled) return;
        const msg = e instanceof ApiError ? e.message : "Contrat introuvable";
        setError(msg);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, tick]);

  async function handleSend() {
    if (!contract) return;
    setSending(true);
    try {
      const res = await api.post<{ publicToken: string }>(
        `/api/contracts/${contract.id}/send`
      );
      const link = `${window.location.origin}/?portal=contract&token=${res.publicToken}`;
      try {
        await navigator.clipboard.writeText(link);
      } catch {
        /* ignore */
      }
      toast({
        title: "Contrat envoyé au client",
        description: `Lien copié : ${link}`,
      });
      bump();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur lors de l'envoi";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  async function copyLink() {
    if (!contract?.publicToken) return;
    const link = `${window.location.origin}/?portal=contract&token=${contract.publicToken}`;
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: "Lien copié", description: link });
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de copier le lien",
        variant: "destructive",
      });
    }
  }

  async function handleDelete() {
    if (!contract) return;
    setDeleting(true);
    try {
      await api.del(`/api/contracts/${contract.id}`);
      toast({ title: "Contrat supprimé", description: contract.number });
      navigate("contracts");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur lors de la suppression";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <ContractDetailSkeleton />;
  if (error || !contract) {
    return (
      <Card className="p-10 flex flex-col items-center justify-center text-center">
        <div className="size-12 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center">
          <AlertCircle className="size-6" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">Contrat introuvable</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {error || "Ce contrat n'existe pas ou a été supprimé."}
        </p>
        <Button className="mt-4" variant="outline" onClick={() => navigate("contracts")}>
          <ArrowLeft className="size-4" /> Retour aux contrats
        </Button>
      </Card>
    );
  }

  const canSend = contract.status === "DRAFT";
  const canCopy = contract.status === "SENT" || contract.status === "VIEWED";
  const canEdit = ["DRAFT", "SENT", "VIEWED"].includes(contract.status);
  const isSigned = contract.status === "SIGNED";
  const clientSignature = contract.signatures?.[0];

  return (
    <div className="space-y-4">
      {/* Back + header */}
      <div className="flex items-center gap-2 no-print">
        <Button variant="ghost" size="sm" onClick={() => navigate("contracts")}>
          <ArrowLeft className="size-4" /> Contrats
        </Button>
      </div>

      <Card className="p-6 no-print">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">{contract.number}</span>
              <Badge className={STATUS_COLOR[contract.status]} variant="outline">
                {CONTRACT_STATUS_LABELS[contract.status] || contract.status}
              </Badge>
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight break-words">
              {contract.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Client :{" "}
              <button
                className="font-medium text-foreground hover:underline"
                onClick={() =>
                  contract.client &&
                  navigate("client-detail", { id: contract.client.id })
                }
              >
                {clientLabel(contract.client)}
              </button>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <PrintButton title={`Contrat ${contract.number}`} />
            {canSend && (
              <Button onClick={() => void handleSend()} disabled={sending}>
                <Send className="size-4" />
                {sending ? "Envoi…" : "Envoyer au client"}
              </Button>
            )}
            {canCopy && (
              <Button variant="outline" onClick={() => void copyLink()}>
                <Copy className="size-4" /> Copier le lien
              </Button>
            )}
            {isSigned && clientSignature && (
              <Button
                variant="outline"
                onClick={() => setSignatureOpen(true)}
              >
                <Eye className="size-4" /> Voir signature client
              </Button>
            )}
            {canEdit && (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="size-4" /> Modifier
              </Button>
            )}
            <Button
              variant="ghost"
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-4" /> Supprimer
            </Button>
          </div>
        </div>

        {/* Amount + dates summary */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryItem
            icon={<Wallet className="size-4" />}
            label="Montant"
            value={formatCurrency(contract.amount, contract.currency || org?.currency)}
          />
          <SummaryItem
            icon={<Calendar className="size-4" />}
            label="Date de début"
            value={formatDate(contract.startDate)}
          />
          <SummaryItem
            icon={<Calendar className="size-4" />}
            label="Date de fin"
            value={formatDate(contract.endDate)}
          />
          <SummaryItem
            icon={<Clock className="size-4" />}
            label="Durée"
            value={contract.duration || "—"}
          />
        </div>

        {/* Status stepper */}
        <div className="mt-6">
          <StatusStepper status={contract.status} />
        </div>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="contrat" className="w-full">
        <TabsList className="flex w-fit max-w-full overflow-x-auto justify-start no-print">
          <TabsTrigger value="contrat" className="min-w-fit px-3 text-xs whitespace-nowrap">
            <FileSignature className="size-3.5" /> Contrat
          </TabsTrigger>
          <TabsTrigger value="signatures" className="min-w-fit px-3 text-xs whitespace-nowrap">
            <Users className="size-3.5" /> Signatures
            {contract.signatures && contract.signatures.length > 0 && (
              <span className="ml-1 text-[10px] font-mono">
                ({contract.signatures.length})
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="echeancier" className="min-w-fit px-3 text-xs whitespace-nowrap">
            <ListChecks className="size-3.5" /> Échéancier
          </TabsTrigger>
          <TabsTrigger value="projet" className="min-w-fit px-3 text-xs whitespace-nowrap">
            <FolderKanban className="size-3.5" /> Projet
          </TabsTrigger>
          <TabsTrigger value="factures" className="min-w-fit px-3 text-xs whitespace-nowrap">
            <Receipt className="size-3.5" /> Factures
            {contract.invoices && contract.invoices.length > 0 && (
              <span className="ml-1 text-[10px] font-mono">
                ({contract.invoices.length})
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Contrat */}
        <TabsContent value="contrat" className="print-area">
          <Card>
            <CardHeader className="no-print">
              <CardTitle className="text-base">Contenu du contrat</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Print-only header (hidden on screen) */}
              <div className="hidden print:block space-y-1 mb-4">
                <div className="text-xs font-mono text-muted-foreground">{contract.number}</div>
                <h1 className="text-2xl font-semibold break-words">{contract.title}</h1>
                <div className="text-sm text-muted-foreground">
                  Client : {clientLabel(contract.client)}
                </div>
              </div>

              <div className="max-h-[600px] overflow-y-auto rounded-md border bg-muted/20 p-4 print:max-h-none print:overflow-visible print:border-0 print:bg-transparent print:p-0">
                <ContractBody content={contract.content} />
              </div>

              {/* Conditions */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Montant du contrat
                  </Label>
                  <div className="text-lg font-semibold">
                    {formatCurrency(contract.amount, contract.currency || org?.currency)}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Période
                  </Label>
                  <div className="text-sm">
                    {formatDate(contract.startDate)} → {formatDate(contract.endDate)}
                    {contract.duration && (
                      <span className="text-muted-foreground"> ({contract.duration})</span>
                    )}
                  </div>
                </div>
              </div>

              {contract.conditions && (
                <>
                  <Separator className="my-4" />
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      Conditions particulières
                    </Label>
                    <p className="mt-2 text-sm whitespace-pre-wrap text-foreground/90">
                      {contract.conditions}
                    </p>
                  </div>
                </>
              )}

              {contract.proposalId && (
                <>
                  <Separator className="my-4" />
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Issue de la proposition :</span>
                    <button
                      className="font-medium text-emerald-600 hover:underline"
                      onClick={() => navigate("proposal-detail", { id: contract.proposalId! })}
                    >
                      Voir la proposition
                      <ExternalLink className="inline ml-1 size-3" />
                    </button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Signatures */}
        <TabsContent value="signatures" className="no-print">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Signatures</CardTitle>
            </CardHeader>
            <CardContent>
              {!contract.signatures || contract.signatures.length === 0 ? (
                <EmptyTab
                  icon={<FileSignature className="size-6" />}
                  title="Aucune signature pour le moment"
                  description="Les signatures apparaîtront ici une fois le client aura signé le contrat via le lien envoyé."
                />
              ) : (
                <div className="space-y-3">
                  {contract.signatures.map((s) => (
                    <SignatureRow key={s.id} signature={s} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Échéancier */}
        <TabsContent value="echeancier" className="no-print">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Échéancier de paiement</CardTitle>
            </CardHeader>
            <CardContent>
              {!contract.paymentPlan ? (
                <EmptyTab
                  icon={<ListChecks className="size-6" />}
                  title="Aucun échéancier"
                  description={
                    isSigned
                      ? "L'échéancier sera créé automatiquement à la signature du contrat."
                      : "Un échéancier est automatiquement généré lorsque le client signe le contrat."
                  }
                />
              ) : (
                <PaymentPlanView
                  plan={contract.paymentPlan}
                  currency={contract.currency || org?.currency}
                  onInvoiceClick={(invId) => navigate("invoice-detail", { id: invId })}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Projet */}
        <TabsContent value="projet" className="no-print">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Projet lié</CardTitle>
            </CardHeader>
            <CardContent>
              {!contract.project ? (
                <EmptyTab
                  icon={<FolderKanban className="size-6" />}
                  title="Aucun projet lié"
                  description="Le projet sera créé automatiquement à la signature du contrat par le client."
                />
              ) : (
                <ProjectCard
                  project={contract.project}
                  onOpen={() =>
                    contract.project &&
                    navigate("project-detail", { id: contract.project.id })
                  }
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Factures */}
        <TabsContent value="factures" className="no-print">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Factures liées</CardTitle>
            </CardHeader>
            <CardContent>
              {!contract.invoices || contract.invoices.length === 0 ? (
                <EmptyTab
                  icon={<Receipt className="size-6" />}
                  title="Aucune facture liée"
                  description={
                    isSigned
                      ? "Les factures (acompte, échéances, finale) liées à ce contrat apparaîtront ici."
                      : "Les factures sont créées automatiquement (acompte) à la signature du contrat."
                  }
                />
              ) : (
                <InvoicesTable
                  invoices={contract.invoices}
                  currency={contract.currency || org?.currency}
                  onClick={(invId) => navigate("invoice-detail", { id: invId })}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit dialog */}
      <EditContractDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        contract={contract}
        onSaved={() => {
          setEditOpen(false);
          bump();
        }}
      />

      {/* Signature modal */}
      <Dialog open={signatureOpen} onOpenChange={setSignatureOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-emerald-600" />
              Signature du client
            </DialogTitle>
            <DialogDescription>
              Détails de la signature électronique du contrat.
            </DialogDescription>
          </DialogHeader>
          {clientSignature && <SignatureDetails signature={clientSignature} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignatureOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le contrat ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le contrat{" "}
              <span className="font-mono">{contract.number}</span> sera définitivement
              supprimé.
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
// Status stepper
// ─────────────────────────────────────────────────────────────────────────────

function StatusStepper({ status }: { status: string }) {
  if (status === "CANCELED" || status === "EXPIRED") {
    return (
      <div className="flex items-center gap-2 text-sm">
        <div className="size-6 rounded-full flex items-center justify-center bg-rose-100 text-rose-700">
          <AlertCircle className="size-4" />
        </div>
        <span className="font-medium text-rose-700">
          {CONTRACT_STATUS_LABELS[status]}
        </span>
      </div>
    );
  }

  const currentIndex = STATUS_STEPS.findIndex((s) => s.key === status);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {STATUS_STEPS.map((step, i) => {
        const reached = currentIndex >= 0 && i <= currentIndex;
        const active = i === currentIndex;
        return (
          <div key={step.key} className="flex items-center gap-1">
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border transition",
                reached
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "bg-muted text-muted-foreground border-border",
                active && "ring-2 ring-emerald-500/30"
              )}
            >
              {reached ? (
                <CheckCircle2 className="size-3.5" />
              ) : (
                <span className="size-3.5 flex items-center justify-center rounded-full border border-current opacity-50 text-[10px]">
                  {i + 1}
                </span>
              )}
              {step.label}
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <div
                className={cn(
                  "h-0.5 w-4 sm:w-8",
                  currentIndex >= 0 && i < currentIndex ? "bg-emerald-500" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary item
// ─────────────────────────────────────────────────────────────────────────────

function SummaryItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-sm font-medium truncate">{value}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Contract body renderer — basic markdown headings
// ─────────────────────────────────────────────────────────────────────────────

function ContractBody({ content }: { content: string }) {
  const lines = useMemo(() => content.split("\n"), [content]);
  return (
    <div className="space-y-1 text-sm text-foreground/90 leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith("### ")) {
          return (
            <h3 key={i} className="text-base font-semibold mt-3 mb-1">
              {line.slice(4)}
            </h3>
          );
        }
        if (line.startsWith("## ")) {
          return (
            <h2 key={i} className="text-lg font-semibold mt-4 mb-1">
              {line.slice(3)}
            </h2>
          );
        }
        if (line.startsWith("# ")) {
          return (
            <h1 key={i} className="text-xl font-bold mt-5 mb-2">
              {line.slice(2)}
            </h1>
          );
        }
        if (line.trim() === "") {
          return <div key={i} className="h-2" />;
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {line}
          </p>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Signature row + details modal
// ─────────────────────────────────────────────────────────────────────────────

function SignatureRow({ signature }: { signature: Signature }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <FileSignature className="size-4" />
            </div>
            <div>
              <div className="font-medium truncate">{signature.signedBy}</div>
              <div className="text-xs text-muted-foreground truncate">
                {signature.signedByEmail}
              </div>
            </div>
          </div>
        </div>
        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" variant="outline">
          <CheckCircle2 className="size-3" /> Signé
        </Badge>
      </div>
      <Separator className="my-3" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-muted-foreground">Date</div>
          <div className="font-medium">{formatDate(signature.signedAt, true)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Adresse IP</div>
          <div className="font-medium font-mono">{signature.ipAddress || "—"}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Signé par</div>
          <div className="font-medium">{signature.signedBy}</div>
        </div>
      </div>
    </div>
  );
}

function SignatureDetails({ signature }: { signature: Signature }) {
  const isImage =
    signature.signatureData &&
    (signature.signatureData.startsWith("data:image") ||
      signature.signatureData.startsWith("/"));

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-muted/20 p-3 space-y-2 text-sm">
        <Row label="Signataire" value={signature.signedBy} />
        <Row label="Email" value={signature.signedByEmail} />
        <Row label="Date" value={formatDate(signature.signedAt, true)} />
        <Row label="Adresse IP" value={signature.ipAddress || "—"} mono />
      </div>
      {isImage && signature.signatureData && (
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Tracé de signature
          </Label>
          <div className="mt-2 rounded-md border bg-white p-2">
            <img
              src={signature.signatureData as string}
              alt="Signature manuscrite"
              className="max-h-32 w-auto mx-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium text-right truncate", mono && "font-mono text-xs")}>
        {value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Payment plan view
// ─────────────────────────────────────────────────────────────────────────────

function PaymentPlanView({
  plan,
  currency,
  onInvoiceClick,
}: {
  plan: PaymentPlan;
  currency?: string;
  onInvoiceClick: (invoiceId: string) => void;
}) {
  const installments = plan.installments || [];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
        <div className="text-sm">
          <span className="text-muted-foreground">Total du plan : </span>
          <span className="font-semibold">{formatCurrency(plan.totalAmount, currency)}</span>
        </div>
        <Badge variant="outline">{installments.length} échéances</Badge>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">#</TableHead>
            <TableHead>Libellé</TableHead>
            <TableHead className="text-right">Montant</TableHead>
            <TableHead>Échéance</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Facture</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {installments.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                Aucune échéance définie.
              </TableCell>
            </TableRow>
          )}
          {installments.map((it, i) => (
            <TableRow key={it.id}>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {i + 1}
              </TableCell>
              <TableCell className="font-medium">{it.label}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(it.amount, currency)}
              </TableCell>
              <TableCell className="text-xs">{formatDate(it.dueDate)}</TableCell>
              <TableCell>
                <Badge className={STATUS_COLOR[it.status]} variant="outline">
                  {INSTALLMENT_LABELS[it.status] || it.status}
                </Badge>
              </TableCell>
              <TableCell>
                {it.invoice ? (
                  <button
                    className="font-mono text-xs text-emerald-600 hover:underline"
                    onClick={() => it.invoice && onInvoiceClick(it.invoice.id)}
                  >
                    {it.invoice.number}
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

const INSTALLMENT_LABELS: Record<string, string> = {
  UPCOMING: "À venir",
  PAID: "Payée",
  OVERDUE: "En retard",
};

// ─────────────────────────────────────────────────────────────────────────────
// Project card
// ─────────────────────────────────────────────────────────────────────────────

function ProjectCard({
  project,
  onOpen,
}: {
  project: Project;
  onOpen: () => void;
}) {
  return (
    <div className="rounded-lg border p-4 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <FolderKanban className="size-4 text-emerald-600" />
          <div className="font-medium truncate">{project.name}</div>
        </div>
        {project.description && (
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
            {project.description}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <Badge className={STATUS_COLOR[project.status]} variant="outline">
            {project.status}
          </Badge>
          <span>Budget : {formatCurrency(project.budget)}</span>
          <span>Progression : {project.progress}%</span>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onOpen}>
        <ExternalLink className="size-3.5" /> Ouvrir
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Invoices table
// ─────────────────────────────────────────────────────────────────────────────

function InvoicesTable({
  invoices,
  currency,
  onClick,
}: {
  invoices: Invoice[];
  currency?: string;
  onClick: (id: string) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[130px]">Numéro</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Émission</TableHead>
          <TableHead>Échéance</TableHead>
          <TableHead className="text-right">Montant</TableHead>
          <TableHead>Statut</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.map((inv) => (
          <TableRow
            key={inv.id}
            className="cursor-pointer"
            onClick={() => onClick(inv.id)}
          >
            <TableCell className="font-mono text-xs">{inv.number}</TableCell>
            <TableCell className="text-xs">
              {INVOICE_TYPE_LABEL[inv.type] || inv.type}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {formatDate(inv.issueDate)}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {formatDate(inv.dueDate)}
            </TableCell>
            <TableCell className="text-right tabular-nums font-medium">
              {formatCurrency(0, currency)}
              <span className="text-xs text-muted-foreground ml-1">(voir détail)</span>
            </TableCell>
            <TableCell>
              <Badge className={STATUS_COLOR[inv.status]} variant="outline">
                {INVOICE_STATUS_LABELS[inv.status] || inv.status}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

const INVOICE_TYPE_LABEL: Record<string, string> = {
  DEPOSIT: "Acompte",
  MILESTONE: "Étape",
  FINAL: "Finale",
};

// ─────────────────────────────────────────────────────────────────────────────
// Empty tab
// ─────────────────────────────────────────────────────────────────────────────

function EmptyTab({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-dashed p-8 flex flex-col items-center text-center">
      <div className="size-10 rounded-full bg-muted text-muted-foreground flex items-center justify-center">
        {icon}
      </div>
      <h3 className="mt-3 text-sm font-medium">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground max-w-md">{description}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit dialog
// ─────────────────────────────────────────────────────────────────────────────

function EditContractDialog({
  open,
  onOpenChange,
  contract,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contract: Contract;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Form state — initialized from contract, reset when opening
  const [title, setTitle] = useState(contract.title);
  const [content, setContent] = useState(contract.content);
  const [amount, setAmount] = useState(String(contract.amount || 0));
  const [currency, setCurrency] = useState(contract.currency || "XOF");
  const [startDate, setStartDate] = useState(toDateInput(contract.startDate));
  const [endDate, setEndDate] = useState(toDateInput(contract.endDate));
  const [duration, setDuration] = useState(contract.duration || "");
  const [conditions, setConditions] = useState(contract.conditions || "");

  useEffect(() => {
    if (open) {
      setTitle(contract.title);
      setContent(contract.content);
      setAmount(String(contract.amount || 0));
      setCurrency(contract.currency || "XOF");
      setStartDate(toDateInput(contract.startDate));
      setEndDate(toDateInput(contract.endDate));
      setDuration(contract.duration || "");
      setConditions(contract.conditions || "");
    }
  }, [open, contract]);

  async function save() {
    if (!title.trim()) {
      toast({ title: "Titre requis", variant: "destructive" });
      return;
    }
    if (!content.trim()) {
      toast({ title: "Contenu requis", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        content: content.trim(),
        amount: parseFloat(amount) || 0,
        currency,
        duration: duration.trim() || null,
        conditions: conditions.trim() || null,
        startDate: startDate || null,
        endDate: endDate || null,
      };
      await api.patch(`/api/contracts/${contract.id}`, body);
      toast({ title: "Contrat mis à jour", description: contract.number });
      onSaved();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur lors de la mise à jour";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!saving) onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier le contrat</DialogTitle>
          <DialogDescription>
            <span className="font-mono text-xs">{contract.number}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-title">Titre *</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-content">Contenu *</Label>
            <Textarea
              id="edit-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              className="font-mono text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="edit-amount">Montant</Label>
              <Input
                id="edit-amount"
                type="number"
                min={0}
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-start">Date de début</Label>
              <Input
                id="edit-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-end">Date de fin</Label>
              <Input
                id="edit-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-duration">Durée</Label>
              <Input
                id="edit-duration"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="3 mois"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-conditions">Conditions particulières</Label>
            <Textarea
              id="edit-conditions"
              value={conditions}
              onChange={(e) => setConditions(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function toDateInput(date: string | null): string {
  if (!date) return "";
  try {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────────────────

function ContractDetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-32" />
      <Card className="p-6 space-y-4">
        <div className="flex justify-between">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
        <Skeleton className="h-8 w-full" />
      </Card>
      <Skeleton className="h-10 w-full" />
      <Card className="p-6 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </Card>
    </div>
  );
}
