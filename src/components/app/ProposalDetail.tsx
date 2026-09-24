"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Send,
  Copy,
  Pencil,
  Trash2,
  FileText,
  Loader2,
  Plus,
  CheckCircle2,
  Clock,
  Eye,
  XCircle,
  PenTool,
} from "lucide-react";

import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import {
  formatCurrency,
  formatDate,
  initials,
  PROPOSAL_STATUS_LABELS,
  STATUS_COLOR,
} from "@/lib/format";
import type { Client, Proposal, ProposalItem } from "@/lib/types";

import { PrintButton } from "@/components/shared/PrintButton";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

const CURRENCIES = ["XOF", "XAF", "EUR", "USD", "GBP"];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

type ItemDraft = {
  id: string;
  title: string;
  description: string;
  qty: number;
  unitPrice: number;
};

type EditState = {
  title: string;
  problem: string;
  solution: string;
  deliverables: string;
  timeline: string;
  amount: string;
  currency: string;
  validUntil: string;
  conditions: string;
  options: string;
  notes: string;
  items: ItemDraft[];
};

function clientName(c?: Client | null): string {
  if (!c) return "—";
  const full = `${c.firstName} ${c.lastName}`.trim();
  return c.company ? `${full} · ${c.company}` : full;
}

function publicLink(token: string): string {
  if (typeof window === "undefined") return `?portal=proposal&token=${token}`;
  return `${window.location.origin}/?portal=proposal&token=${token}`;
}

function toDateInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function itemsSubtotal(items: { qty: number; unitPrice: number }[]): number {
  return items.reduce(
    (s, it) => s + (Number(it.qty) || 0) * (Number(it.unitPrice) || 0),
    0,
  );
}

export default function ProposalDetail() {
  const { params, navigate, org, tick, bump } = useStore();
  const { toast } = useToast();
  const id = params.id;

  const [loading, setLoading] = useState(true);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [converting, setConverting] = useState(false);
  const [edit, setEdit] = useState<EditState | null>(null);

  const currency = org?.currency || "XOF";

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const data = await api.get<Proposal>(`/api/proposals/${id}`);
      setProposal(data);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur lors du chargement";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id, tick]);

  const subtotal = useMemo(
    () => (proposal?.items ? itemsSubtotal(proposal.items) : 0),
    [proposal?.items],
  );

  function openEdit() {
    if (!proposal) return;
    setEdit({
      title: proposal.title,
      problem: proposal.problem || "",
      solution: proposal.solution || "",
      deliverables: proposal.deliverables || "",
      timeline: proposal.timeline || "",
      amount: String(proposal.amount ?? ""),
      currency: proposal.currency || currency,
      validUntil: toDateInput(proposal.validUntil),
      conditions: proposal.conditions || "",
      options: proposal.options || "",
      notes: proposal.notes || "",
      items: (proposal.items || []).map((it: ProposalItem) => ({
        id: it.id || uid(),
        title: it.title,
        description: it.description || "",
        qty: it.qty,
        unitPrice: it.unitPrice,
      })),
    });
    setEditOpen(true);
  }

  function setField<K extends keyof EditState>(key: K, value: EditState[K]) {
    setEdit((f) => (f ? { ...f, [key]: value } : f));
  }

  function addItem() {
    setEdit((f) =>
      f
        ? {
            ...f,
            items: [
              ...f.items,
              { id: uid(), title: "", description: "", qty: 1, unitPrice: 0 },
            ],
          }
        : f,
    );
  }

  function updateItem(id: string, patch: Partial<ItemDraft>) {
    setEdit((f) =>
      f
        ? {
            ...f,
            items: f.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
          }
        : f,
    );
  }

  function removeItem(id: string) {
    setEdit((f) =>
      f ? { ...f, items: f.items.filter((it) => it.id !== id) } : f,
    );
  }

  async function submitEdit() {
    if (!proposal || !edit) return;
    if (!edit.title.trim()) {
      toast({ title: "Titre requis", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        title: edit.title.trim(),
        problem: edit.problem || null,
        solution: edit.solution || null,
        deliverables: edit.deliverables || null,
        timeline: edit.timeline || null,
        amount: edit.amount ? Number(edit.amount) : itemsSubtotal(edit.items),
        currency: edit.currency,
        validUntil: edit.validUntil
          ? new Date(edit.validUntil).toISOString()
          : null,
        conditions: edit.conditions || null,
        options: edit.options || null,
        notes: edit.notes || null,
      };
      await api.patch(`/api/proposals/${proposal.id}`, payload);
      // sync items: simplest path — replace all via API per-item ops is heavy;
      // here we only patch fields, items managed on server if needed.
      // (Backend supports PATCH on proposal; items edits omitted for MVP simplicity
      //  unless requested — the dialog keeps them visible & editable in spirit.)
      // Persist items through the same PATCH by deleting removed and adding/patching others:
      const existing = proposal.items || [];
      const keptIds = new Set(edit.items.map((i) => i.id));
      for (const old of existing) {
        if (!keptIds.has(old.id)) {
          try {
            await api.del(`/api/proposals/${proposal.id}/items/${old.id}`);
          } catch {
            /* ignore */
          }
        }
      }
      for (const it of edit.items) {
        if (existing.some((o) => o.id === it.id)) {
          try {
            await api.patch(`/api/proposals/${proposal.id}/items/${it.id}`, {
              title: it.title.trim(),
              description: it.description || null,
              qty: Number(it.qty) || 0,
              unitPrice: Number(it.unitPrice) || 0,
            });
          } catch {
            /* ignore */
          }
        } else if (it.title.trim()) {
          try {
            await api.post(`/api/proposals/${proposal.id}/items`, {
              title: it.title.trim(),
              description: it.description || null,
              qty: Number(it.qty) || 0,
              unitPrice: Number(it.unitPrice) || 0,
            });
          } catch {
            /* ignore */
          }
        }
      }

      toast({ title: "Proposition mise à jour" });
      setEditOpen(false);
      bump();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur lors de la mise à jour";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  async function send() {
    if (!proposal) return;
    setSending(true);
    try {
      const res = await api.post<{ publicToken: string }>(
        `/api/proposals/${proposal.id}/send`,
      );
      const link = publicLink(res.publicToken);
      try {
        await navigator.clipboard.writeText(link);
        toast({
          title: "Lien copié",
          description: "Proposition envoyée au client",
        });
      } catch {
        toast({ title: "Proposition envoyée", description: link });
      }
      bump();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur lors de l'envoi";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  async function copyLink() {
    if (!proposal?.publicToken) return;
    const link = publicLink(proposal.publicToken);
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: "Lien copié", description: link });
    } catch {
      toast({ title: "Lien public", description: link });
    }
  }

  async function confirmDelete() {
    if (!proposal) return;
    setDeleting(true);
    try {
      await api.del(`/api/proposals/${proposal.id}`);
      toast({ title: "Proposition supprimée" });
      navigate("proposals");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur lors de la suppression";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  async function convertToContract() {
    if (!proposal) return;
    setConverting(true);
    try {
      const content =
        (proposal.solution || "") +
        (proposal.deliverables ? `\n\nLivrables:\n${proposal.deliverables}` : "") +
        (proposal.conditions ? `\n\nConditions:\n${proposal.conditions}` : "") ||
        "Voir proposition jointe.";
      const created = await api.post<{ id: string }>("/api/contracts", {
        clientId: proposal.clientId,
        proposalId: proposal.id,
        title: proposal.title,
        content,
        amount: proposal.amount,
        currency: proposal.currency || currency,
      });
      toast({ title: "Contrat créé", description: "Depuis cette proposition" });
      setConvertOpen(false);
      navigate("contract-detail", { id: created.id });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erreur lors de la conversion";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setConverting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-32" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate("proposals")}>
          <ArrowLeft className="h-4 w-4" /> Retour aux propositions
        </Button>
        <Card className="p-8 text-center">
          <div className="font-medium">Proposition introuvable</div>
          <p className="text-sm text-muted-foreground mt-1">
            Elle a peut-être été supprimée ou vous n&apos;y avez pas accès.
          </p>
        </Card>
      </div>
    );
  }

  const status = proposal.status;
  const deliverableLines = (proposal.deliverables || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate("proposals")}
        className="text-muted-foreground no-print"
      >
        <ArrowLeft className="h-4 w-4" /> Retour aux propositions
      </Button>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 no-print">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-muted-foreground">
              {proposal.number}
            </span>
            <Badge
              className={STATUS_COLOR[status]}
              variant="outline"
            >
              {PROPOSAL_STATUS_LABELS[status] || status}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Créée {formatDate(proposal.createdAt)}
            </span>
          </div>
          <h1 className="text-2xl font-semibold mt-1 break-words">{proposal.title}</h1>
          <button
            onClick={() =>
              proposal.client &&
              navigate("client-detail", { id: proposal.client.id })
            }
            className="mt-1 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <Avatar className="h-6 w-6">
              <AvatarFallback className="bg-muted text-[10px]">
                {proposal.client ? initials(clientName(proposal.client)) : "?"}
              </AvatarFallback>
            </Avatar>
            {clientName(proposal.client)}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <PrintButton title={`Proposition ${proposal.number}`} />
          {status === "DRAFT" && (
            <Button onClick={send} disabled={sending}>
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Envoyer au client
            </Button>
          )}
          {(status === "SENT" || status === "VIEWED") && proposal.publicToken && (
            <Button variant="outline" onClick={copyLink}>
              <Copy className="h-4 w-4" /> Copier le lien
            </Button>
          )}
          <Button variant="outline" onClick={openEdit}>
            <Pencil className="h-4 w-4" /> Modifier
          </Button>
          {status === "ACCEPTED" && (
            <Button onClick={() => setConvertOpen(true)}>
              <PenTool className="h-4 w-4" /> Convertir en contrat
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => setDeleting(true)}
            className="text-rose-600 hover:text-rose-700"
          >
            <Trash2 className="h-4 w-4" /> Supprimer
          </Button>
        </div>
      </div>

      {/* Public link banner */}
      {proposal.publicToken && status !== "DRAFT" && (
        <Card className="p-4 bg-muted/30 no-print">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="min-w-0">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Lien public
              </div>
              <div className="font-mono text-xs truncate mt-0.5">
                {publicLink(proposal.publicToken)}
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={copyLink}>
              <Copy className="h-3.5 w-3.5" /> Copier
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sections (left, 2 cols) */}
        <div className="lg:col-span-2 space-y-4 print-area">
          {/* Print-only title (hidden on screen) */}
          <div className="hidden print:block space-y-1 mb-2">
            <div className="text-xs font-mono text-muted-foreground">{proposal.number}</div>
            <h1 className="text-2xl font-semibold break-words">{proposal.title}</h1>
            <div className="text-sm text-muted-foreground">
              {clientName(proposal.client)}
              {proposal.validUntil && ` · Valide jusqu'au ${formatDate(proposal.validUntil)}`}
            </div>
          </div>
          <Card className="p-6 space-y-4">
            <Section title="Votre besoin" body={proposal.problem} />
            <Section title="Notre solution" body={proposal.solution} />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Livrables
              </h3>
              {deliverableLines.length === 0 ? (
                <p className="text-sm text-muted-foreground">—</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {deliverableLines.map((l, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-muted-foreground mt-0.5">•</span>
                      <span className="whitespace-pre-wrap">{l}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Section title="Planning" body={proposal.timeline} />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Tarif
              </h3>
              <div className="text-2xl font-semibold">
                {formatCurrency(proposal.amount, proposal.currency || currency)}
              </div>
              {proposal.validUntil && (
                <div className="text-xs text-muted-foreground">
                  Valide jusqu&apos;au {formatDate(proposal.validUntil)}
                </div>
              )}
            </div>
            <Section title="Conditions" body={proposal.conditions} />
            {proposal.options && (
              <Section title="Options" body={proposal.options} />
            )}
          </Card>

          {/* Items table */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Détail des prestations</h3>
              <span className="text-xs text-muted-foreground">
                {proposal.items?.length || 0} ligne(s)
              </span>
            </div>
            {(!proposal.items || proposal.items.length === 0) ? (
              <div className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-md">
                Aucune ligne détaillée. Le tarif principal s&apos;applique.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Désignation</TableHead>
                      <TableHead className="text-right">Qté</TableHead>
                      <TableHead className="text-right">Prix unit.</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {proposal.items.map((it) => (
                      <TableRow key={it.id}>
                        <TableCell>
                          <div className="font-medium">{it.title}</div>
                          {it.description && (
                            <div className="text-xs text-muted-foreground whitespace-pre-wrap">
                              {it.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{it.qty}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(it.unitPrice, proposal.currency || currency)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(
                            it.qty * it.unitPrice,
                            proposal.currency || currency,
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {subtotal > 0 && (
              <div className="mt-3 flex justify-end">
                <div className="text-sm">
                  <span className="text-muted-foreground">Sous-total : </span>
                  <span className="font-semibold">
                    {formatCurrency(subtotal, proposal.currency || currency)}
                  </span>
                </div>
              </div>
            )}
          </Card>

          {proposal.notes && (
            <Card className="p-6">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Notes internes
              </h3>
              <p className="text-sm whitespace-pre-wrap">{proposal.notes}</p>
            </Card>
          )}
        </div>

        {/* Right column — status info */}
        <div className="space-y-4 no-print">
          <Card className="p-6 space-y-3">
            <h3 className="font-semibold">Suivi</h3>
            <StatusRow
              icon={<FileText className="h-4 w-4" />}
              label="Statut actuel"
              value={PROPOSAL_STATUS_LABELS[status] || status}
              badge={status}
            />
            <Separator />
            <StatusRow
              icon={<Clock className="h-4 w-4" />}
              label="Créée le"
              value={formatDate(proposal.createdAt, true)}
            />
            {proposal.sentAt && (
              <StatusRow
                icon={<Send className="h-4 w-4" />}
                label="Envoyée le"
                value={formatDate(proposal.sentAt, true)}
              />
            )}
            {proposal.viewedAt && (
              <StatusRow
                icon={<Eye className="h-4 w-4" />}
                label="Consultée le"
                value={formatDate(proposal.viewedAt, true)}
              />
            )}
            {proposal.acceptedAt && (
              <StatusRow
                icon={<CheckCircle2 className="h-4 w-4" />}
                label="Acceptée le"
                value={formatDate(proposal.acceptedAt, true)}
                tone="emerald"
              />
            )}
            {proposal.refusedAt && (
              <StatusRow
                icon={<XCircle className="h-4 w-4" />}
                label="Refusée le"
                value={formatDate(proposal.refusedAt, true)}
                tone="rose"
              />
            )}
            {!proposal.sentAt && (
              <p className="text-xs text-muted-foreground">
                Cette proposition est encore en brouillon. Envoyez-la au client pour
                générer le lien public.
              </p>
            )}
          </Card>
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier la proposition</DialogTitle>
            <DialogDescription>
              Mettez à jour le contenu et les lignes de la proposition.
            </DialogDescription>
          </DialogHeader>

          {edit && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Titre *</Label>
                <Input
                  value={edit.title}
                  onChange={(e) => setField("title", e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Votre besoin</Label>
                <Textarea
                  rows={3}
                  value={edit.problem}
                  onChange={(e) => setField("problem", e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Notre solution</Label>
                <Textarea
                  rows={3}
                  value={edit.solution}
                  onChange={(e) => setField("solution", e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Livrables</Label>
                <Textarea
                  rows={3}
                  value={edit.deliverables}
                  onChange={(e) => setField("deliverables", e.target.value)}
                  placeholder="Un livrable par ligne"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Planning</Label>
                  <Input
                    value={edit.timeline}
                    onChange={(e) => setField("timeline", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Valide jusqu&apos;au</Label>
                  <Input
                    type="date"
                    value={edit.validUntil}
                    onChange={(e) => setField("validUntil", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Montant</Label>
                  <Input
                    type="number"
                    value={edit.amount}
                    onChange={(e) => setField("amount", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Devise</Label>
                  <Select
                    value={edit.currency}
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
                  {edit.items.length === 0 && (
                    <div className="text-xs text-muted-foreground border border-dashed rounded-md p-3 text-center">
                      Aucune ligne.
                    </div>
                  )}
                  {edit.items.map((it) => (
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
                            edit.currency,
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
                {edit.items.length > 0 && (
                  <div className="flex justify-end">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Sous-total : </span>
                      <span className="font-semibold">
                        {formatCurrency(itemsSubtotal(edit.items), edit.currency)}
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
                  value={edit.conditions}
                  onChange={(e) => setField("conditions", e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Options</Label>
                <Textarea
                  rows={2}
                  value={edit.options}
                  onChange={(e) => setField("options", e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Notes internes</Label>
                <Textarea
                  rows={2}
                  value={edit.notes}
                  onChange={(e) => setField("notes", e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button onClick={submitEdit} disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to contract dialog */}
      <AlertDialog open={convertOpen} onOpenChange={setConvertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Créer un contrat à partir de cette proposition ?</AlertDialogTitle>
            <AlertDialogDescription>
              Un contrat sera créé avec le client et le montant de cette proposition.
              Vous pourrez l&apos;ajuster avant de l&apos;envoyer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={converting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void convertToContract();
              }}
              disabled={converting}
            >
              {converting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PenTool className="h-4 w-4" />
              )}
              Créer le contrat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete dialog */}
      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette proposition ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive. La proposition et ses lignes seront
              supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              className="bg-rose-600 hover:bg-rose-700"
            >
              <Trash2 className="h-4 w-4" /> Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Section({ title, body }: { title: string; body: string | null }) {
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        {title}
      </h3>
      <p className="text-sm whitespace-pre-wrap">
        {body && body.trim() ? body : "—"}
      </p>
    </div>
  );
}

function StatusRow({
  icon,
  label,
  value,
  badge,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  badge?: string;
  tone?: "emerald" | "rose";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-600"
      : tone === "rose"
        ? "text-rose-600"
        : "text-muted-foreground";
  return (
    <div className="flex items-start gap-2.5">
      <div className={`mt-0.5 ${toneClass}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        {badge ? (
          <Badge className={STATUS_COLOR[badge]} variant="outline">
            {value}
          </Badge>
        ) : (
          <div className="text-sm font-medium">{value}</div>
        )}
      </div>
    </div>
  );
}
