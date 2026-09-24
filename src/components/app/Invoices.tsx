"use client";

import { useEffect, useMemo, useState } from "react";
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
import type {
  Invoice,
  Client,
  Project,
  Contract,
  ReportData,
} from "@/lib/types";

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
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Receipt,
  Plus,
  Send,
  CreditCard,
  MoreHorizontal,
  Eye,
  Trash2,
  Link as LinkIcon,
  Calendar,
  Filter,
  ArrowRight,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

type Item = { title: string; description: string; qty: number; unitPrice: number };

function computeTotals(
  items: { qty: number; unitPrice: number }[],
  discount: number,
  taxRate: number,
) {
  const subtotal = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 0);
  const discountAmount = subtotal * ((Number(discount) || 0) / 100);
  const afterDiscount = subtotal - discountAmount;
  const taxAmount = afterDiscount * ((Number(taxRate) || 0) / 100);
  const total = afterDiscount + taxAmount;
  return { subtotal, discountAmount, taxAmount, total };
}

function invoiceTotal(inv: Invoice): number {
  return computeTotals(inv.items || [], inv.discount, inv.taxRate).total;
}

function clientName(c: Client | undefined | null): string {
  if (!c) return "—";
  const full = `${c.firstName} ${c.lastName}`.trim();
  return c.company ? `${full} · ${c.company}` : full;
}

function portalLink(token: string | null | undefined): string {
  if (!token) return "";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/?portal=invoice&token=${token}`;
}

function isOverdue(inv: Invoice): boolean {
  if (!inv.dueDate || inv.status === "PAID" || inv.status === "CANCELED" || inv.status === "DRAFT") return false;
  return new Date(inv.dueDate).getTime() < Date.now();
}

const STATUS_TABS: { value: string; label: string }[] = [
  { value: "ALL", label: "Toutes" },
  { value: "DRAFT", label: "Brouillons" },
  { value: "SENT", label: "Envoyées" },
  { value: "PARTIALLY_PAID", label: "Partielles" },
  { value: "PAID", label: "Payées" },
  { value: "OVERDUE", label: "En retard" },
];

const INVOICE_TYPES: { value: "DEPOSIT" | "MILESTONE" | "FINAL"; label: string }[] = [
  { value: "DEPOSIT", label: INVOICE_TYPE_LABELS.DEPOSIT },
  { value: "MILESTONE", label: INVOICE_TYPE_LABELS.MILESTONE },
  { value: "FINAL", label: INVOICE_TYPE_LABELS.FINAL },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function Invoices() {
  const { org, navigate, tick, bump } = useStore();
  const { toast } = useToast();
  const currency = org?.currency || "XOF";

  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [reports, setReports] = useState<ReportData | null>(null);

  const [statusTab, setStatusTab] = useState("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [payOpenFor, setPayOpenFor] = useState<Invoice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.get<Invoice[]>("/api/invoices").catch(() => [] as Invoice[]),
      api.get<Client[]>("/api/clients").catch(() => [] as Client[]),
      api.get<Project[]>("/api/projects").catch(() => [] as Project[]),
      api.get<Contract[]>("/api/contracts").catch(() => [] as Contract[]),
      api.get<ReportData>("/api/reports?range=month").catch(() => null),
    ]).then(([inv, cl, pr, ct, rep]) => {
      if (!active) return;
      setInvoices(inv);
      setClients(cl);
      setProjects(pr);
      setContracts(ct);
      setReports(rep);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [tick]);

  // Map client id → client for quick lookup
  const clientMap = useMemo(() => {
    const m: Record<string, Client> = {};
    clients.forEach((c) => (m[c.id] = c));
    return m;
  }, [clients]);

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      if (statusTab === "ALL") return true;
      if (statusTab === "OVERDUE") return isOverdue(inv);
      return inv.status === statusTab;
    });
  }, [invoices, statusTab]);

  const stats = useMemo(() => {
    if (reports) {
      return {
        totalInvoiced: reports.totalInvoiced,
        totalCollected: reports.totalCollected,
        outstanding: reports.totalOutstanding,
        overdue: reports.totalOverdue,
      };
    }
    // Compute from list
    const totalInvoiced = invoices.reduce((s, i) => s + invoiceTotal(i), 0);
    // Can't compute collected precisely from list (no payments). Show 0 as fallback.
    return {
      totalInvoiced,
      totalCollected: 0,
      outstanding: 0,
      overdue: invoices.filter(isOverdue).reduce((s, i) => s + invoiceTotal(i), 0),
    };
  }, [invoices, reports]);

  async function handleSend(inv: Invoice) {
    try {
      const res = await api.post<{ publicToken: string }>(`/api/invoices/${inv.id}/send`);
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

  async function handleDelete(inv: Invoice) {
    try {
      await api.del(`/api/invoices/${inv.id}`);
      toast({ title: "Facture supprimée" });
      setDeleteTarget(null);
      bump();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur lors de la suppression";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Factures</h2>
          <p className="text-sm text-muted-foreground">
            Émettez vos factures, suivez les paiements et relancez les retards.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" /> Nouvelle facture
            </Button>
          </DialogTrigger>
          {createOpen && (
            <CreateInvoiceDialog
              clients={clients}
              projects={projects}
              contracts={contracts}
              currency={currency}
              onClose={() => setCreateOpen(false)}
              onCreated={() => {
                setCreateOpen(false);
                bump();
              }}
            />
          )}
        </Dialog>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total facturé" value={formatCurrency(stats.totalInvoiced, currency)} tone="emerald" />
        <StatCard label="Total encaissé" value={formatCurrency(stats.totalCollected, currency)} tone="cyan" />
        <StatCard label="Restant à encaisser" value={formatCurrency(stats.outstanding, currency)} tone="amber" />
        <StatCard label="En retard" value={formatCurrency(stats.overdue, currency)} tone="rose" />
      </div>

      {/* Filter tabs */}
      <Tabs value={statusTab} onValueChange={setStatusTab}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <TabsList className="overflow-x-auto">
            {STATUS_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <Filter className="h-3 w-3" /> {filtered.length} facture(s)
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
        <EmptyState
          icon={<Receipt className="h-10 w-10" />}
          title="Aucune facture"
          message="Créez votre première facture pour commencer à encaisser des paiements."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> Nouvelle facture
            </Button>
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numéro</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Émise le</TableHead>
                    <TableHead>Échéance</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((inv) => {
                    const overdue = isOverdue(inv);
                    return (
                      <TableRow
                        key={inv.id}
                        className="cursor-pointer"
                        onClick={() => navigate("invoice-detail", { id: inv.id })}
                      >
                        <TableCell className="font-medium">{inv.number}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                            {INVOICE_TYPE_LABELS[inv.type] || inv.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {clientName(clientMap[inv.clientId])}
                        </TableCell>
                        <TableCell>{formatDate(inv.issueDate)}</TableCell>
                        <TableCell>
                          {inv.dueDate ? (
                            <span className={overdue ? "text-rose-600 font-medium" : ""}>
                              {formatDate(inv.dueDate)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(invoiceTotal(inv), currency)}
                        </TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLOR[inv.status] || "bg-muted text-muted-foreground"}>
                            {INVOICE_STATUS_LABELS[inv.status] || inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenuItem onClick={() => navigate("invoice-detail", { id: inv.id })}>
                                <Eye className="h-4 w-4" /> Voir le détail
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleSend(inv)}>
                                <Send className="h-4 w-4" /> Envoyer
                              </DropdownMenuItem>
                              {inv.publicToken && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    navigator.clipboard?.writeText(portalLink(inv.publicToken)).catch(() => {});
                                    toast({ title: "Lien copié" });
                                  }}
                                >
                                  <LinkIcon className="h-4 w-4" /> Copier le lien
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => setPayOpenFor(inv)}>
                                <CreditCard className="h-4 w-4" /> Marquer payée
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => setDeleteTarget(inv)}
                              >
                                <Trash2 className="h-4 w-4" /> Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((inv) => {
              const overdue = isOverdue(inv);
              return (
                <Card key={inv.id} className="overflow-hidden">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        className="text-left flex-1 min-w-0"
                        onClick={() => navigate("invoice-detail", { id: inv.id })}
                      >
                        <div className="font-semibold truncate">{inv.number}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {clientName(clientMap[inv.clientId])}
                        </div>
                      </button>
                      <Badge className={STATUS_COLOR[inv.status] || "bg-muted text-muted-foreground"}>
                        {INVOICE_STATUS_LABELS[inv.status] || inv.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                        {INVOICE_TYPE_LABELS[inv.type] || inv.type}
                      </Badge>
                      <div className="text-sm font-semibold">
                        {formatCurrency(invoiceTotal(inv), currency)}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {formatDate(inv.issueDate)}
                      </span>
                      <span className={overdue ? "text-rose-600 font-medium" : ""}>
                        Éch. {formatDate(inv.dueDate)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button size="sm" variant="outline" onClick={() => handleSend(inv)}>
                        <Send className="h-3.5 w-3.5" /> Envoyer
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setPayOpenFor(inv)}>
                        <CreditCard className="h-3.5 w-3.5" /> Marquer payée
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate("invoice-detail", { id: inv.id })}
                      >
                        Détail <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Record payment (quick) */}
      {payOpenFor && (
        <QuickPaymentDialog
          invoice={payOpenFor}
          client={clientMap[payOpenFor.clientId]}
          amount={invoiceTotal(payOpenFor)}
          currency={currency}
          onClose={() => setPayOpenFor(null)}
          onDone={() => {
            setPayOpenFor(null);
            bump();
          }}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la facture {deleteTarget?.number} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La facture et ses lignes seront définitivement supprimées.
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
// Stat card
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "cyan" | "amber" | "rose" | "neutral";
}) {
  const toneClass: Record<string, string> = {
    emerald: "text-emerald-600",
    cyan: "text-cyan-600",
    amber: "text-amber-600",
    rose: "text-rose-600",
    neutral: "text-foreground",
  };
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-lg font-semibold mt-1 ${toneClass[tone]}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-10 flex flex-col items-center text-center gap-3">
        <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
          {icon}
        </div>
        <div>
          <div className="font-semibold">{title}</div>
          <div className="text-sm text-muted-foreground max-w-md mt-1">{message}</div>
        </div>
        {action}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Create invoice dialog with items editor
// ─────────────────────────────────────────────────────────────────────────────

function CreateInvoiceDialog({
  clients,
  projects,
  contracts,
  currency,
  onClose,
  onCreated,
}: {
  clients: Client[];
  projects: Project[];
  contracts: Contract[];
  currency: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [contractId, setContractId] = useState("");
  const [type, setType] = useState<"DEPOSIT" | "MILESTONE" | "FINAL">("FINAL");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [discount, setDiscount] = useState("0");
  const [taxRate, setTaxRate] = useState("0");
  const [items, setItems] = useState<Item[]>([
    { title: "", description: "", qty: 1, unitPrice: 0 },
  ]);
  const [submitting, setSubmitting] = useState(false);

  const filteredProjects = useMemo(
    () => (clientId ? projects.filter((p) => p.clientId === clientId) : projects),
    [projects, clientId],
  );
  const filteredContracts = useMemo(
    () => (clientId ? contracts.filter((c) => c.clientId === clientId) : contracts),
    [contracts, clientId],
  );

  const totals = useMemo(() => computeTotals(items, Number(discount), Number(taxRate)), [items, discount, taxRate]);

  function updateItem(idx: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function addItem() {
    setItems((prev) => [...prev, { title: "", description: "", qty: 1, unitPrice: 0 }]);
  }
  function removeItem(idx: number) {
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) {
      toast({ title: "Client requis", variant: "destructive" });
      return;
    }
    if (items.some((it) => !it.title.trim())) {
      toast({ title: "Toutes les lignes doivent avoir un titre", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/api/invoices", {
        clientId,
        projectId: projectId || undefined,
        contractId: contractId || undefined,
        type,
        issueDate: issueDate ? new Date(issueDate).toISOString() : undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        notes: notes || undefined,
        terms: terms || undefined,
        discount: Number(discount) || 0,
        taxRate: Number(taxRate) || 0,
        items: items.map((it) => ({
          title: it.title,
          description: it.description || undefined,
          qty: Number(it.qty) || 1,
          unitPrice: Number(it.unitPrice) || 0,
        })),
      });
      toast({ title: "Facture créée" });
      onCreated();
    } catch (e2) {
      const msg = e2 instanceof ApiError ? e2.message : "Erreur lors de la création";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogContent
      className="sm:max-w-2xl max-h-[92vh] overflow-y-auto"
      onOpenAutoFocus={(e) => e.preventDefault()}
    >
      <DialogHeader>
        <DialogTitle>Nouvelle facture</DialogTitle>
        <DialogDescription>
          Renseignez le client, les lignes de facturation et les conditions. Les totaux sont calculés en direct.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Client / Project / Contract */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Client *</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Sélectionner…" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {clientName(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Projet (optionnel)</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Aucun</SelectItem>
                {filteredProjects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Contrat (optionnel)</Label>
            <Select value={contractId} onValueChange={setContractId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Aucun</SelectItem>
                {filteredContracts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.number} · {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Type + dates */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INVOICE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Date d&apos;émission</Label>
            <Input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Échéance</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        {/* Items editor */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Lignes</Label>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="h-3.5 w-3.5" /> Ajouter une ligne
            </Button>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {items.map((it, idx) => {
              const lineTotal = (Number(it.qty) || 0) * (Number(it.unitPrice) || 0);
              return (
                <div
                  key={idx}
                  className="rounded-md border p-3 grid grid-cols-12 gap-2 items-end"
                >
                  <div className="col-span-12 sm:col-span-4 space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Désignation</Label>
                    <Input
                      value={it.title}
                      onChange={(e) => updateItem(idx, { title: e.target.value })}
                      placeholder="Titre de la ligne"
                    />
                  </div>
                  <div className="col-span-12 sm:col-span-4 space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Description</Label>
                    <Input
                      value={it.description}
                      onChange={(e) => updateItem(idx, { description: e.target.value })}
                      placeholder="Optionnel"
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-1 space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Qté</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={it.qty}
                      onChange={(e) => updateItem(idx, { qty: Number(e.target.value) })}
                    />
                  </div>
                  <div className="col-span-5 sm:col-span-2 space-y-1">
                    <Label className="text-[11px] text-muted-foreground">P.U.</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={it.unitPrice}
                      onChange={(e) => updateItem(idx, { unitPrice: Number(e.target.value) })}
                    />
                  </div>
                  <div className="col-span-3 sm:col-span-1 flex flex-col items-end justify-end gap-1">
                    <div className="text-xs text-muted-foreground">Total</div>
                    <div className="text-sm font-medium tabular-nums">
                      {formatCurrency(lineTotal, currency)}
                    </div>
                  </div>
                  <div className="col-span-12 sm:col-span-12 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(idx)}
                      disabled={items.length === 1}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Retirer
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Discount / Tax */}
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

        {/* Notes / Terms */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Notes (internes)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optionnel"
              rows={2}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Conditions</Label>
            <Textarea
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              placeholder="Paiement à 30 jours…"
              rows={2}
            />
          </div>
        </div>

        {/* Totals */}
        <div className="rounded-md border bg-muted/30 p-4 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Sous-total</span>
            <span className="tabular-nums">{formatCurrency(totals.subtotal, currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Remise (-{Number(discount) || 0}%)</span>
            <span className="tabular-nums text-rose-600">-{formatCurrency(totals.discountAmount, currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">TVA (+{Number(taxRate) || 0}%)</span>
            <span className="tabular-nums">{formatCurrency(totals.taxAmount, currency)}</span>
          </div>
          <div className="flex justify-between pt-1.5 border-t mt-1.5">
            <span className="font-semibold">Total</span>
            <span className="font-bold text-lg tabular-nums">{formatCurrency(totals.total, currency)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Annuler
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Création…" : "Créer la facture"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick payment dialog (mark paid)
// ─────────────────────────────────────────────────────────────────────────────

function QuickPaymentDialog({
  invoice,
  client,
  amount,
  currency,
  onClose,
  onDone,
}: {
  invoice: Invoice;
  client?: Client;
  amount: number;
  currency: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [method, setMethod] = useState<"CASH" | "TRANSFER" | "CARD" | "MOBILE_MONEY" | "OTHER">("TRANSFER");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [paidAmount, setPaidAmount] = useState(String(amount));
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!invoice.clientId) return;
    if (!Number(paidAmount) || Number(paidAmount) <= 0) {
      toast({ title: "Montant invalide", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/api/payments", {
        clientId: invoice.clientId,
        invoiceId: invoice.id,
        amount: Number(paidAmount),
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
            Facture {invoice.number} · {client ? clientName(client) : "Client"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Montant</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Solde suggéré : {formatCurrency(amount, currency)}
            </p>
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
              <Input
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
              />
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
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optionnel"
            />
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
